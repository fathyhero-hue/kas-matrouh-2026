"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckSquare, Download, Edit3, Eye, FileText, Loader2, Plus, Printer, Square, Users, X } from "lucide-react";
import { toast } from "sonner";
import { IdCard, type IdCardData } from "@/components/player-card/id-card";
import { downloadCardPdf, downloadCardsPdf } from "@/lib/player-cards/export";
import { getCardCounts, type PlayerCardPlayer, type PlayerCardTeam, type PlayerCardRecord } from "@/lib/player-cards/data";

function cardData(team: PlayerCardTeam, player: PlayerCardPlayer, tournament: string): IdCardData {
  const overrides = player.card?.display_overrides || {};
  const number = (key: string, fallback: number) => typeof overrides[key] === "number" ? Number(overrides[key]) : fallback;
  const serial = player.card?.card_number || "PENDING";
  return {
    fullName: player.name,
    role: "player",
    roleLabel: "لاعب",
    team: team.teamName,
    teamLogoUrl: team.logoUrl || undefined,
    tournament,
    serial,
    qrPayload: JSON.stringify({ type: "player-card", card: serial, player: player.id }),
    photoUrl: player.photoUrl || undefined,
    cropX: number("cropX", 50),
    cropY: number("cropY", 50),
    zoom: number("zoom", 1),
    registrationDate: new Date().toISOString().slice(0, 10),
  };
}

function replaceCard(players: PlayerCardPlayer[], id: string, card: PlayerCardRecord) {
  return players.map((player) => player.id === id ? { ...player, card } : player);
}

