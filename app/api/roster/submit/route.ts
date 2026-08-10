import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function normalizeTeamName(name: string): string {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/أ|إ|آ/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ـ/g, "")
    .replace(/ّ/g, "")
    .toLowerCase();
}

// Saves the team + player names/numbers only — no files. Photos are uploaded
// one-by-one afterwards via /api/roster/upload-photo, because a single
// combined request carrying an entire squad's photos routinely exceeds
// Vercel's ~4.5MB request body limit and gets rejected with 413 before it
// ever reaches this handler.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const suffix = String(body.suffix || "");
    const teamName = String(body.teamName || "").trim();
    const managerName = String(body.managerName || "");
    const managerPhone = String(body.managerPhone || "");
    const coachName = String(body.coachName || "").trim();
    const players = (Array.isArray(body.players) ? body.players : []) as Array<{ name: string; number: string }>;

    if (!teamName || !managerName.trim() || !managerPhone.trim() || !players.length) {
      return NextResponse.json({ error: "بيانات القائمة غير مكتملة." }, { status: 400 });
    }
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p?.name?.trim() || !p?.number?.trim()) {
        return NextResponse.json({ error: `الرجاء ملء بيانات جميع اللاعبين. اللاعب رقم ${i + 1} بياناته ناقصة.` }, { status: 400 });
      }
    }

    const supabase = createServiceRoleClient();

    const { data: bracket } = await supabase.from("brackets").select("id").eq("legacy_suffix", suffix).single();
    if (!bracket) return NextResponse.json({ error: "بطولة غير معروفة." }, { status: 400 });

    const { data: bannedRows } = await supabase.from("banned_entities").select("name, type");
    const banned = bannedRows || [];
    if (banned.some((b: any) => b.type === "team" && normalizeTeamName(b.name) === normalizeTeamName(teamName))) {
      return NextResponse.json({ error: `عذراً، فريق "${teamName}" مستبعد ولا يمكنه المشاركة في البطولة.` }, { status: 400 });
    }
    const bannedPlayer = players.find((p) => banned.some((b: any) => b.type === "player" && normalizeTeamName(b.name) === normalizeTeamName(p.name)));
    if (bannedPlayer) {
      return NextResponse.json({ error: `عذراً، اللاعب "${bannedPlayer.name}" مستبعد ولا يمكن تسجيله.` }, { status: 400 });
    }

    const { data: restrictedRows } = await supabase.from("restricted_players").select("name");
    const restricted = restrictedRows || [];
    const restrictedCount = players.filter((p) => restricted.some((r: any) => normalizeTeamName(r.name) === normalizeTeamName(p.name))).length;
    if (restrictedCount > 2) {
      return NextResponse.json({ error: `عذراً، لقد قمت بتسجيل ${restrictedCount} لاعبين من قائمة التقييد. الحد الأقصى المسموح به هو 2 لاعبين فقط في الفريق الواحد.` }, { status: 400 });
    }

    const normalizedId = teamName.trim().replace(/\s+/g, " ").toLowerCase();
    const slug = teamName.trim().replace(/\s+/g, "_").replace(/[^\p{L}\p{N}_-]/gu, "").slice(0, 80) || "team";

    const { data: roster, error: rosterErr } = await supabase
      .from("team_rosters")
      .upsert(
        {
          bracket_id: bracket.id,
          legacy_id: normalizedId,
          team_name: teamName,
          team_slug: slug,
          manager_name: managerName,
          manager_phone: managerPhone,
          coach_name: coachName,
          is_submitted: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "bracket_id,legacy_id" }
      )
      .select("id")
      .single();

    if (rosterErr || !roster) {
      console.error("Roster upsert failed:", rosterErr);
      return NextResponse.json({ error: "فشل حفظ بيانات الفريق." }, { status: 500 });
    }
    const rosterId = roster.id as string;

    // Update in place by slot rather than delete+reinsert, so a resubmit
    // (e.g. retrying after a photo upload failed) doesn't wipe photos that
    // already uploaded successfully against the previous player row ids.
    const { data: existingPlayers } = await supabase.from("roster_players").select("id, slot_index").eq("roster_id", rosterId);
    const existingBySlot = new Map((existingPlayers || []).map((p: any) => [p.slot_index, p.id as string]));

    const playerIds: string[] = [];
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const existingId = existingBySlot.get(i);
      if (existingId) {
        await supabase.from("roster_players").update({ name: p.name, number: p.number }).eq("id", existingId);
        playerIds.push(existingId);
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from("roster_players")
          .insert({ roster_id: rosterId, slot_index: i, name: p.name, number: p.number, personal_image_url: "", id_image_url: "" })
          .select("id")
          .single();
        if (insertErr || !inserted) {
          console.error("Roster player insert failed:", insertErr);
          return NextResponse.json({ error: "فشل حفظ بيانات اللاعبين." }, { status: 500 });
        }
        playerIds.push(inserted.id as string);
      }
    }

    const extraIds = [...existingBySlot.entries()].filter(([slot]) => slot >= players.length).map(([, id]) => id);
    if (extraIds.length) await supabase.from("roster_players").delete().in("id", extraIds);

    return NextResponse.json({ ok: true, teamId: normalizedId, rosterId, playerIds });
  } catch (error: any) {
    console.error("Roster submit error:", error);
    return NextResponse.json({ error: error?.message || "حدث خطأ أثناء حفظ القائمة." }, { status: 500 });
  }
}
