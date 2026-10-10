import assert from "node:assert/strict";
import test from "node:test";
import { isPredictionOpen, validatePrediction } from "../lib/sport/predictions.ts";

test("prediction validation accepts bounded scores and valid Egyptian mobile numbers", () => {
  assert.deepEqual(validatePrediction({
    name: "محمد علي",
    phone: "01012345678",
    homeScore: "0",
    awayScore: "99",
  }), { name: "", phone: "", homeScore: "", awayScore: "" });
});

test("prediction validation rejects invalid identity and scores outside 0-99", () => {
  assert.deepEqual(validatePrediction({
    name: "م",
    phone: "123",
    homeScore: "-1",
    awayScore: "100",
  }), {
    name: "اكتب الاسم (حرفان على الأقل).",
    phone: "اكتب رقم موبايل مصري صحيح.",
    homeScore: "أدخل نتيجة الفريق الأول من 0 إلى 99.",
    awayScore: "أدخل نتيجة الفريق الثاني من 0 إلى 99.",
  });
});

test("predictions are open only before kickoff for matches that have not started", () => {
  const now = new Date("2026-10-10T09:00:00.000Z");
  const match = {
    match_date: "2026-10-10",
    match_time: "13:00:00",
    status: "لم تبدأ",
    is_live: false,
  };
  assert.equal(isPredictionOpen(match, now), true);
  assert.equal(isPredictionOpen({ ...match, match_time: "12:00:00" }, now), false);
  assert.equal(isPredictionOpen({ ...match, status: "الشوط الأول" }, now), false);
  assert.equal(isPredictionOpen({ ...match, is_live: true }, now), false);
  assert.equal(isPredictionOpen({ ...match, match_time: null }, now), false);
});
