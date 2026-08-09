import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

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

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const suffix = String(form.get("suffix") || "");
    const teamName = String(form.get("teamName") || "").trim();
    const managerName = String(form.get("managerName") || "");
    const managerPhone = String(form.get("managerPhone") || "");
    const logoUrl = String(form.get("logoUrl") || "");
    const players = JSON.parse(String(form.get("players") || "[]")) as Array<{ name: string; number: string }>;

    if (!teamName || !managerName.trim() || !managerPhone.trim() || !players.length) {
      return NextResponse.json({ error: "بيانات القائمة غير مكتملة." }, { status: 400 });
    }
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p.name?.trim() || !p.number?.trim()) {
        return NextResponse.json({ error: `الرجاء ملء بيانات جميع اللاعبين. اللاعب رقم ${i + 1} بياناته ناقصة.` }, { status: 400 });
      }
      const personalFile = form.get(`player_${i}_personal`) as File | null;
      const idFile = form.get(`player_${i}_id`) as File | null;
      if (!personalFile || !idFile) {
        return NextResponse.json({ error: `الرجاء إرفاق الصورة الشخصية وصورة البطاقة للاعب ${p.name || i + 1}.` }, { status: 400 });
      }
      if (personalFile.size > MAX_PHOTO_BYTES || idFile.size > MAX_PHOTO_BYTES) {
        return NextResponse.json({ error: `حجم صور اللاعب ${p.name || i + 1} كبير جداً (أقصى حد 2 ميجا لكل صورة).` }, { status: 400 });
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

    const normalizedId = teamName
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
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
          logo_url: logoUrl || null,
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

    const playerRows: any[] = [];
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      let personalUrl = "";
      let idUrl = "";

      const personalFile = form.get(`player_${i}_personal`) as File | null;
      if (personalFile) {
        const path = `${normalizedId}/player_${i}_personal_${Date.now()}`;
        const { error } = await supabase.storage.from("roster-photos").upload(path, personalFile, { contentType: personalFile.type, upsert: true });
        if (!error) {
          const { data: signed } = await supabase.storage.from("roster-photos").createSignedUrl(path, 60 * 60 * 24 * 365);
          personalUrl = signed?.signedUrl || path;
        }
      }
      const idFile = form.get(`player_${i}_id`) as File | null;
      if (idFile) {
        const path = `${normalizedId}/player_${i}_id_${Date.now()}`;
        const { error } = await supabase.storage.from("roster-photos").upload(path, idFile, { contentType: idFile.type, upsert: true });
        if (!error) {
          const { data: signed } = await supabase.storage.from("roster-photos").createSignedUrl(path, 60 * 60 * 24 * 365);
          idUrl = signed?.signedUrl || path;
        }
      }

      playerRows.push({ roster_id: rosterId, slot_index: i, name: p.name, number: p.number, personal_image_url: personalUrl, id_image_url: idUrl });
    }

    await supabase.from("roster_players").delete().eq("roster_id", rosterId);
    await supabase.from("roster_players").insert(playerRows);

    return NextResponse.json({ ok: true, teamId: normalizedId });
  } catch (error: any) {
    console.error("Roster submit error:", error);
    return NextResponse.json({ error: error?.message || "حدث خطأ أثناء حفظ القائمة." }, { status: 500 });
  }
}
