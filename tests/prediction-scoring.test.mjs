import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPredictionLeaderboard,
  getCountedPredictionIds,
  isValidPredictionScore,
  normalizePredictionPhone,
  resolvePredictionMatch,
  scorePrediction,
} from "../lib/sport/prediction-scoring.ts";

const bracketId = "bracket-elite";
const finished = {
  id: "match-1",
  legacy_id: "41",
  bracket_id: bracketId,
  status: "انتهت",
  is_live: false,
  home_goals: 2,
  away_goals: 1,
};
const prediction = (id, home_score, away_score, overrides = {}) => ({
  id,
  match_id: finished.id,
  bracket_id: bracketId,
  name: "مشارك",
  phone: "01012345678",
  home_score,
  away_score,
  submitted_at: "2026-10-10T09:00:00.000Z",
  ...overrides,
});

test("exact score awards exactly three points, without stacking winner points", () => {
  assert.deepEqual(scorePrediction({ home_score: 2, away_score: 1 }, finished), {
    outcome: "exact",
    points: 3,
    exact: true,
    correct: true,
  });
});

test("correct home win and draw award one point; a wrong away win awards zero", () => {
  assert.equal(scorePrediction({ home_score: 3, away_score: 0 }, finished).points, 1);
  assert.equal(scorePrediction({ home_score: 0, away_score: 1 }, finished).points, 0);
  assert.equal(scorePrediction({ home_score: 1, away_score: 1 }, { ...finished, home_goals: 0, away_goals: 0 }).points, 1);
  assert.equal(scorePrediction({ home_score: 2, away_score: 2 }, { ...finished, home_goals: 0, away_goals: 0 }).points, 1);
  assert.equal(scorePrediction({ home_score: 0, away_score: 1 }, { ...finished, home_goals: 1, away_goals: 2 }).points, 1);
});

test("wrong predictions receive zero and malformed predicted scores cannot match", () => {
  assert.deepEqual(scorePrediction({ home_score: 0, away_score: 2 }, finished), {
    outcome: "wrong",
    points: 0,
    exact: false,
    correct: false,
  });
  assert.equal(scorePrediction({ home_score: null, away_score: 1 }, finished).points, 0);
  assert.equal(isValidPredictionScore({ home_score: -1, away_score: 0 }), false);
  assert.equal(isValidPredictionScore({ home_score: 0, away_score: 100 }), true);
});

test("points remain pending until a completed non-live match has final integer scores", () => {
  const pending = { outcome: "pending", points: null, exact: false, correct: false };
  assert.deepEqual(scorePrediction({ home_score: 2, away_score: 1 }, { ...finished, status: "الشوط الثاني" }), pending);
  assert.deepEqual(scorePrediction({ home_score: 2, away_score: 1 }, { ...finished, status: "تأجلت" }), pending);
  assert.deepEqual(scorePrediction({ home_score: 2, away_score: 1 }, { ...finished, status: "ملغاة" }), pending);
  assert.deepEqual(scorePrediction({ home_score: 2, away_score: 1 }, { ...finished, is_live: true }), pending);
  assert.deepEqual(scorePrediction({ home_score: 2, away_score: 1 }, { ...finished, home_goals: null }), pending);
  assert.deepEqual(scorePrediction({ home_score: 2, away_score: 1 }, null), pending);
});

test("legacy prediction match IDs resolve only to one matching legacy match", () => {
  assert.equal(resolvePredictionMatch({ match_id: "41" }, [finished]), finished);
  assert.equal(resolvePredictionMatch({ match_id: "41" }, [finished, { ...finished, id: "other" }]), null);
  assert.equal(resolvePredictionMatch({ match_id: "missing" }, [finished]), null);
});

test("phone identity normalization joins country-code variants without using names", () => {
  assert.equal(normalizePredictionPhone("+20 101-234-5678"), "01012345678");
  assert.equal(normalizePredictionPhone("0020 101 234 5678"), "01012345678");
  assert.equal(normalizePredictionPhone(""), "");
});

