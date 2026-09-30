import { Trophy, ChevronLeft, ChevronDown } from "lucide-react";
import type { EliteBracket, SlotResult } from "@/lib/sport/elite-bracket";

const labels = {
  playoff: "الملحق المؤهل لنصف النهائي",
  semifinal: "نصف النهائي",
  final: "النهائي",
  winner: "الفائز",
  notPlayed: "لم تلعب بعد",
  p1: "P1: المركز 3 × المركز 6",
  p2: "P2: المركز 4 × المركز 5",
  sf1: "SF1: المركز 1 × فائز P1",
  sf2: "SF2: المركز 2 × فائز P2",
};

function MatchSlot({ slot, label, highlight }: { slot: SlotResult; label: string; highlight?: boolean }) {
  const isWinner = (team: string) => slot.played && slot.winner === team;
  return (
    <div className={`rounded-2xl p-3 ring-1 transition-all ${highlight ? "bg-primary/15 ring-primary/40" : "bg-card ring-white/10"}`}>
      <div className="mb-1.5 text-[10px] font-black text-muted-foreground">{label}</div>
      <div className="space-y-1">
        {[{ name: slot.teamA, score: slot.homeGoals }, { name: slot.teamB, score: slot.awayGoals }].map((team) => (
          <div key={team.name} className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-caption font-bold ${isWinner(team.name) ? "bg-accent-green/15 text-accent-green" : ""}`}>
            <span className="truncate">{team.name}</span>
            {slot.played && <span dir="ltr" className="shrink-0 font-black">{team.score}</span>}
          </div>
        ))}
      </div>
      {!slot.played && <div className="mt-1.5 text-[10px] font-bold text-accent-orange">{labels.notPlayed}</div>}
      {slot.played && slot.winner && <div className="mt-1.5 text-[10px] font-bold text-accent-green">{labels.winner}: {slot.winner}</div>}
    </div>
  );
}

export function EliteBracketDiagram({ bracket }: { bracket: EliteBracket }) {
  return (
    <div className="rounded-2xl bg-brand-dark/40 p-4 ring-1 ring-white/10 sm:p-6">
      <div className="space-y-4 md:hidden">
        <div className="text-caption font-black text-accent-blue">{labels.playoff}</div>
        <MatchSlot slot={bracket.playoff1} label={labels.p1} />
        <MatchSlot slot={bracket.playoff2} label={labels.p2} />
        <ChevronDown className="mx-auto h-5 w-5 text-muted-foreground" />
        <div className="text-caption font-black text-accent-green">{labels.semifinal}</div>
        <MatchSlot slot={bracket.semi1} label={labels.sf1} />
        <MatchSlot slot={bracket.semi2} label={labels.sf2} />
        <ChevronDown className="mx-auto h-5 w-5 text-muted-foreground" />
        <div className="text-caption font-black text-accent-orange">{labels.final}</div>
        <MatchSlot slot={bracket.final} label={labels.final} highlight />
      </div>

      <div className="hidden min-w-[720px] grid-cols-[1fr_28px_1fr_28px_1fr] items-center gap-3 md:grid">
        <div className="space-y-4">
          <h3 className="text-center text-caption font-black text-accent-blue">{labels.playoff}</h3>
          <MatchSlot slot={bracket.playoff1} label={labels.p1} />
          <MatchSlot slot={bracket.playoff2} label={labels.p2} />
        </div>
        <ChevronLeft className="mx-auto h-5 w-5 text-muted-foreground" />
        <div className="space-y-4">
          <h3 className="text-center text-caption font-black text-accent-green">{labels.semifinal}</h3>
          <MatchSlot slot={bracket.semi1} label={labels.sf1} />
          <MatchSlot slot={bracket.semi2} label={labels.sf2} />
        </div>
        <ChevronLeft className="mx-auto h-5 w-5 text-muted-foreground" />
        <div className="space-y-2">
          <h3 className="flex items-center justify-center gap-1.5 text-caption font-black text-accent-orange"><Trophy className="h-3.5 w-3.5" />{labels.final}</h3>
          <MatchSlot slot={bracket.final} label={labels.final} highlight />
        </div>
      </div>
    </div>
  );
}
