import test from "node:test";
import assert from "node:assert/strict";
import { buildStandings } from "../lib/sport/standings.ts";
import {
  computeEliteBracket,
  getEliteQualificationZone,
  isEliteGroupStageComplete,
} from "../lib/sport/elite-bracket.ts";

const teams = ["Team 1", "Team 2", "Team 3", "Team 4", "Team 5", "Team 6", "Team 7", "Team 8", "Team 9"];

function groupMatches() {
  const matches = [];
  const seen = new Set();
  for (let i = 0; i < teams.length; i += 1) {
    for (const offset of [1, 2]) {
      const j = (i + offset) % teams.length;
      const key = [i, j].sort((a, b) => a - b).join(":");
      if (!seen.has(key)) {
        seen.add(key);
        matches.push({
          team_a: teams[i],
          team_b: teams[j],
          home_goals: 1,
          away_goals: 0,
          status: "انتهت",
          stage: "group",
        });
      }
    }
  }
  return matches;
}

test("elite group completion requires 9 teams, 18 finished matches, and 4 appearances each", () => {
  const matches = groupMatches();
  assert.equal(matches.length, 18);
  assert.equal(isEliteGroupStageComplete(matches, teams), true);
  assert.equal(isEliteGroupStageComplete(matches.slice(0, -1), teams), false);
  assert.equal(isEliteGroupStageComplete(matches, teams.slice(0, -1)), false);
});

test("elite standings include registered teams before group matches exist", () => {
  const standings = buildStandings([], undefined, teams);
  assert.equal(standings.length, 9);
  assert.deepEqual(standings.map((row) => row.team), teams);
  assert.deepEqual(standings.map((row) => row.points), Array(9).fill(0));
});

test("elite ranking zones map 1-2, 3-6, and 7-9 correctly", () => {
  assert.equal(getEliteQualificationZone(1), "qualify");
  assert.equal(getEliteQualificationZone(2), "qualify");
  assert.equal(getEliteQualificationZone(3), "playoff");
  assert.equal(getEliteQualificationZone(6), "playoff");
  assert.equal(getEliteQualificationZone(7), "danger");
  assert.equal(getEliteQualificationZone(9), "danger");
});

test("elite bracket resolves playoff winners through the semifinal and final slots", () => {
  const standings = teams.map((team, index) => ({
    team,
    played: 4,
    won: 4 - index,
    drawn: 0,
    lost: index,
    goalsFor: 10 - index,
    goalsAgainst: index,
    points: 30 - index * 3,
  }));
  const matches = [
    { team_a: "Team 3", team_b: "Team 6", home_goals: 2, away_goals: 1, status: "انتهت", match_label: "P1" },
    { team_a: "Team 4", team_b: "Team 5", home_goals: 0, away_goals: 1, status: "انتهت", match_label: "P2" },
    { team_a: "Team 1", team_b: "Team 3", home_goals: 1, away_goals: 0, status: "انتهت", match_label: "SF1" },
    { team_a: "Team 2", team_b: "Team 5", home_goals: 0, away_goals: 2, status: "انتهت", match_label: "SF2" },
    { team_a: "Team 1", team_b: "Team 5", home_goals: 3, away_goals: 2, status: "انتهت", match_label: "FINAL" },
  ];

  const bracket = computeEliteBracket(standings, matches);
  assert.deepEqual(bracket.seeds, teams.slice(0, 6));
  assert.deepEqual([bracket.playoff1.teamA, bracket.playoff1.teamB], ["Team 3", "Team 6"]);
  assert.deepEqual([bracket.playoff2.teamA, bracket.playoff2.teamB], ["Team 4", "Team 5"]);
  assert.equal(bracket.playoff1.winner, "Team 3");
  assert.equal(bracket.playoff2.winner, "Team 5");
  assert.deepEqual([bracket.semi1.teamA, bracket.semi1.teamB], ["Team 1", "Team 3"]);
  assert.deepEqual([bracket.semi2.teamA, bracket.semi2.teamB], ["Team 2", "Team 5"]);
  assert.deepEqual([bracket.final.teamA, bracket.final.teamB], ["Team 1", "Team 5"]);
  assert.equal(bracket.final.winner, "Team 1");
});
