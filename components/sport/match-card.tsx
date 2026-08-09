import Image from "next/image";
import { Shield, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

export type MatchCardProps = {
  teamA: string;
  teamALogo?: string | null;
  teamB: string;
  teamBLogo?: string | null;
  homeGoals?: number | null;
  awayGoals?: number | null;
  status?: string | null;
  matchDate?: string | null;
  matchTime?: string | null;
  round?: string | null;
  isLive?: boolean;
  liveMinute?: number | null;
  className?: string;
};

function TeamLogo({ src, name }: { src?: string | null; name: string }) {
  if (src) {
    return <Image src={src} alt={name} width={48} height={48} className="h-10 w-10 rounded-full object-contain sm:h-12 sm:w-12" />;
  }
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary sm:h-12 sm:w-12">
      <Shield className="h-5 w-5 text-muted-foreground" />
    </div>
  );
}

const isFinished = (status?: string | null) => status === "انتهت";
const notStarted = (status?: string | null) => !status || status === "لم تبدأ" || status === "ستبدأ بعد قليل";

export function MatchCard({
  teamA, teamALogo, teamB, teamBLogo, homeGoals, awayGoals,
  status, matchDate, matchTime, round, isLive, liveMinute, className,
}: MatchCardProps) {
  const finished = isFinished(status);
  const upcoming = notStarted(status);

  return (
    <div className={cn("rounded-2xl bg-card p-4 ring-1 ring-white/10", className)}>
      <div className="mb-3 flex items-center justify-between text-caption font-bold text-muted-foreground">
        <span>{round}</span>
        {isLive ? (
          <span className="flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-destructive">
            <Radio className="h-3 w-3 animate-pulse" />
            {liveMinute ? `${liveMinute}'` : "مباشر"}
          </span>
        ) : (
          <span>{matchDate} {matchTime ? `- ${matchTime}` : ""}</span>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex flex-col items-center gap-2 text-center">
          <TeamLogo src={teamALogo} name={teamA} />
          <span className="text-caption font-black leading-tight">{teamA}</span>
        </div>

        <div className="px-2 text-center">
          {upcoming ? (
            <span className="text-h3 font-black text-muted-foreground">vs</span>
          ) : (
            <div className="flex items-center gap-1.5 text-h2 font-black" dir="ltr">
              <span>{homeGoals ?? 0}</span>
              <span className="text-muted-foreground">-</span>
              <span>{awayGoals ?? 0}</span>
            </div>
          )}
          {finished && <span className="mt-1 block text-caption font-bold text-muted-foreground">انتهت</span>}
        </div>

        <div className="flex flex-col items-center gap-2 text-center">
          <TeamLogo src={teamBLogo} name={teamB} />
          <span className="text-caption font-black leading-tight">{teamB}</span>
        </div>
      </div>
    </div>
  );
}
