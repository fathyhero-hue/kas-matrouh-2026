export type PredictionInput = {
  name: string;
  phone: string;
  homeScore: string | number;
  awayScore: string | number;
};

export function validatePrediction(input: PredictionInput) {
  const name = input.name.trim();
  const phone = input.phone.trim();
  const scores = [input.homeScore, input.awayScore].map((value) => String(value).trim());
  return {
    name: name.length >= 2 && name.length <= 100 ? "" : "اكتب الاسم (حرفان على الأقل).",
    phone: /^01[0125]\d{8}$/.test(phone) ? "" : "اكتب رقم موبايل مصري صحيح.",
    homeScore: /^\d{1,2}$/.test(scores[0]) ? "" : "أدخل نتيجة الفريق الأول من 0 إلى 99.",
    awayScore: /^\d{1,2}$/.test(scores[1]) ? "" : "أدخل نتيجة الفريق الثاني من 0 إلى 99.",
  };
}

export function isPredictionOpen(match: {
  match_date: string | null;
  match_time: string | null;
  status: string | null;
  is_live?: boolean | null;
}, now = new Date()) {
  if (match.status !== "لم تبدأ" || match.is_live || !match.match_date || !match.match_time) return false;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || "";
  const cairoNow = `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:${part("second")}`;
  return `${match.match_date}T${match.match_time}` > cairoNow;
}
