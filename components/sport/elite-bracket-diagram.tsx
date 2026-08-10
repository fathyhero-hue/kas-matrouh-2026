import { Trophy, ChevronLeft } from "lucide-react";
import type { EliteBracket, SlotResult } from "@/lib/sport/elite-bracket";

function MatchSlot({ slot, label, highlight }: { slot: SlotResult | null; label: string; highlight?: boolean }) {
  if (!slot) {
    return (
      <div className="rounded-2xl bg-card/60 p-3 ring-1 ring-dashed ring-white/10">
        <div className="mb-1.5 text-[10px] font-black text-muted-foreground">{label}</div>
        <div className="text-caption font-bold text-muted-foreground">لم يتحدد بعد</div>
      </div>
    );
  }

  const isWinner = (team: string) => slot.played && slot.winner && team === slot.winner;

  return (
    <div className={`rounded-2xl p-3 ring-1 transition-all ${highlight ? "bg-primary/15 ring-primary/40" : "bg-card ring-white/10"}`}>
      <div className="mb-1.5 text-[10px] font-black text-muted-foreground">{label}</div>
      <div className="space-y-1">
        <div className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-caption font-bold ${isWinner(slot.teamA) ? "bg-accent-green/15 text-accent-green" : ""}`}>
          <span className="truncate">{slot.teamA}</span>
          {slot.played && <span dir="ltr" className="shrink-0 font-black">{slot.homeGoals}</span>}
        </div>
        <div className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-caption font-bold ${isWinner(slot.teamB) ? "bg-accent-green/15 text-accent-green" : ""}`}>
          <span className="truncate">{slot.teamB}</span>
          {slot.played && <span dir="ltr" className="shrink-0 font-black">{slot.awayGoals}</span>}
        </div>
      </div>
      {!slot.played && <div className="mt-1.5 text-[10px] font-bold text-accent-orange">لسه ما اتلعبتش</div>}
    </div>
  );
}

export function EliteBracketDiagram({ bracket }: { bracket: EliteBracket }) {
  const groupsReady = bracket.groupA.first && bracket.groupA.second && bracket.groupA.third && bracket.groupB.first && bracket.groupB.second && bracket.groupB.third;

  if (!groupsReady) {
    return (
      <div className="rounded-2xl bg-card p-6 text-center ring-1 ring-white/10">
        <p className="text-caption font-bold text-muted-foreground">المخطط هيظهر بعد ما تكتمل نتائج دور المجموعات (أول 3 مراكز في كل مجموعة).</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl bg-brand-dark/40 p-4 ring-1 ring-white/10 sm:p-6">
      <div className="grid min-w-[720px] grid-cols-[1fr_28px_1fr_28px_1fr] items-center gap-3">
        {/* دور الأربعة */}
        <div className="space-y-4">
          <h3 className="text-center text-caption font-black text-accent-blue">دور الأربعة</h3>
          <MatchSlot slot={bracket.playoff1} label="ثالث المجموعة الأولى × ثاني المجموعة الثانية" />
          <MatchSlot slot={bracket.playoff2} label="ثاني المجموعة الأولى × ثالث المجموعة الثانية" />
        </div>

        <ChevronLeft className="mx-auto h-5 w-5 shrink-0 text-muted-foreground" />

        {/* نصف النهائي */}
        <div className="space-y-4">
          <h3 className="text-center text-caption font-black text-accent-green">نصف النهائي</h3>
          <MatchSlot slot={bracket.semi1} label={`أول المجموعة الأولى × الفائز من دور الأربعة`} />
          <MatchSlot slot={bracket.semi2} label={`أول المجموعة الثانية × الفائز من دور الأربعة`} />
        </div>

        <ChevronLeft className="mx-auto h-5 w-5 shrink-0 text-muted-foreground" />

        {/* النهائي */}
        <div className="space-y-2">
          <h3 className="flex items-center justify-center gap-1.5 text-caption font-black text-accent-orange">
            <Trophy className="h-3.5 w-3.5" /> النهائي
          </h3>
          <MatchSlot slot={bracket.final} label="النهائي" highlight />
        </div>
      </div>
    </div>
  );
}
