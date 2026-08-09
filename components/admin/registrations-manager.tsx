"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Trash2, User, Search } from "lucide-react";

type Registration = {
  id: string;
  full_name: string;
  role_label: string;
  team_name: string;
  tournament_name: string;
  serial_number: string;
  photo_url: string | null;
  national_id: string;
  birth_date: string;
  created_at: string;
};

const inputCls = "h-10 w-full rounded-lg bg-secondary px-3 text-caption font-bold outline-none ring-1 ring-white/10 focus:ring-accent-blue";

export function RegistrationsManager({ initialRegistrations, tournaments }: { initialRegistrations: Registration[]; tournaments: { id: string; name: string }[] }) {
  const [registrations, setRegistrations] = useState(initialRegistrations);
  const [tournamentFilter, setTournamentFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return registrations.filter((r) => {
      if (tournamentFilter !== "all" && r.tournament_name !== tournamentFilter) return false;
      if (search.trim()) {
        const term = search.trim().toLowerCase();
        return r.full_name?.toLowerCase().includes(term) || r.team_name?.toLowerCase().includes(term) || r.serial_number?.toLowerCase().includes(term);
      }
      return true;
    });
  }, [registrations, tournamentFilter, search]);

  const remove = async (id: string) => {
    if (!confirm("متأكد من حذف هذا التسجيل؟")) return;
    try {
      const res = await fetch(`/api/admin/player-registrations?id=${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل الحذف");
      setRegistrations((prev) => prev.filter((r) => r.id !== id));
      toast.success("تم الحذف");
    } catch (e: any) {
      toast.error(e?.message || "فشل الحذف");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم أو الفريق أو الرقم التسلسلي" className={`${inputCls} pr-9`} />
        </div>
        <select value={tournamentFilter} onChange={(e) => setTournamentFilter(e.target.value)} className={`${inputCls} w-auto`}>
          <option value="all">كل البطولات</option>
          {tournaments.map((t) => (
            <option key={t.id} value={t.name}>{t.name}</option>
          ))}
        </select>
        <span className="flex items-center rounded-full bg-secondary px-3 text-caption font-black text-muted-foreground">{filtered.length}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-card p-8 text-center text-caption text-muted-foreground ring-1 ring-white/10">لا توجد تسجيلات</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-2xl bg-card p-4 ring-1 ring-white/10">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-secondary">
                {r.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.photo_url} alt={r.full_name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-caption font-black">{r.full_name}</div>
                <div className="truncate text-[11px] text-muted-foreground">{r.role_label} • {r.team_name}</div>
                <div className="truncate text-[10px] text-muted-foreground" dir="ltr">{r.serial_number}</div>
              </div>
              <button onClick={() => remove(r.id)} className="shrink-0 rounded-lg bg-red-500/15 p-2 text-red-400">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
