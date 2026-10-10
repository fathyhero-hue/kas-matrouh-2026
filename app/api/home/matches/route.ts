import { NextResponse } from "next/server";
import { getHomeMatchSections, type ScheduledMatch } from "@/lib/sport/home-match-schedule";
import { TOURNAMENTS, type TournamentSlug } from "@/lib/sport/tournaments";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getBracketTeamLogos, lookupTeamLogo } from "@/lib/sport/roster-link";

export const runtime = "nodejs";
const PAGE_SIZE = 1000;

function resolveTournament(legacySuffix: string | null) {
  for (const slug of Object.keys(TOURNAMENTS) as TournamentSlug[]) {
    const tournament = TOURNAMENTS[slug];
    const edition = tournament.editions.find((item) => item.suffix === legacySuffix);
    if (!edition) continue;
    const query = edition.key === tournament.defaultEdition ? "" : `?edition=${edition.key}`;
    return {
      label: tournament.editions.length > 1 ? `${tournament.label} — ${edition.label}` : tournament.label,
      href: `/${slug}${query}`,
    };
  }
  return { label: "بطولة أخرى", href: null };
}

export async function GET() {
  try {
    const supabase = createServiceRoleClient();
    const rows = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from("matches")
        .select("id, bracket_id, team_a, team_a_logo, team_b, team_b_logo, match_date, match_time, status, is_live, home_goals, away_goals, round, live_minute, live_minute_base, timer_started_at, timer_paused_total, is_timer_running, brackets(legacy_suffix)")
        .order("match_date", { ascending: true })
        .order("match_time", { ascending: true })
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      rows.push(...(data || []));
      if (!data || data.length < PAGE_SIZE) break;
    }

    const matches: ScheduledMatch[] = rows.map((row) => {
      const bracket = Array.isArray(row.brackets) ? row.brackets[0] : row.brackets;
      const tournament = resolveTournament(bracket?.legacy_suffix || null);
      return {
        id: row.id,
        bracket_id: row.bracket_id,
        team_a: row.team_a,
        team_a_logo: row.team_a_logo,
        team_b: row.team_b,
        team_b_logo: row.team_b_logo,
        match_date: row.match_date,
        match_time: row.match_time,
        status: row.status,
        is_live: row.is_live,
        home_goals: row.home_goals,
        away_goals: row.away_goals,
        round: row.round,
        live_minute: row.live_minute,
        live_minute_base: row.live_minute_base,
        timer_started_at: row.timer_started_at,
        timer_paused_total: row.timer_paused_total,
        is_timer_running: row.is_timer_running,
        tournament_label: tournament.label,
        tournament_href: tournament.href,
      };
    });
    const sections = getHomeMatchSections(matches, new Date());
    const relevant = [...sections.broadcastMatches, ...sections.upcomingMatches];
    const liveMatchIds = sections.broadcastMatches
      .filter((match) => match.broadcastState === "live")
      .map((match) => match.id);
    const logosByBracket = new Map<string, Map<string, string>>();
    await Promise.all([...new Set(relevant.map((match) => match.bracket_id))].map(async (bracketId) => {
      logosByBracket.set(bracketId, await getBracketTeamLogos(supabase, bracketId));
    }));
    const eventsByMatch = new Map<string, NonNullable<ScheduledMatch["events"]>>();
    if (liveMatchIds.length) {
      const [goalsQuery, cardsQuery] = await Promise.all([
        supabase.from("match_goal_events")
          .select("id, match_id, team_roster_id, roster_player_id, event_type, match_minute")
          .in("match_id", liveMatchIds)
          .is("revoked_at", null),
        supabase.from("card_events")
          .select("id, match_id, team_roster_id, roster_player_id, card_type, match_minute")
          .in("match_id", liveMatchIds),
      ]);
      if (goalsQuery.error) throw goalsQuery.error;
      if (cardsQuery.error) throw cardsQuery.error;
      const rows = [
        ...(goalsQuery.data || []).map((event) => ({ ...event, event_type: "goal" as const })),
        ...(cardsQuery.data || []).map((event) => ({ ...event, event_type: event.card_type as "yellow" | "direct_red" | "second_yellow_red" })),
      ];
      const teamIds = [...new Set(rows.map((event) => event.team_roster_id))];
      const playerIds = [...new Set(rows.map((event) => event.roster_player_id))];
      const [teamsQuery, playersQuery] = await Promise.all([
        teamIds.length
          ? supabase.from("team_rosters").select("id, team_name").in("id", teamIds)
          : Promise.resolve({ data: [], error: null }),
        playerIds.length
          ? supabase.from("roster_players").select("id, name").in("id", playerIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (teamsQuery.error) throw teamsQuery.error;
      if (playersQuery.error) throw playersQuery.error;
      const teamById = new Map((teamsQuery.data || []).map((team) => [team.id, team.team_name || "فريق غير معروف"]));
      const playerById = new Map((playersQuery.data || []).map((player) => [player.id, player.name || "لاعب غير معروف"]));
      for (const row of rows) {
        const events = eventsByMatch.get(row.match_id) ?? [];
        events.push({
          id: row.id,
          event_type: row.event_type,
          team_name: teamById.get(row.team_roster_id) || "فريق غير معروف",
          player_name: playerById.get(row.roster_player_id) || "لاعب غير معروف",
          match_minute: row.match_minute,
        });
        eventsByMatch.set(row.match_id, events);
      }
      for (const events of eventsByMatch.values()) {
        events.sort((left, right) => (left.match_minute ?? 999) - (right.match_minute ?? 999));
      }
    }
    const withLogos = <T extends ScheduledMatch>(match: T) => ({
      ...match,
      team_a_logo: lookupTeamLogo(logosByBracket.get(match.bracket_id) || new Map(), match.team_a) || match.team_a_logo,
      team_b_logo: lookupTeamLogo(logosByBracket.get(match.bracket_id) || new Map(), match.team_b) || match.team_b_logo,
      events: eventsByMatch.get(match.id) || [],
    });
    const relevantIds = relevant.map((match) => match.id);
    if (relevantIds.length) {
      const venues = await supabase.from("matches").select("id, venue").in("id", relevantIds);
      if (venues.error) {
        const missingVenueColumn = venues.error.code === "42703" ||
          venues.error.code === "PGRST204" ||
          /column .*venue.* does not exist|could not find the ['"]venue['"] column/i.test(venues.error.message);
        if (!missingVenueColumn) throw venues.error;
        console.warn("The optional matches.venue column is not available yet; serving schedules without venues.");
      } else {
        const venueById = new Map((venues.data || []).map((row) => [row.id, row.venue]));
        for (const match of relevant) match.venue = venueById.get(match.id) || null;
      }
    }

    return NextResponse.json({
      broadcastMatches: sections.broadcastMatches.map(withLogos),
      upcomingMatches: sections.upcomingMatches.map(withLogos),
      updatedAt: new Date().toISOString(),
    }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("Home match schedule query failed:", error);
    return NextResponse.json({ error: "تعذر تحميل مواعيد المباريات." }, { status: 500 });
  }
}
