import { createHash } from "node:crypto";

export type PredictionRecord = {
  id: string;
  match_id: string;
  bracket_id?: string | null;
  match_name?: string | null;
  name: string | null;
  phone: string | null;
  home_score: number | null;
  away_score: number | null;
  submitted_at: string | null;
};

export type PredictionMatch = {
  id: string;
  legacy_id?: string | null;
  bracket_id: string | null;
  team_a?: string | null;
  team_b?: string | null;
  match_date?: string | null;
  match_time?: string | null;
  status: string | null;
  is_live?: boolean | null;
  home_goals: number | null;
  away_goals: number | null;
};

export type PredictionOutcome = "pending" | "exact" | "correct" | "wrong" | "duplicate" | "unmatched" | "invalid";
export type PredictionScore = {
  outcome: PredictionOutcome;
  points: number | null;
  exact: boolean;
  correct: boolean;
};

export type PredictionLeaderboardEntry = {
  rank: number;
  name: string;
  points: number;
  exactPredictions: number;
  correctPredictions: number;
  totalPredictions: number;
};

const FINISHED_STATUS = "انتهت";

export function normalizePredictionPhone(phone: string | null | undefined): string {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("0020")) digits = `0${digits.slice(4)}`;
  else if (digits.startsWith("20") && digits.length === 12) digits = `0${digits.slice(2)}`;
  return digits;
}

export function isValidPredictionScore(
  prediction: Pick<PredictionRecord, "home_score" | "away_score">,
): boolean {
  return [prediction.home_score, prediction.away_score].every(
    (score) => score !== null && Number.isInteger(score) && score >= 0,
  );
}

export function resolvePredictionMatch(
  prediction: Pick<PredictionRecord, "match_id">,
  matches: readonly PredictionMatch[],
): PredictionMatch | null {
  return createPredictionMatchResolver(matches)(prediction);
}

export function createPredictionMatchResolver(matches: readonly PredictionMatch[]) {
  const byId = new Map(matches.map((match) => [match.id, match]));
  const byLegacyId = new Map<string, PredictionMatch>();
  const ambiguousLegacyIds = new Set<string>();
  for (const match of matches) {
    if (!match.legacy_id) continue;
    if (byLegacyId.has(match.legacy_id)) {
      ambiguousLegacyIds.add(match.legacy_id);
      byLegacyId.delete(match.legacy_id);
    } else if (!ambiguousLegacyIds.has(match.legacy_id)) {
      byLegacyId.set(match.legacy_id, match);
    }
  }

  return (prediction: Pick<PredictionRecord, "match_id">): PredictionMatch | null => {
    const matchId = String(prediction.match_id);
    return byId.get(matchId) || (ambiguousLegacyIds.has(matchId) ? null : byLegacyId.get(matchId) || null);
  };
}

export function scorePrediction(
  prediction: Pick<PredictionRecord, "home_score" | "away_score">,
  match: PredictionMatch | null,
): PredictionScore {
  if (
    !match ||
    match.status?.trim() !== FINISHED_STATUS ||
    match.is_live === true ||
    !Number.isInteger(match.home_goals) ||
    !Number.isInteger(match.away_goals) ||
    (match.home_goals ?? -1) < 0 ||
    (match.away_goals ?? -1) < 0
  ) {
    return { outcome: "pending", points: null, exact: false, correct: false };
  }

  const exact =
    prediction.home_score === match.home_goals &&
    prediction.away_score === match.away_goals;
  if (exact) return { outcome: "exact", points: 3, exact: true, correct: true };

  const validPrediction =
    Number.isInteger(prediction.home_score) &&
    Number.isInteger(prediction.away_score) &&
    (prediction.home_score ?? -1) >= 0 &&
    (prediction.away_score ?? -1) >= 0;
  const predictedOutcome = validPrediction
    ? Math.sign((prediction.home_score ?? 0) - (prediction.away_score ?? 0))
    : null;
  const actualOutcome = Math.sign((match.home_goals ?? 0) - (match.away_goals ?? 0));
  const correct = predictedOutcome !== null && predictedOutcome === actualOutcome;
  return { outcome: correct ? "correct" : "wrong", points: correct ? 1 : 0, exact: false, correct };
}