test("leaderboard groups stable phone identities and accumulates finalized points only", () => {
  const secondFinished = { ...finished, id: "match-2", legacy_id: "42" };
  const thirdFinished = { ...finished, id: "match-4", legacy_id: "44" };
  const pendingMatch = {
    ...finished,
    id: "match-3",
    legacy_id: "43",
    status: "لم تبدأ",
    home_goals: null,
    away_goals: null,
  };
  const rows = [
    prediction("one", 2, 1, { name: "الاسم الأول", submitted_at: "2026-10-10T09:00:00.000Z" }),
    prediction("two", 4, 0, { name: "اسم مختلف", match_id: "match-2", submitted_at: "2026-10-10T10:00:00.000Z" }),
    prediction("three", 2, 1, { phone: "0020 101 234 5678", match_id: "match-4", submitted_at: "2026-10-10T11:00:00.000Z" }),
    prediction("waiting", 2, 1, {
      phone: "01098765432",
      match_id: "match-3",
      submitted_at: "2026-10-10T12:00:00.000Z",
    }),
  ];
  const result = buildPredictionLeaderboard(rows, [finished, secondFinished, pendingMatch, thirdFinished], bracketId);
  assert.deepEqual(result, [
    { rank: 1, name: "الاسم الأول", points: 7, exactPredictions: 2, correctPredictions: 3, totalPredictions: 3 },
    { rank: 2, name: "مشارك", points: 0, exactPredictions: 0, correctPredictions: 0, totalPredictions: 1 },
  ]);
});

test("only the earliest prediction per participant and match contributes points", () => {
  const rows = [
    prediction("first", 0, 2, { phone: "01000000001", name: "المشارك", submitted_at: "2026-10-10T09:00:00.000Z" }),
    prediction("later-exact", 2, 1, { phone: "+20 100 000 0001", name: "اسم مختلف", submitted_at: "2026-10-10T10:00:00.000Z" }),
  ];
  assert.deepEqual([...getCountedPredictionIds(rows, [finished])], ["first"]);
  assert.deepEqual([...getCountedPredictionIds([...rows].reverse(), [finished])], ["first"]);
  assert.deepEqual(buildPredictionLeaderboard(rows, [finished], bracketId), [
    { rank: 1, name: "المشارك", points: 0, exactPredictions: 0, correctPredictions: 0, totalPredictions: 1 },
  ]);
  const sameTimeRows = [
    prediction("b", 2, 1, { phone: "01000000002", submitted_at: "2026-10-10T09:00:00.000Z" }),
    prediction("a", 0, 2, { phone: "01000000002", submitted_at: "2026-10-10T09:00:00.000Z" }),
  ];
  assert.deepEqual([...getCountedPredictionIds(sameTimeRows, [finished])], ["a"]);
});

test("an invalid earlier score does not block a later valid forecast", () => {
  const rows = [
    prediction("invalid-first", -1, 0, { phone: "01000000001", submitted_at: "2026-10-10T09:00:00.000Z" }),
    prediction("valid-later", 2, 1, { phone: "01000000001", submitted_at: "2026-10-10T10:00:00.000Z" }),
  ];
  assert.deepEqual([...getCountedPredictionIds(rows, [finished])], ["valid-later"]);
  assert.deepEqual(buildPredictionLeaderboard(rows, [finished], bracketId), [
    { rank: 1, name: "مشارك", points: 3, exactPredictions: 1, correctPredictions: 1, totalPredictions: 1 },
  ]);
});

test("leaderboard tie-breaks by points, exact scores, correct scores, then earliest entry", () => {
  const rows = [
    prediction("later", 3, 0, { name: "المشارك اللاحق", phone: "01000000002", submitted_at: "2026-10-10T10:00:00.000Z" }),
    prediction("earlier", 3, 0, { name: "المشارك الأسبق", phone: "01000000001", submitted_at: "2026-10-10T09:00:00.000Z" }),
    prediction("exact", 2, 1, { name: "صاحب النتيجة الدقيقة", phone: "01000000003", submitted_at: "2026-10-10T11:00:00.000Z" }),
  ];
  const ranked = buildPredictionLeaderboard(rows, [finished], bracketId);
  assert.deepEqual(ranked.map(({ name, rank, points, exactPredictions, correctPredictions }) =>
    [name, rank, points, exactPredictions, correctPredictions]), [
    ["صاحب النتيجة الدقيقة", 1, 3, 1, 1],
    ["المشارك الأسبق", 2, 1, 0, 1],
    ["المشارك اللاحق", 3, 1, 0, 1],
  ]);
});