export function PlayerCardsManager({ team, tournament = "كأس النخبة" }: { team: PlayerCardTeam; tournament?: string }) {
  const [players, setPlayers] = useState(team.players);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<PlayerCardPlayer | null>(null);
  const [editing, setEditing] = useState<PlayerCardPlayer | null>(null);
  const counts = getCardCounts({ ...team, players });
  const selectedPlayers = useMemo(() => players.filter((player) => selected.has(player.id)), [players, selected]);

  const toggle = (id: string) => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const selectAll = () => setSelected(selected.size === players.length ? new Set() : new Set(players.map((player) => player.id)));

  const createCards = async (playerIds: string[]) => {
    if (!team.rosterId || playerIds.length === 0) return;
    setBusy("create");
    try {
      const res = await fetch("/api/admin/player-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: playerIds.length === 1 ? "create" : "bulk_create",
          teamRosterId: team.rosterId,
          ...(playerIds.length === 1 ? { playerId: playerIds[0] } : { playerIds }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "تعذر إنشاء البطاقة.");
      const cards: PlayerCardRecord[] = data.cards || (data.card ? [data.card] : []);
      setPlayers((current) => current.map((player) => cards.find((card) => card.roster_player_id === player.id) ? { ...player, card: cards.find((card) => card.roster_player_id === player.id)! } : player));
      setSelected(new Set());
      toast.success(`تم إنشاء ${data.createdCount ?? cards.length} بطاقة جديدة.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إنشاء البطاقة.");
    } finally {
      setBusy(null);
    }
  };

  const downloadPlayers = async (items: PlayerCardPlayer[]) => {
    const ready = items.filter((player) => player.card);
    if (!ready.length) return toast.error("لا توجد بطاقات جاهزة للتنزيل.");
    setBusy("download");
    try {
      await downloadCardsPdf(ready.map((player) => cardData(team, player, tournament)), `${team.teamName}-player-cards.pdf`);
    } catch (error) {
      console.error("[player-cards] manager export failed", error instanceof Error ? error.message : "unknown");
      toast.error("تعذر تجهيز ملف PDF.");
    } finally {
      setBusy(null);
    }
  };

  const downloadSingle = async (player: PlayerCardPlayer) => {
    if (!player.card) return toast.error("أنشئ البطاقة أولًا.");
    setBusy(player.id);
    try {
      await downloadCardPdf(cardData(team, player, tournament), `${player.card.card_number}.pdf`);
    } catch (error) {
      console.error("[player-cards] single export failed", error instanceof Error ? error.message : "unknown");
      toast.error("تعذر تجهيز ملف البطاقة.");
    } finally {
      setBusy(null);
    }
  };

  const saveOverrides = async (player: PlayerCardPlayer, overrides: Record<string, number>) => {
    if (!player.card) return;
    setBusy(player.id);
    try {
      const res = await fetch(`/api/admin/player-cards/${player.card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_overrides: overrides }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "تعذر حفظ التعديلات.");
      setPlayers((current) => replaceCard(current, player.id, data.card));
      setEditing(null);
      toast.success("تم حفظ تعديلات البطاقة.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر حفظ التعديلات.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div dir="rtl" className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            {team.logoUrl && <img src={team.logoUrl} alt="" className="h-12 w-12 object-contain" />}
            <div>
              <h1 className="text-h1 font-black">بطاقات {team.teamName}</h1>
              <p className="mt-1 text-caption text-muted-foreground">{counts.players} لاعب · {counts.ready} جاهزة · {counts.missing} بدون بطاقة</p>
            </div>
          </div>
          {!team.rosterId && <p className="mt-3 rounded-xl bg-accent-orange/10 px-4 py-3 text-caption font-bold text-accent-orange">القائمة غير منشأة بعد. سيظهر الفريق هنا دون إنشاء قائمة وهمية.</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/player-cards/${team.id}/print`} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-caption font-black hover:bg-white/15"><Printer className="h-4 w-4" />معاينة الطباعة</Link>
          <button onClick={() => downloadPlayers(players)} disabled={busy === "download"} className="flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-caption font-black text-primary-foreground disabled:opacity-60"><Download className="h-4 w-4" />كل البطاقات</button>
        </div>
      </div>

      {players.length > 0 && (
        <div className="sticky top-[72px] z-20 flex flex-wrap items-center gap-2 rounded-2xl bg-brand-dark/95 p-3 ring-1 ring-white/10 backdrop-blur">
          <button onClick={selectAll} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-caption font-black">{selected.size === players.length ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}تحديد الكل</button>
          <span className="text-caption font-bold text-muted-foreground">{selected.size} محدد</span>
          <button onClick={() => createCards(selectedPlayers.filter((player) => !player.card).map((player) => player.id))} disabled={!team.rosterId || busy === "create" || selectedPlayers.every((player) => player.card)} className="flex items-center gap-2 rounded-xl bg-accent-green px-3 py-2 text-caption font-black text-background disabled:opacity-50"><Plus className="h-4 w-4" />إنشاء للمحدد</button>
          <button onClick={() => downloadPlayers(selectedPlayers)} disabled={busy === "download"} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-caption font-black disabled:opacity-50"><FileText className="h-4 w-4" />PDF للمحدد</button>
          {selected.size > 0 && <button onClick={() => setSelected(new Set())} className="mr-auto flex items-center gap-2 rounded-xl px-3 py-2 text-caption font-black text-muted-foreground"><X className="h-4 w-4" />إلغاء</button>}
        </div>
      )}

      {players.length === 0 ? (
        <div className="rounded-2xl bg-card p-10 text-center text-caption text-muted-foreground ring-1 ring-white/10"><Users className="mx-auto mb-3 h-8 w-8" />لا يوجد لاعبون في هذه القائمة.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {players.map((player) => {
            const data = cardData(team, player, tournament);
            const ready = player.card?.status === "ready";
            return (
              <article key={player.id} className="rounded-2xl bg-card p-4 ring-1 ring-white/10">
                <div className="flex items-start gap-3">
                  <button type="button" onClick={() => toggle(player.id)} aria-label={`تحديد ${player.name}`} className="mt-1 text-muted-foreground hover:text-foreground">{selected.has(player.id) ? <CheckSquare className="h-5 w-5 text-accent-blue" /> : <Square className="h-5 w-5" />}</button>
                  {player.photoUrl ? <img src={player.photoUrl} alt="" className="h-16 w-16 rounded-xl object-cover" /> : <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-white/10 text-xs text-muted-foreground">بدون صورة</div>}
                  <div className="min-w-0 flex-1"><h2 className="truncate text-body font-black">{player.name}</h2><p className="text-caption text-muted-foreground">{player.number ? `رقم ${player.number} · ` : ""}{ready ? player.card?.card_number : "البطاقة غير منشأة"}</p><span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-black ${ready ? "bg-accent-green/15 text-accent-green" : "bg-accent-orange/15 text-accent-orange"}`}>{ready ? "جاهزة" : "بدون بطاقة"}</span></div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button onClick={() => setPreview(player)} className="flex items-center justify-center gap-1 rounded-xl bg-white/10 px-2 py-2 text-caption font-black"><Eye className="h-4 w-4" />معاينة</button>
                  {ready ? <button onClick={() => setEditing(player)} className="flex items-center justify-center gap-1 rounded-xl bg-white/10 px-2 py-2 text-caption font-black"><Edit3 className="h-4 w-4" />تعديل</button> : <button onClick={() => createCards([player.id])} disabled={!team.rosterId || busy === "create"} className="flex items-center justify-center gap-1 rounded-xl bg-primary px-2 py-2 text-caption font-black text-primary-foreground disabled:opacity-50"><Plus className="h-4 w-4" />إنشاء</button>}
                  <button onClick={() => downloadSingle(player)} disabled={!ready || busy === player.id} className="col-span-2 flex items-center justify-center gap-1 rounded-xl border border-white/10 px-2 py-2 text-caption font-black disabled:opacity-40">{busy === player.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}تحميل البطاقة</button>
                </div>
                {preview?.id === player.id && <PreviewModal data={data} onClose={() => setPreview(null)} />}
                {editing?.id === player.id && <EditModal player={player} data={data} onClose={() => setEditing(null)} onSave={(overrides) => saveOverrides(player, overrides)} busy={busy === player.id} />}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PreviewModal({ data, onClose }: { data: IdCardData; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4" onClick={onClose}><div className="w-full max-w-xl rounded-2xl bg-brand-dark p-4" onClick={(event) => event.stopPropagation()}><div className="mb-3 flex items-center justify-between"><h2 className="text-body font-black">معاينة البطاقة</h2><button onClick={onClose} aria-label="إغلاق"><X className="h-5 w-5" /></button></div><IdCard data={data} /></div></div>;
}

function EditModal({ player, data, onClose, onSave, busy }: { player: PlayerCardPlayer; data: IdCardData; onClose: () => void; onSave: (overrides: Record<string, number>) => void; busy: boolean }) {
  const current = player.card?.display_overrides || {};
  const [cropX, setCropX] = useState(Number(current.cropX ?? 50));
  const [cropY, setCropY] = useState(Number(current.cropY ?? 50));
  const [zoom, setZoom] = useState(Number(current.zoom ?? 1));
  const previewData = { ...data, cropX, cropY, zoom };
  return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4" onClick={onClose}><div className="w-full max-w-3xl rounded-2xl bg-brand-dark p-4" onClick={(event) => event.stopPropagation()}><div className="mb-3 flex items-center justify-between"><h2 className="text-body font-black">تعديل بطاقة {player.name}</h2><button onClick={onClose} aria-label="إغلاق"><X className="h-5 w-5" /></button></div><div className="grid gap-5 lg:grid-cols-2"><IdCard data={previewData} face="front" /><div className="space-y-4"><Range label="القص الأفقي" value={cropX} min={0} max={100} step={1} onChange={setCropX} /><Range label="القص الرأسي" value={cropY} min={0} max={100} step={1} onChange={setCropY} /><Range label="التكبير" value={zoom} min={1} max={2} step={0.05} onChange={setZoom} /><button onClick={() => onSave({ cropX, cropY, zoom })} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-caption font-black text-primary-foreground disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />}حفظ التعديلات</button></div></div></div></div>;
}

function Range({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return <label className="block text-caption font-bold"><span className="mb-1 flex justify-between"><span>{label}</span><span dir="ltr">{value}</span></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full" /></label>;
}
