"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

type Props = {
  matchId: string;
  matchName: string;
};

export function PredictionForm({ matchId, matchName }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [homeScore, setHomeScore] = useState("");
  const [awayScore, setAwayScore] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!name.trim() || !phone.trim() || homeScore === "" || awayScore === "") {
      toast.error("يرجى إكمال الاسم، رقم الهاتف، والنتيجة!");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("predictions").insert({
      match_id: matchId,
      match_name: matchName,
      name: name.trim(),
      phone: phone.trim(),
      home_score: Number(homeScore),
      away_score: Number(awayScore),
    });
    setLoading(false);
    if (error) {
      toast.error("حدث خطأ، حاول مرة أخرى.");
      return;
    }
    toast.success("تم تسجيل توقعك بنجاح! حظ سعيد 🎁");
    setSubmitted(true);
  };

  if (submitted) {
    return <p className="text-center text-caption font-bold text-accent-green">✓ تم تسجيل توقعك لهذه المباراة</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="الاسم"
        className="h-10 min-w-[100px] flex-1 rounded-xl bg-background px-3 text-caption font-bold outline-none ring-1 ring-white/10 focus:ring-accent-blue"
      />
      <input
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="الموبايل"
        className="h-10 min-w-[100px] flex-1 rounded-xl bg-background px-3 text-caption font-bold outline-none ring-1 ring-white/10 focus:ring-accent-blue"
      />
      <input
        value={homeScore}
        onChange={(e) => setHomeScore(e.target.value)}
        type="number"
        placeholder="0"
        className="h-10 w-14 rounded-xl bg-background px-2 text-center text-caption font-bold outline-none ring-1 ring-white/10 focus:ring-accent-blue"
      />
      <span className="text-caption font-bold text-muted-foreground">-</span>
      <input
        value={awayScore}
        onChange={(e) => setAwayScore(e.target.value)}
        type="number"
        placeholder="0"
        className="h-10 w-14 rounded-xl bg-background px-2 text-center text-caption font-bold outline-none ring-1 ring-white/10 focus:ring-accent-blue"
      />
      <button
        onClick={submit}
        disabled={loading}
        className="h-10 rounded-xl bg-primary px-4 text-caption font-black text-primary-foreground disabled:opacity-60"
      >
        {loading ? "..." : "توقع"}
      </button>
    </div>
  );
}
