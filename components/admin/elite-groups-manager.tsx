"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { ELITE_CUP_ELIGIBLE_TEAMS } from "@/lib/sport/elite-registration";

type Assignment = Record<string, "A" | "B" | null>;

export function EliteGroupsManager({ initialGroupA, initialGroupB }: { initialGroupA: string[]; initialGroupB: string[] }) {
  const [assignment, setAssignment] = useState<Assignment>(() => {
    const map: Assignment = {};
    ELITE_CUP_ELIGIBLE_TEAMS.forEach((t) => {
      map[t] = initialGroupA.includes(t) ? "A" : initialGroupB.includes(t) ? "B" : null;
    });
    return map;
  });
  const [saving, setSaving] = useState(false);

  const setGroup = (team: string, group: "A" | "B" | null) => {
    setAssignment((prev) => ({ ...prev, [team]: group }));
  };

  const countA = Object.values(assignment).filter((g) => g === "A").length;
  const countB = Object.values(assignment).filter((g) => g === "B").length;

  const save = async () => {
    setSaving(true);
    try {
      const groupA = ELITE_CUP_ELIGIBLE_TEAMS.filter((t) => assignment[t] === "A");
      const groupB = ELITE_CUP_ELIGIBLE_TEAMS.filter((t) => assignment[t] === "B");
      const res = await fetch("/api/admin/elite-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupA, groupB }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل الحفظ");
      toast.success("تم حفظ توزيع المجموعات");
    } catch (e: any) {
      toast.error(e?.message || "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-white/10 sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-h3 font-black">توزيع المجموعات</h2>
        <span className="text-caption font-bold text-muted-foreground">
          المجموعة الأولى: {countA}/5 — المجموعة الثانية: {countB}/5
        </span>
      </div>

      <div className="space-y-2">
        {ELITE_CUP_ELIGIBLE_TEAMS.map((team) => (
          <div key={team} className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2">
            <span className="text-caption font-bold">{team}</span>
            <div className="flex gap-1.5">
              <button
                onClick={() => setGroup(team, assignment[team] === "A" ? null : "A")}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-black transition-colors ${
                  assignment[team] === "A" ? "bg-accent-blue text-background" : "bg-white/5 text-muted-foreground"
                }`}
              >
                المجموعة الأولى
              </button>
              <button
                onClick={() => setGroup(team, assignment[team] === "B" ? null : "B")}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-black transition-colors ${
                  assignment[team] === "B" ? "bg-accent-green text-background" : "bg-white/5 text-muted-foreground"
                }`}
              >
                المجموعة الثانية
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={save}
        disabled={saving || countA > 5 || countB > 5}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-caption font-black text-primary-foreground disabled:opacity-60"
      >
        <Save className="h-3.5 w-3.5" /> حفظ التوزيع
      </button>
      {(countA > 5 || countB > 5) && <p className="text-center text-[11px] font-bold text-red-400">كل مجموعة أقصى حد 5 فرق.</p>}
    </div>
  );
}