function compareStableStrings(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function predictionTimestamp(prediction: Pick<PredictionRecord, "submitted_at">) {
  const timestamp = prediction.submitted_at ? Date.parse(prediction.submitted_at) : Number.POSITIVE_INFINITY;
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

function participantIdentity(prediction: PredictionRecord) {
  return `phone:${normalizePredictionPhone(prediction.phone)}`;
}

export function getCountedPredictionIds(
  predictions: readonly PredictionRecord[],
  matches: readonly PredictionMatch[],
): Set<string> {
  const resolveMatch = createPredictionMatchResolver(matches);
  const ordered = [...predictions].sort((left, right) =>
    predictionTimestamp(left) - predictionTimestamp(right) ||
    compareStableStrings(left.id, right.id),
  );
  const counted = new Set<string>();
  const seenParticipantMatches = new Set<string>();

  for (const prediction of ordered) {
    if (!isValidPredictionScore(prediction) || !normalizePredictionPhone(prediction.phone)) continue;
    const match = resolveMatch(prediction);
    if (!match && !prediction.bracket_id) continue;
    const matchKey = match
      ? JSON.stringify([match.bracket_id, match.id])
      : JSON.stringify([prediction.bracket_id, prediction.match_id]);
    const pair = JSON.stringify([participantIdentity(prediction), matchKey]);
    if (seenParticipantMatches.has(pair)) continue;
    seenParticipantMatches.add(pair);
    counted.add(prediction.id);
  }

  return counted;
}

type ParticipantTotal = {
  identityKey: string;
  tieKey: string;
  firstSubmittedAt: number;
  firstPredictionId: string;
  name: string;
  points: number;
  exactPredictions: number;
  correctPredictions: number;
  totalPredictions: number;
};

export function buildPredictionLeaderboard(
  predictions: readonly PredictionRecord[],
  matches: readonly PredictionMatch[],
  bracketId: string,
): PredictionLeaderboardEntry[] {
  const totals = new Map<string, ParticipantTotal>();
  const resolveMatch = createPredictionMatchResolver(matches);
  const countedIds = getCountedPredictionIds(predictions, matches);

  for (const prediction of predictions) {
    if (!countedIds.has(prediction.id)) continue;
    const match = resolveMatch(prediction);
    if (match ? match.bracket_id !== bracketId : prediction.bracket_id !== bracketId) continue;

    const identityKey = participantIdentity(prediction);
    const timestamp = predictionTimestamp(prediction);
    const score = scorePrediction(prediction, match);
    let total = totals.get(identityKey);

    if (!total) {
      total = {
        identityKey,
        tieKey: createHash("sha256").update(identityKey).digest("hex"),
        firstSubmittedAt: timestamp,
        firstPredictionId: prediction.id,
        name: prediction.name?.trim() || "مشارك",
        points: 0,
        exactPredictions: 0,
        correctPredictions: 0,
        totalPredictions: 0,
      };
      totals.set(identityKey, total);
    } else if (
      timestamp < total.firstSubmittedAt ||
      (timestamp === total.firstSubmittedAt && compareStableStrings(prediction.id, total.firstPredictionId) < 0)
    ) {
      total.firstSubmittedAt = timestamp;
      total.firstPredictionId = prediction.id;
      total.name = prediction.name?.trim() || "مشارك";
    }

    total.totalPredictions += 1;
    total.points += score.points ?? 0;
    if (score.exact) total.exactPredictions += 1;
    if (score.correct) total.correctPredictions += 1;
  }

  return [...totals.values()]
    .sort((left, right) =>
      right.points - left.points ||
      right.exactPredictions - left.exactPredictions ||
      right.correctPredictions - left.correctPredictions ||
      left.firstSubmittedAt - right.firstSubmittedAt ||
      compareStableStrings(left.tieKey, right.tieKey),
    )
    .map(({ name, points, exactPredictions, correctPredictions, totalPredictions }, index) => ({
      rank: index + 1,
      name,
      points,
      exactPredictions,
      correctPredictions,
      totalPredictions,
    }));
}
