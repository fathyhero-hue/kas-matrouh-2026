"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Search, Users } from "lucide-react";
import { getCardCounts, type PlayerCardTeam } from "@/lib/player-cards/data";

export function PlayerCardTeamsManager({ teams, tournament }: { teams: PlayerCardTeam[]; tournament: string }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => teams.filter((team) => team.teamName.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [query, teams]);
  return (
    <div dir="rtl" className="space-y-5">
      <div className="relative max-w-md"><Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="بحث باسم الفريق" className="h-11 w-full rounded-xl bg-card px-10 text-caption font-bold outline-none ring-1 ring-white/10 focus:ring-accent-blue" /></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((team) => {
          const counts = getCardCounts(team);
          return <Link key={team.id} href={`/admin/player-cards/${team.id}?tournament=${encodeURIComponent(tournament)}`} className="group rounded-2xl bg-card p-5 ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:ring-accent-blue/50"><div className="flex items-start gap-3">{team.logoUrl ? <img src={team.logoUrl} alt="" className="h-14 w-14 object-contain" /> : <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/10"><Users className="h-6 w-6 text-muted-foreground" /></div>}<div className="min-w-0 flex-1"><h2 className="truncate text-body font-black">{team.teamName}</h2><p className="mt-1 text-caption text-muted-foreground">{counts.players} لاعب · {counts.ready} بطاقة جاهزة</p>{!team.rosterId && <span className="mt-2 inline-block rounded-full bg-accent-orange/15 px-2 py-1 text-[11px] font-black text-accent-orange">القائمة غير منشأة</span>}</div><ArrowLeft className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:-translate-x-1" /></div><div className="mt-4 grid grid-cols-3 gap-2 text-center text-caption"><div className="rounded-xl bg-white/5 p-2"><div className="font-black">{counts.players}</div><div className="text-[11px] text-muted-foreground">لاعبون</div></div><div className="rounded-xl bg-accent-green/10 p-2"><div className="font-black text-accent-green">{counts.ready}</div><div className="text-[11px] text-muted-foreground">جاهزة</div></div><div className="rounded-xl bg-accent-orange/10 p-2"><div className="font-black text-accent-orange">{counts.missing}</div><div className="text-[11px] text-muted-foreground">ناقصة</div></div></div></Link>;
        })}
      </div>
      {filtered.length === 0 && <div className="rounded-2xl bg-card p-10 text-center text-caption text-muted-foreground ring-1 ring-white/10">لا توجد فرق مطابقة للبحث.</div>}
    </div>
  );
}
