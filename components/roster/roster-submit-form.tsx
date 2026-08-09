"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Lock, Camera, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";

type PlayerRow = {
  name: string;
  number: string;
  personalFile: File | null;
  personalPreview: string;
  idFile: File | null;
  idPreview: string;
};

function emptyPlayers(count: number): PlayerRow[] {
  return Array.from({ length: count }, () => ({ name: "", number: "", personalFile: null, personalPreview: "", idFile: null, idPreview: "" }));
}

export function RosterSubmitForm({ tournament, suffix, maxPlayers }: { tournament: string; suffix: string; maxPlayers: number }) {
  const [step, setStep] = useState<"unlock" | "form" | "success">("unlock");
  const [code, setCode] = useState("");
  const [unlocking, setUnlocking] = useState(false);

  const [teamName, setTeamName] = useState("");
  const [managerName, setManagerName] = useState("");
  const [managerPhone, setManagerPhone] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [players, setPlayers] = useState<PlayerRow[]>(() => emptyPlayers(maxPlayers));
  const [submitting, setSubmitting] = useState(false);

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
      if (data.teamName) setTeamName(data.teamName);
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
  };

  const handlePlayerFile = (index: number, field: "personal" | "id", file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("اختار صورة صحيحة");
    if (file.size > 2 * 1024 * 1024) return toast.error("حجم الصورة كبير (أقصى 2 ميجا)");
    const preview = URL.createObjectURL(file);
    if (field === "personal") updatePlayer(index, { personalFile: file, personalPreview: preview });
    else updatePlayer(index, { idFile: file, idPreview: preview });
  };

  const submit = async () => {
    if (!teamName.trim()) return toast.error("يرجى كتابة اسم الفريق.");
    if (!managerName.trim() || !managerPhone.trim()) return toast.error("الرجاء إكمال بيانات مسئول الفريق (الاسم ورقم الهاتف).");
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p.name.trim() || !p.number.trim()) return toast.error(`الرجاء ملء بيانات جميع اللاعبين. اللاعب رقم ${i + 1} بياناته ناقصة.`);
      if (!p.personalFile || !p.idFile) return toast.error(`الرجاء إرفاق الصورة الشخصية وصورة البطاقة للاعب ${p.name || i + 1}.`);
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.set("suffix", suffix);
      fd.set("teamName", teamName.trim());
      fd.set("managerName", managerName.trim());
      fd.set("managerPhone", managerPhone.trim());
      if (logoFile) fd.set("logo", logoFile);
      fd.set("players", JSON.stringify(players.map((p) => ({ name: p.name.trim(), number: p.number.trim() }))));
      players.forEach((p, i) => {
        if (p.personalFile) fd.set(`player_${i}_personal`, p.personalFile);
        if (p.idFile) fd.set(`player_${i}_id`, p.idFile);
      });

      const res = await fetch("/api/roster/submit", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل حفظ القائمة");

      setStep("success");
      toast.success("تم رفع الصور واعتماد قائمة الفريق بنجاح ✅");
    } catch (e: any) {
      toast.error(e?.message || "حدث خطأ أثناء رفع الصور، يرجى المحاولة مرة أخرى.");
    } finally {
      setSubmitting(false);
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
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-8 text-center ring-1 ring-white/10">
        <CheckCircle2 className="h-12 w-12 text-accent-green" />
        <h2 className="text-h3 font-black">تم اعتماد قائمة الفريق بنجاح</h2>
        <p className="text-caption text-muted-foreground">هيتم مراجعة القائمة والصور من فريق البطولة، وهتلاقي فريقك ظاهر في صفحة القوائم.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <input
        value={teamName}
        onChange={(e) => setTeamName(e.target.value)}
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

      <div className="space-y-3">
        <div className="text-caption font-black text-muted-foreground">قائمة اللاعبين ({players.length})</div>
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
        {submitting ? "جاري رفع الصور..." : "حفظ واعتماد القائمة نهائياً"}
      </button>
    </div>
  );
}
