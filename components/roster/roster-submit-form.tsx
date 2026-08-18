"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Lock, Camera, CheckCircle2, Loader2, ShieldCheck, Clock } from "lucide-react";

type PlayerRow = {
  name: string;
  number: string;
  personalFile: File | null;
  personalPreview: string;
  personalIsExisting: boolean;
  idFile: File | null;
  idPreview: string;
  idIsExisting: boolean;
};

function emptyPlayers(count: number): PlayerRow[] {
  return Array.from({ length: count }, () => ({
    name: "", number: "", personalFile: null, personalPreview: "", personalIsExisting: false, idFile: null, idPreview: "", idIsExisting: false,
  }));
}

function formatDeadline(deadline: string) {
  try {
    return new Date(deadline).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return deadline;
  }
}

export function RosterSubmitForm({ tournament, suffix, maxPlayers }: { tournament: string; suffix: string; maxPlayers: number }) {
  const [step, setStep] = useState<"unlock" | "form" | "success">("unlock");
  const [code, setCode] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [deadline, setDeadline] = useState("");
  const [resumedNotice, setResumedNotice] = useState(false);

  const [teamName, setTeamName] = useState("");
  const [managerName, setManagerName] = useState("");
  const [managerPhone, setManagerPhone] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [logoIsExisting, setLogoIsExisting] = useState(false);
  const [coachName, setCoachName] = useState("");
  const [coachFile, setCoachFile] = useState<File | null>(null);
  const [coachPreview, setCoachPreview] = useState("");
  const [coachIsExisting, setCoachIsExisting] = useState(false);
  const [players, setPlayers] = useState<PlayerRow[]>(() => emptyPlayers(maxPlayers));
  const [submitting, setSubmitting] = useState(false);
  const [progressLabel, setProgressLabel] = useState("");
  const [completedCount, setCompletedCount] = useState(0);

  const applyExistingRoster = (data: any) => {
    if (!data?.found) return;
    setResumedNotice(true);
    if (data.managerName) setManagerName(data.managerName);
    if (data.managerPhone) setManagerPhone(data.managerPhone);
    if (data.logoUrl) {
      setLogoPreview(data.logoUrl);
      setLogoIsExisting(true);
    }
    if (data.coachName) setCoachName(data.coachName);
    if (data.coachPhotoUrl) {
      setCoachPreview(data.coachPhotoUrl);
      setCoachIsExisting(true);
    }
    const bySlot = new Map<number, any>((data.players || []).map((p: any) => [p.slot_index, p]));
    setPlayers(
      Array.from({ length: maxPlayers }, (_, i) => {
        const existing = bySlot.get(i);
        if (!existing) return { name: "", number: "", personalFile: null, personalPreview: "", personalIsExisting: false, idFile: null, idPreview: "", idIsExisting: false };
        return {
          name: existing.name || "",
          number: existing.number || "",
          personalFile: null,
          personalPreview: existing.personal_image_url || "",
          personalIsExisting: !!existing.personal_image_url,
          idFile: null,
          idPreview: existing.id_image_url || "",
          idIsExisting: !!existing.id_image_url,
        };
      })
    );
  };

  const fetchExistingRoster = async (name: string) => {
    if (!name.trim()) return;
    try {
      const res = await fetch(`/api/roster/my-roster?suffix=${encodeURIComponent(suffix)}&teamName=${encodeURIComponent(name.trim())}`);
      const data = await res.json().catch(() => ({}));
      applyExistingRoster(data);
    } catch {
      // silent — worst case they just start from a blank form
    }
  };

  const unlock = async () => {
    if (!code.trim()) return toast.error("الرجاء إدخال الرقم السري.");
    setUnlocking(true);
    try {
      const res = await fetch("/api/roster/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournament, code: code.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "الرقم السري غير صحيح.");
      if (data.deadline) setDeadline(data.deadline);
      if (data.teamName) {
        setTeamName(data.teamName);
        await fetchExistingRoster(data.teamName);
      }
      setStep("form");
    } catch (e: any) {
      toast.error(e?.message || "تعذر التحقق من الرقم السري.");
    } finally {
      setUnlocking(false);
    }
  };

  const updatePlayer = (index: number, patch: Partial<PlayerRow>) => {
    setPlayers((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  const handleLogoFile = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("اختار صورة صحيحة");
    if (file.size > 2 * 1024 * 1024) return toast.error("حجم الصورة كبير (أقصى 2 ميجا)");
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setLogoIsExisting(false);
  };

  const handleCoachFile = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("اختار صورة صحيحة");
    if (file.size > 2 * 1024 * 1024) return toast.error("حجم الصورة كبير (أقصى 2 ميجا)");
    setCoachFile(file);
    setCoachPreview(URL.createObjectURL(file));
    setCoachIsExisting(false);
  };

  const handlePlayerFile = (index: number, field: "personal" | "id", file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("اختار صورة صحيحة");
    if (file.size > 2 * 1024 * 1024) return toast.error("حجم الصورة كبير (أقصى 2 ميجا)");
    const preview = URL.createObjectURL(file);
    if (field === "personal") updatePlayer(index, { personalFile: file, personalPreview: preview, personalIsExisting: false });
    else updatePlayer(index, { idFile: file, idPreview: preview, idIsExisting: false });
  };

  const submit = async () => {
    if (!teamName.trim()) return toast.error("يرجى كتابة اسم الفريق.");
    if (!managerName.trim() || !managerPhone.trim()) return toast.error("الرجاء إكمال بيانات مسئول الفريق (الاسم ورقم الهاتف).");

    // Rosters no longer need to be full — only slots the manager actually
    // started filling in need to be complete; empty slots are simply skipped
    // and can be completed on a later visit before the deadline.
    let touched = 0;
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const hasAnything = p.name.trim() || p.number.trim() || p.personalFile || p.idFile || p.personalIsExisting || p.idIsExisting;
      if (!hasAnything) continue;
      if (!p.name.trim() || !p.number.trim()) return toast.error(`الرجاء إكمال اسم ورقم اللاعب رقم ${i + 1}.`);
      if (!p.personalFile && !p.personalIsExisting) return toast.error(`الرجاء إرفاق الصورة الشخصية للاعب ${p.name || i + 1}.`);
      if (!p.idFile && !p.idIsExisting) return toast.error(`الرجاء إرفاق صورة البطاقة للاعب ${p.name || i + 1}.`);
      touched++;
    }
    if (touched === 0) return toast.error("الرجاء تسجيل لاعب واحد على الأقل.");

    setSubmitting(true);
    try {
      // Team + player names/numbers first, as a small JSON request. Photos
      // are uploaded one at a time afterwards — a whole squad's photos sent
      // together in one request routinely exceeds the server's request-size
      // limit and gets rejected before it even reaches the app.
      setProgressLabel("جاري حفظ بيانات الفريق...");
      const res = await fetch("/api/roster/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suffix,
          teamName: teamName.trim(),
          managerName: managerName.trim(),
          managerPhone: managerPhone.trim(),
          coachName: coachName.trim(),
          players: players.map((p) => ({ name: p.name.trim(), number: p.number.trim() })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل حفظ بيانات الفريق");

      const rosterId = data.rosterId as string;
      const playerIds = (data.playerIds || []) as string[];

      const uploadOne = async (kind: "logo" | "coach" | "personal" | "id", file: File, playerId?: string) => {
        const uploadFd = new FormData();
        uploadFd.set("rosterId", rosterId);
        uploadFd.set("kind", kind);
        if (playerId) uploadFd.set("playerId", playerId);
        uploadFd.set("file", file);
        const r = await fetch("/api/roster/upload-photo", { method: "POST", body: uploadFd });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d?.error || "فشل رفع إحدى الصور");
      };

      // Only newly-picked files need uploading — anything already saved from
      // a previous visit (personalIsExisting/idIsExisting/etc.) is left as-is.
      const tasks: (() => Promise<void>)[] = [];
      if (logoFile) tasks.push(() => uploadOne("logo", logoFile));
      if (coachFile) tasks.push(() => uploadOne("coach", coachFile));
      players.forEach((p, i) => {
        const playerId = playerIds[i];
        if (p.personalFile) tasks.push(() => uploadOne("personal", p.personalFile!, playerId));
        if (p.idFile) tasks.push(() => uploadOne("id", p.idFile!, playerId));
      });

      let done = 0;
      setProgressLabel(`جاري رفع الصور... 0/${tasks.length}`);
      let nextIndex = 0;
      const worker = async () => {
        while (nextIndex < tasks.length) {
          const myIndex = nextIndex++;
          await tasks[myIndex]();
          done++;
          setProgressLabel(`جاري رفع الصور... ${done}/${tasks.length}`);
        }
      };
      await Promise.all(Array.from({ length: Math.min(3, tasks.length) }, worker));

      setCompletedCount(touched);
      setStep("success");
      toast.success("تم حفظ القائمة بنجاح ✅");
    } catch (e: any) {
      toast.error(e?.message || "حدث خطأ أثناء رفع الصور، يرجى المحاولة مرة أخرى.");
    } finally {
      setSubmitting(false);
      setProgressLabel("");
    }
  };

  if (step === "unlock") {
    return (
      <div className="space-y-4 rounded-2xl bg-card p-6 ring-1 ring-white/10">
        <div className="flex items-center gap-2 text-accent-blue">
          <Lock className="h-5 w-5" />
          <span className="text-body font-black">الرقم السري للتسجيل</span>
        </div>
        <p className="text-caption text-muted-foreground">
          أدخل كلمة سر البطولة، أو الرقم السري الخاص بطلب الدفع الذي أتمَّه مسئول الفريق.
        </p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          dir="ltr"
          placeholder="الرقم السري"
          className="h-12 w-full rounded-xl bg-secondary px-4 text-center text-body font-black tracking-widest outline-none ring-1 ring-white/10 focus:ring-accent-blue"
        />
        <button
          onClick={unlock}
          disabled={unlocking}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-body font-black text-primary-foreground disabled:opacity-60"
        >
          {unlocking ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          دخول
        </button>
      </div>
    );
  }

  if (step === "success") {
    const isComplete = completedCount >= maxPlayers;
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-8 text-center ring-1 ring-white/10">
        <CheckCircle2 className="h-12 w-12 text-accent-green" />
        <h2 className="text-h3 font-black">تم حفظ قائمة الفريق بنجاح</h2>
        {isComplete ? (
          <p className="text-caption text-muted-foreground">القائمة مكتملة ({completedCount}/{maxPlayers}). هيتم مراجعتها من فريق البطولة، وهتلاقي فريقك ظاهر في صفحة القوائم.</p>
        ) : (
          <div className="w-full rounded-xl bg-accent-orange/10 p-4 ring-1 ring-accent-orange/30">
            <p className="text-caption font-bold text-accent-orange">
              اتسجل {completedCount} من {maxPlayers} لاعب بس. تقدر ترجع بنفس الرقم السري فى أي وقت تكمل بيه باقي اللاعبين
              {deadline ? <> قبل <span className="font-black">{formatDeadline(deadline)}</span></> : null}.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {resumedNotice && (
        <div className="flex items-center gap-2 rounded-xl bg-accent-blue/10 px-4 py-2.5 text-caption font-bold text-accent-blue ring-1 ring-accent-blue/30">
          <ShieldCheck className="h-4 w-4 shrink-0" /> لقينا قائمة سابقة لفريقكم واتحمّلت تلقائي — كمّل أو عدّل اللي محتاجه بس.
        </div>
      )}
      {deadline && (
        <div className="flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2.5 text-caption font-bold text-muted-foreground">
          <Clock className="h-4 w-4 shrink-0" /> آخر موعد لاستكمال التسجيل: <span className="font-black text-foreground">{formatDeadline(deadline)}</span>
        </div>
      )}

      <input
        value={teamName}
        onChange={(e) => setTeamName(e.target.value)}
        onBlur={() => !resumedNotice && fetchExistingRoster(teamName)}
        placeholder="اسم الفريق"
        className="h-12 w-full rounded-xl bg-card px-4 text-body font-bold outline-none ring-1 ring-white/10 focus:ring-accent-blue"
      />
      <input
        value={managerName}
        onChange={(e) => setManagerName(e.target.value)}
        placeholder="اسم مسئول الفريق"
        className="h-12 w-full rounded-xl bg-card px-4 text-body font-bold outline-none ring-1 ring-white/10 focus:ring-accent-blue"
      />
      <input
        value={managerPhone}
        onChange={(e) => setManagerPhone(e.target.value)}
        placeholder="رقم موبايل مسئول الفريق"
        dir="ltr"
        className="h-12 w-full rounded-xl bg-card px-4 text-body font-bold outline-none ring-1 ring-white/10 focus:ring-accent-blue"
      />
      <label className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-card px-4 text-body font-bold text-muted-foreground ring-1 ring-white/10 hover:text-foreground">
        {logoPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoPreview} alt="" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <Camera className="h-4 w-4" />
        )}
        {logoPreview ? "تم اختيار شعار الفريق ✓" : "رفع شعار الفريق (اختياري)"}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoFile(e.target.files?.[0])} />
      </label>

      <div className="rounded-2xl bg-card p-4 ring-1 ring-white/10">
        <div className="mb-3 text-caption font-black text-muted-foreground">بيانات المدرب (اختياري)</div>
        <div className="flex items-center gap-3">
          <label className="flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-secondary ring-1 ring-white/10">
            {coachPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coachPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <Camera className="h-5 w-5 text-muted-foreground" />
            )}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleCoachFile(e.target.files?.[0])} />
          </label>
          <input
            value={coachName}
            onChange={(e) => setCoachName(e.target.value)}
            placeholder="اسم المدرب"
            className="h-12 flex-1 rounded-xl bg-secondary px-4 text-body font-bold outline-none ring-1 ring-white/10 focus:ring-accent-blue"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-caption font-black text-muted-foreground">
          قائمة اللاعبين — سجّل بأي عدد وكمّل الباقي لاحقًا (بحد أقصى {maxPlayers})
        </div>
        {players.map((p, i) => (
          <div key={i} className="rounded-2xl bg-card p-4 ring-1 ring-white/10">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-caption font-black text-primary-foreground">{i + 1}</span>
              <input
                value={p.name}
                onChange={(e) => updatePlayer(i, { name: e.target.value })}
                placeholder="اسم اللاعب"
                className="h-10 flex-1 rounded-lg bg-secondary px-3 text-caption font-bold outline-none ring-1 ring-white/10 focus:ring-accent-blue"
              />
              <input
                value={p.number}
                onChange={(e) => updatePlayer(i, { number: e.target.value })}
                placeholder="الرقم"
                dir="ltr"
                className="h-10 w-16 rounded-lg bg-secondary px-2 text-center text-caption font-bold outline-none ring-1 ring-white/10 focus:ring-accent-blue"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/15 bg-secondary py-3 text-caption font-bold text-muted-foreground hover:text-foreground">
                {p.personalPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.personalPreview} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                {p.personalPreview ? "الصورة الشخصية ✓" : "الصورة الشخصية"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePlayerFile(i, "personal", e.target.files?.[0])} />
              </label>
              <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/15 bg-secondary py-3 text-caption font-bold text-muted-foreground hover:text-foreground">
                {p.idPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.idPreview} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                {p.idPreview ? "صورة البطاقة ✓" : "صورة البطاقة"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePlayerFile(i, "id", e.target.files?.[0])} />
              </label>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={submit}
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-body font-black text-primary-foreground disabled:opacity-60"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {submitting ? progressLabel || "جاري الحفظ..." : "حفظ القائمة"}
      </button>
    </div>
  );
}
