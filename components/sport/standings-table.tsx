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
  /** e.g. "qualify" | "danger" — colors the leading edge of the row */
  zone?: "qualify" | "danger" | null;
};

const ZONE_COLOR: Record<string, string> = {
  qualify: "border-r-accent-green",
  danger: "border-r-destructive",
};

export function StandingsTable({ rows }: { rows: StandingsRow[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-card ring-1 ring-white/10">
      <table className="w-full min-w-[520px] text-center text-body">
        <thead>
          <tr className="border-b border-white/10 text-caption font-bold text-muted-foreground">
            <th className="px-3 py-3 text-right">الفريق</th>
            <th className="px-2 py-3">لعب</th>
            <th className="px-2 py-3">فاز</th>
            <th className="px-2 py-3">تعادل</th>
            <th className="px-2 py-3">خسر</th>
            <th className="px-2 py-3">له</th>
            <th className="px-2 py-3">عليه</th>
            <th className="px-2 py-3">فارق</th>
            <th className="px-3 py-3 font-black text-foreground">نقاط</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.team + i}
              className={cn(
                "border-b border-white/5 last:border-0",
                row.zone && `border-r-4 ${ZONE_COLOR[row.zone]}`
              )}
            >
              <td className="flex items-center gap-2 px-3 py-3 text-right font-bold">
                <span className="text-caption text-muted-foreground">{i + 1}</span>
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
