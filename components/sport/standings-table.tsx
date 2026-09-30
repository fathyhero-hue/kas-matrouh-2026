import { cn } from "@/lib/utils";

export type StandingsRow = {
  team: string;
  logoUrl?: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  zone?: "qualify" | "playoff" | "danger" | null;
};

const ZONE_COLOR: Record<string, string> = {
  qualify: "border-r-accent-green",
  playoff: "border-r-accent-blue",
  danger: "border-r-destructive",
};

const labels = {
  rank: "الترتيب",
  team: "الفريق",
  played: "لعب",
  won: "فاز",
  drawn: "تعادل",
  lost: "خسر",
  for: "له",
  against: "عليه",
  difference: "فارق",
  points: "نقاط",
};

export function StandingsTable({ rows }: { rows: StandingsRow[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-card ring-1 ring-white/10">
      <table className="w-full min-w-[560px] text-center text-body">
        <thead>
          <tr className="border-b border-white/10 text-caption font-bold text-muted-foreground">
            <th className="px-2 py-3">{labels.rank}</th>
            <th className="px-3 py-3 text-right">{labels.team}</th>
            <th className="px-2 py-3">{labels.played}</th>
            <th className="px-2 py-3">{labels.won}</th>
            <th className="px-2 py-3">{labels.drawn}</th>
            <th className="px-2 py-3">{labels.lost}</th>
            <th className="px-2 py-3">{labels.for}</th>
            <th className="px-2 py-3">{labels.against}</th>
            <th className="px-2 py-3">{labels.difference}</th>
            <th className="px-3 py-3 font-black text-foreground">{labels.points}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.team + index}
              className={cn("border-b border-white/5 last:border-0", row.zone && `border-r-4 ${ZONE_COLOR[row.zone]}`)}
            >
              <td className="px-2 py-3 font-black text-muted-foreground">{index + 1}</td>
              <td className="flex items-center gap-2 px-3 py-3 text-right font-bold">
                {row.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.logoUrl} alt={row.team} className="h-6 w-6 rounded-full object-contain" />
                ) : null}
                <span>{row.team}</span>
              </td>
              <td className="px-2 py-3">{row.played}</td>
              <td className="px-2 py-3">{row.won}</td>
              <td className="px-2 py-3">{row.drawn}</td>
              <td className="px-2 py-3">{row.lost}</td>
              <td className="px-2 py-3">{row.goalsFor}</td>
              <td className="px-2 py-3">{row.goalsAgainst}</td>
              <td className="px-2 py-3">{row.goalsFor - row.goalsAgainst}</td>
              <td className="px-3 py-3 font-black text-accent-blue">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
