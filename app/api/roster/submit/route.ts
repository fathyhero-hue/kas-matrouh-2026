import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RosterPlayerInput = { name?: unknown; number?: unknown };
type RosterPlayer = { name: string; number: string };

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
  const requestId = randomUUID();
  let stage = "parse-request";

  try {
    let body: Record<string, unknown>;
    try {
      const parsed: unknown = await req.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const suffix = String(body.suffix || "");
    const teamName = String(body.teamName || "").trim();
    const managerName = String(body.managerName || "");
    const managerPhone = String(body.managerPhone || "");
    const coachName = String(body.coachName || "").trim();
    const playersInput = (Array.isArray(body.players) ? body.players : []) as RosterPlayerInput[];
    const players: RosterPlayer[] = [];

    if (!teamName || !managerName.trim() || !managerPhone.trim()) {
      return NextResponse.json({ error: "بيانات القائمة غير مكتملة." }, { status: 400 });
    }
    // Rosters no longer need to be full — a team can submit any number of
    // players and complete the rest later (before the registration
    // deadline). Blank slots are simply skipped; a slot with only one of
    // name/number filled in is still a real mistake worth catching.
    let filledCount = 0;
    for (let i = 0; i < playersInput.length; i++) {
      const p = playersInput[i];
      if (!p || typeof p !== "object" || Array.isArray(p)) {
        return NextResponse.json({ error: `Invalid player data at slot ${i + 1}.` }, { status: 400 });
      }
      const name = typeof p.name === "string" ? p.name.trim() : "";
      const number = typeof p.number === "string" ? p.number.trim() : "";
      const hasName = !!name;
      const hasNumber = !!number;
      players[i] = { name, number };
      if (!hasName && !hasNumber) continue;
      if (!hasName || !hasNumber) {
        return NextResponse.json({ error: `الرجاء إكمال اسم ورقم اللاعب رقم ${i + 1}.` }, { status: 400 });
      }
      filledCount++;
    }
    if (filledCount === 0) {
      return NextResponse.json({ error: "الرجاء تسجيل لاعب واحد على الأقل." }, { status: 400 });
    }

    const supabase = createServiceRoleClient();

    stage = "lookup-bracket";
    const { data: bracket, error: bracketErr } = await supabase.from("brackets").select("id").eq("legacy_suffix", suffix).single();
    if (bracketErr) {
      logDatabaseError(requestId, stage, bracketErr);
      return databaseFailure(requestId);
    }
    if (!bracket) return NextResponse.json({ error: "بطولة غير معروفة." }, { status: 400 });

    stage = "check-restrictions";
    const { data: bannedRows, error: bannedErr } = await supabase.from("banned_entities").select("name, type");
    if (bannedErr) {
      logDatabaseError(requestId, stage, bannedErr);
      return databaseFailure(requestId);
    }
    const banned = (bannedRows || []) as { name: string; type: string }[];
    if (banned.some((b) => b.type === "team" && normalizeTeamName(b.name) === normalizeTeamName(teamName))) {
      return NextResponse.json({ error: `عذراً، فريق "${teamName}" مستبعد ولا يمكنه المشاركة في البطولة.` }, { status: 400 });
    }
    const bannedPlayer = players.find((p) => p.name && banned.some((b) => b.type === "player" && normalizeTeamName(b.name) === normalizeTeamName(p.name)));
    if (bannedPlayer) {
      return NextResponse.json({ error: `عذراً، اللاعب "${bannedPlayer.name}" مستبعد ولا يمكن تسجيله.` }, { status: 400 });
    }

    const { data: restrictedRows, error: restrictedErr } = await supabase.from("restricted_players").select("name");
    if (restrictedErr) {
      logDatabaseError(requestId, stage, restrictedErr);
      return databaseFailure(requestId);
    }
    const restricted = (restrictedRows || []) as { name: string }[];
    const restrictedCount = players.filter((p) => p.name && restricted.some((r) => normalizeTeamName(r.name) === normalizeTeamName(p.name))).length;
    if (restrictedCount > 2) {
      return NextResponse.json({ error: `عذراً، لقد قمت بتسجيل ${restrictedCount} لاعبين من قائمة التقييد. الحد الأقصى المسموح به هو 2 لاعبين فقط في الفريق الواحد.` }, { status: 400 });
    }

    const normalizedId = teamName.trim().replace(/\s+/g, " ").toLowerCase();
    const slug = teamName.trim().replace(/\s+/g, "_").replace(/[^\p{L}\p{N}_-]/gu, "").slice(0, 80) || "team";

    stage = "upsert-roster";
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
        { onConflict: "bracket_id,team_slug" }
      )
      .select("id")
      .single();

    if (rosterErr || !roster) {
      logDatabaseError(requestId, stage, rosterErr);
      if (rosterErr?.code === "23505" && rosterErr.message?.includes("team_rosters_bracket_id_team_slug_key")) {
        return NextResponse.json({ error: "يوجد فريق مسجل بهذا الاسم في البطولة بالفعل.", requestId }, { status: 409 });
      }
      return databaseFailure(requestId);
    }
    const rosterId = roster.id as string;

    // Update in place by slot rather than delete+reinsert, so a resubmit
    // (e.g. retrying after a photo upload failed) doesn't wipe photos that
    // already uploaded successfully against the previous player row ids.
    stage = "lookup-existing-players";
    const { data: existingPlayers, error: existingPlayersErr } = await supabase.from("roster_players").select("id, slot_index").eq("roster_id", rosterId);
    if (existingPlayersErr) {
      logDatabaseError(requestId, stage, existingPlayersErr);
      return databaseFailure(requestId);
    }
    const existingBySlot = new Map((existingPlayers || []).map((p) => [p.slot_index, p.id]));

    const playerIds: string[] = [];
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const existingId = existingBySlot.get(i);
      if (existingId) {
        stage = "update-player";
        const { error: updateErr } = await supabase.from("roster_players").update({ name: p.name, number: p.number }).eq("id", existingId);
        if (updateErr) {
          logDatabaseError(requestId, stage, updateErr);
          return databaseFailure(requestId);
        }
        playerIds.push(existingId);
      } else {
        stage = "insert-player";
        const { data: inserted, error: insertErr } = await supabase
          .from("roster_players")
          .insert({ roster_id: rosterId, slot_index: i, name: p.name, number: p.number, personal_image_url: "", id_image_url: "" })
          .select("id")
          .single();
        if (insertErr || !inserted) {
          logDatabaseError(requestId, stage, insertErr);
          return databaseFailure(requestId);
        }
        playerIds.push(inserted.id as string);
      }
    }

    const extraIds = [...existingBySlot.entries()].filter(([slot]) => slot >= players.length).map(([, id]) => id);
    if (extraIds.length) {
      stage = "delete-removed-players";
      const { error: deleteErr } = await supabase.from("roster_players").delete().in("id", extraIds);
      if (deleteErr) {
        logDatabaseError(requestId, stage, deleteErr);
        return databaseFailure(requestId);
      }
    }

    return NextResponse.json({ ok: true, teamId: normalizedId, rosterId, playerIds });
  } catch (error: unknown) {
    logDatabaseError(requestId, stage, error);
    return databaseFailure(requestId);
  }
}

function logDatabaseError(requestId: string, stage: string, error: unknown) {
  const value = error && typeof error === "object" ? error as Record<string, unknown> : {};
  console.error("Roster submission failed", {
    requestId,
    stage,
    code: typeof value.code === "string" ? value.code : null,
    message: typeof value.message === "string" ? value.message : String(error),
    details: typeof value.details === "string" ? value.details : null,
    hint: typeof value.hint === "string" ? value.hint : null,
  });
}

function databaseFailure(requestId: string) {
  return NextResponse.json(
    { error: "تعذر حفظ القائمة مؤقتًا. أعد المحاولة لاحقًا، وأرسل رقم البلاغ للدعم إذا استمرت المشكلة.", requestId },
    { status: 500 }
  );
}