test("exact prediction wins a points tie against three one-point correct predictions", () => {
  const secondFinished = { ...finished, id: "match-2", legacy_id: "42" };
  const thirdFinished = { ...finished, id: "match-3", legacy_id: "43" };
  const rows = [
    prediction("exact-three", 2, 1, { phone: "01000000003", name: "نتيجة دقيقة" }),
    prediction("correct-one", 3, 0, { phone: "01000000004", name: "توقع أول" }),
    prediction("correct-two", 4, 1, { phone: "01000000004", name: "توقع ثان", match_id: "match-2", submitted_at: "2026-10-10T09:01:00.000Z" }),
    prediction("correct-three", 5, 2, { phone: "01000000004", name: "توقع ثالث", match_id: "match-3", submitted_at: "2026-10-10T09:02:00.000Z" }),
  ];
  const ranked = buildPredictionLeaderboard(rows, [finished, secondFinished, thirdFinished], bracketId);
  assert.deepEqual(ranked.map(({ name, points, exactPredictions }) => [name, points, exactPredictions]), [
    ["نتيجة دقيقة", 3, 1],
    ["توقع أول", 3, 0],
  ]);
});

test("same-time ranking ties are deterministic and independent of input order", () => {
  const rows = [
    prediction("tie-a", 3, 0, { name: "الأول", phone: "01000000001" }),
    prediction("tie-b", 3, 0, { name: "الثاني", phone: "01000000002" }),
  ];
  assert.deepEqual(
    buildPredictionLeaderboard(rows, [finished], bracketId),
    buildPredictionLeaderboard([...rows].reverse(), [finished], bracketId),
  );
});

test("leaderboard excludes legacy rows without a stable participant identity", () => {
  const rows = [
    prediction("legacy-a", 2, 1, { phone: null, name: "اسم متكرر" }),
    prediction("legacy-b", 2, 1, { phone: null, name: "اسم متكرر" }),
  ];
  assert.deepEqual([...getCountedPredictionIds(rows, [finished])], []);
  assert.deepEqual(buildPredictionLeaderboard(rows, [finished], bracketId), []);
});

test("leaderboard exposes every participant, including more than one hundred with zero points", () => {
  const rows = Array.from({ length: 125 }, (_, index) => prediction(
    `participant-${index}`,
    0,
    0,
    { phone: `010${String(index).padStart(8, "0")}`, name: `مشارك ${index}` },
  ));
  const pendingMatch = { ...finished, status: "لم تبدأ", home_goals: null, away_goals: null };
  const result = buildPredictionLeaderboard(rows, [pendingMatch], bracketId);
  assert.equal(result.length, 125);
  assert.equal(result.at(-1).rank, 125);
  assert.ok(result.every((entry) => entry.points === 0));
});

test("leaderboard isolates match-linked predictions and includes bracket-linked orphan participants at zero", () => {
  const otherMatch = { ...finished, id: "other-match", legacy_id: "other", bracket_id: "bracket-other" };
  const rows = [
    prediction("other-bracket", 2, 1, { match_id: "other", phone: "01000000001", bracket_id: "bracket-elite" }),
    prediction("orphan", 2, 1, { match_id: "missing", phone: "01000000002", bracket_id: "bracket-elite" }),
  ];
  assert.deepEqual(buildPredictionLeaderboard(rows, [finished, otherMatch], bracketId), [
    { rank: 1, name: "مشارك", points: 0, exactPredictions: 0, correctPredictions: 0, totalPredictions: 1 },
  ]);
});

test("the same participant receives independent predictions and points in two brackets", () => {
  const otherMatch = { ...finished, id: "other-match", legacy_id: "other", bracket_id: "bracket-other", home_goals: 0, away_goals: 1 };
  const rows = [
    prediction("elite", 2, 1, { phone: "01012345678", name: "مشارك" }),
    prediction("other", 0, 1, { match_id: "other", bracket_id: "bracket-other", phone: "01012345678", name: "مشارك" }),
  ];
  assert.deepEqual(buildPredictionLeaderboard(rows, [finished, otherMatch], bracketId), [
    { rank: 1, name: "مشارك", points: 3, exactPredictions: 1, correctPredictions: 1, totalPredictions: 1 },
  ]);
  assert.deepEqual(buildPredictionLeaderboard(rows, [finished, otherMatch], "bracket-other"), [
    { rank: 1, name: "مشارك", points: 3, exactPredictions: 1, correctPredictions: 1, totalPredictions: 1 },
  ]);
});
