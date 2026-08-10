"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Camera, Download, RotateCcw, Lock, ShieldCheck, Loader2 } from "lucide-react";
import { IdCard, type IdCardData } from "./id-card";

const ROLE_OPTIONS = [
  { value: "player", label: "لاعب" },
  { value: "manager", label: "مدير فني" },
];

const BRAND_LOGO = "/tournament-logos/matrouh-sports.png";

type LinkedTournament = { tournamentKey: string; suffix: string };
type Tournament = { id: string; name: string; logo_url: string | null; linkedTournament: LinkedTournament | null };
type RosterPlayer = { name: string; photoUrl: string | null };
type RosterTeam = { team: string; logoUrl: string | null; coachName: string | null; coachPhotoUrl: string | null; players: RosterPlayer[] };

const inputCls = "h-12 w-full rounded-xl bg-card px-4 text-body font-bold outline-none ring-1 ring-white/10 focus:ring-accent-blue";

function generateSerial(prefix = "MTR") {
  const cleanPrefix = String(prefix || "MTR").replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase() || "MTR";
  const year = new Date().getFullYear();
  const stamp = Date.now().toString().slice(-6);
  const rnd = Math.floor(100 + Math.random() * 900);
  return `${cleanPrefix}-${year}-${stamp}${rnd}`;
}

export function RegistrationForm({ tournaments }: { tournaments: Tournament[] }) {
  const [tournamentId, setTournamentId] = useState(tournaments[0]?.id || "");
  const selectedTournament = useMemo(() => tournaments.find((t) => t.id === tournamentId) || tournaments[0], [tournaments, tournamentId]);
  const linked = selectedTournament?.linkedTournament || null;

  // Access-code gate — only shown for campaigns linked to a real tournament
  // roster (matrouh-cup/elite-cup). Reuses the exact same unlock endpoint the
  // team already used to submit their squad, so it's the same code.
  const [gateOpen, setGateOpen] = useState(false);
  const [code, setCode] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [rosterTeams, setRosterTeams] = useState<RosterTeam[]>([]);

  useEffect(() => {
    setGateOpen(false);
    setCode("");
    setRosterTeams([]);
  }, [tournamentId]);

  const unlock = async () => {
    if (!linked) return;
    if (!code.trim()) return toast.error("الرجاء إدخال الرقم السري.");
    setUnlocking(true);
    try {
      const res = await fetch("/api/roster/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournament: linked.tournamentKey, code: code.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "الرقم السري غير صحيح.");

      const teamsRes = await fetch(`/api/roster/team-players?suffix=${encodeURIComponent(linked.suffix)}`);
      const teamsData = await teamsRes.json().catch(() => ({}));
      const teams = (teamsData.teams || []) as RosterTeam[];
      setRosterTeams(teams);
      if (data.teamName) setTeamName(data.teamName);
      else if (teams[0]) setTeamName(teams[0].team);
      setGateOpen(true);
    } catch (e: any) {
      toast.error(e?.message || "تعذر التحقق من الرقم السري.");
    } finally {
      setUnlocking(false);
    }
  };

  const [role, setRole] = useState("player");
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [teamName, setTeamName] = useState("");
  const [manualEntry, setManualEntry] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [existingPhotoUrl, setExistingPhotoUrl] = useState("");
  const [cropX, setCropX] = useState(50);
  const [cropY, setCropY] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IdCardData | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const selectedRosterTeam = useMemo(() => rosterTeams.find((t) => t.team === teamName) || null, [rosterTeams, teamName]);

  // Only auto-clear the name/photo on team or role change when this is a
  // roster-linked campaign — teamName is a free-typed field otherwise, and
  // resetting on every keystroke would wipe out what the user is typing.
  useEffect(() => {
    if (!linked) return;
    setManualEntry(rosterTeams.length === 0);
    setFullName("");
    setExistingPhotoUrl("");
    setPhotoFile(null);
    setPhotoPreview("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamName, role, linked]);

  const handlePhoto = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("اختار صورة صحيحة");
    if (file.size > 4 * 1024 * 1024) return toast.error("حجم الصورة كبير (أقصى 4 ميجا)");
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setExistingPhotoUrl("");
    setCropX(50);
    setCropY(50);
    setZoom(1);
  };

  const pickRosterPlayer = (name: string) => {
    const p = selectedRosterTeam?.players.find((pl) => pl.name === name);
    setFullName(name);
    setPhotoFile(null);
    setExistingPhotoUrl(p?.photoUrl || "");
    setPhotoPreview(p?.photoUrl || "");
    setCropX(50);
    setCropY(50);
    setZoom(1);
  };

  const fillFromCoach = () => {
    if (!selectedRosterTeam?.coachName) return;
    setFullName(selectedRosterTeam.coachName);
    setPhotoFile(null);
    setExistingPhotoUrl(selectedRosterTeam.coachPhotoUrl || "");
    setPhotoPreview(selectedRosterTeam.coachPhotoUrl || "");
    setCropX(50);
    setCropY(50);
    setZoom(1);
  };

  const reset = () => {
    setFullName("");
    setBirthDate("");
    setNationalId("");
    setPhotoFile(null);
    setPhotoPreview("");
    setExistingPhotoUrl("");
    setResult(null);
  };

  const submit = async () => {
    if (!fullName.trim()) return toast.error("اكتب الاسم");
    if (!birthDate) return toast.error("اكتب تاريخ الميلاد");
    if (!nationalId.trim() || nationalId.replace(/\D/g, "").length < 10) return toast.error("الرقم القومي غير مكتمل");

    setLoading(true);
    try {
      const roleLabel = ROLE_OPTIONS.find((r) => r.value === role)?.label || "لاعب";
      const serial = generateSerial(selectedTournament?.id || "MTR");
      const qrPayload = JSON.stringify({ serial, name: fullName.trim(), role: roleLabel, tournament: selectedTournament?.name || "بطولة رياضية" });

      const fd = new FormData();
      fd.set("fullName", fullName.trim());
      fd.set("birthDate", birthDate);
      fd.set("nationalId", nationalId.trim());
      fd.set("teamName", teamName.trim() || "لاعب حر");
      fd.set("role", role);
      fd.set("roleLabel", roleLabel);
      fd.set("tournamentId", selectedTournament?.id || "");
      fd.set("tournamentName", selectedTournament?.name || "بطولة رياضية");
      fd.set("tournamentLogoUrl", selectedTournament?.logo_url || "/logo.png");
      fd.set("brandLogoUrl", BRAND_LOGO);
      fd.set("cropX", String(cropX));
      fd.set("cropY", String(cropY));
      fd.set("zoom", String(zoom));
      fd.set("serialNumber", serial);
      fd.set("qrPayload", qrPayload);
      fd.set("registrationDate", new Date().toISOString().slice(0, 10));
      if (photoFile) fd.set("photo", photoFile);
      else if (existingPhotoUrl) fd.set("existingPhotoUrl", existingPhotoUrl);

      const res = await fetch("/api/player-registrations/submit", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل التسجيل");

      setResult({
        serial,
        qrPayload,
        fullName: fullName.trim(),
        role,
        roleLabel,
        team: teamName.trim() || "لاعب حر",
        tournament: selectedTournament?.name || "بطولة رياضية",
        tournamentLogoUrl: selectedTournament?.logo_url || "/logo.png",
        birthDate,
        nationalId: nationalId.trim(),
        registrationDate: new Date().toISOString().slice(0, 10),
        photoUrl: data.photoUrl || photoPreview,
        cropX,
        cropY,
        zoom,
      });
      toast.success("تم تسجيل البيانات بنجاح ✅");
    } catch (e: any) {
      toast.error(e?.message || "حدث خطأ أثناء التسجيل");
    } finally {
      setLoading(false);
    }
  };

  const downloadCard = async () => {
    if (!cardRef.current) return;
    try {
      const htmlToImage = await import("html-to-image");
      const dataUrl = await htmlToImage.toPng(cardRef.current, { pixelRatio: 2 });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${result?.serial || "player-card"}.png`;
      link.click();
    } catch {
      toast.error("تعذر تحميل الكارت، جرب لقطة شاشة بدل كده");
    }
  };

  const tournamentPicker = tournaments.length > 1 && (
    <select
      value={tournamentId}
      onChange={(e) => setTournamentId(e.target.value)}
      className={inputCls}
    >
      {tournaments.map((t) => (
        <option key={t.id} value={t.id}>{t.name}</option>
      ))}
    </select>
  );

  if (result) {
    return (
      <div className="space-y-4">
        <div ref={cardRef}>
          <IdCard data={result} />
        </div>

        <button onClick={downloadCard} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-body font-black text-primary-foreground">
          <Download className="h-4 w-4" />
          تحميل الكارت
        </button>
        <button onClick={reset} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white/5 py-3 text-body font-black text-muted-foreground">
          <RotateCcw className="h-4 w-4" />
          تسجيل لاعب تاني
        </button>
      </div>
    );
  }

  if (linked && !gateOpen) {
    return (
      <div className="space-y-4">
        {tournamentPicker}
        <div className="space-y-4 rounded-2xl bg-card p-6 ring-1 ring-white/10">
          <div className="flex items-center gap-2 text-accent-blue">
            <Lock className="h-5 w-5" />
            <span className="text-body font-black">الرقم السري للتسجيل</span>
          </div>
          <p className="text-caption text-muted-foreground">
            تسجيل كروت "{selectedTournament?.name}" متاح بس للفرق المسجّلة — أدخل نفس الرقم السري اللي استلمه مسئول الفريق لتسجيل قائمة اللاعبين.
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
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tournamentPicker}

      <div className="flex gap-2 rounded-full bg-card p-1 ring-1 ring-white/10">
        {ROLE_OPTIONS.map((r) => (
          <button
            key={r.value}
            onClick={() => setRole(r.value)}
            className={`flex-1 rounded-full py-2 text-caption font-black transition-colors ${role === r.value ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {linked && rosterTeams.length > 0 ? (
        <select value={teamName} onChange={(e) => setTeamName(e.target.value)} className={inputCls}>
          {rosterTeams.map((t) => (
            <option key={t.team} value={t.team}>{t.team}</option>
          ))}
        </select>
      ) : (
        <input
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder="اسم الفريق (اختياري)"
          className={inputCls}
        />
      )}

      {linked && role === "manager" && selectedRosterTeam?.coachName && (
        <button
          type="button"
          onClick={fillFromCoach}
          className="flex w-full items-center justify-between gap-2 rounded-xl bg-accent-blue/10 px-4 py-3 text-caption font-bold text-accent-blue ring-1 ring-accent-blue/30"
        >
          <span>استخدام بيانات المدرب المسجّل: {selectedRosterTeam.coachName}</span>
          <ShieldCheck className="h-4 w-4 shrink-0" />
        </button>
      )}

      {linked && role === "player" && rosterTeams.length > 0 && !manualEntry ? (
        <select value={fullName} onChange={(e) => pickRosterPlayer(e.target.value)} className={inputCls}>
          <option value="">اختر اللاعب</option>
          {(selectedRosterTeam?.players || []).map((p) => (
            <option key={p.name} value={p.name}>{p.name}</option>
          ))}
        </select>
      ) : (
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="الاسم بالكامل"
          className={inputCls}
        />
      )}

      {linked && role === "player" && rosterTeams.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setManualEntry((v) => !v);
            setFullName("");
            setExistingPhotoUrl("");
            setPhotoPreview("");
          }}
          className="text-caption font-bold text-muted-foreground underline"
        >
          {manualEntry ? "اختيار لاعب من القائمة المسجّلة" : "اللاعب مش موجود فى القائمة"}
        </button>
      )}

      <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-5 ring-1 ring-white/10">
        <div className="relative h-28 w-28 overflow-hidden rounded-full bg-secondary">
          {photoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoPreview} alt="" className="h-full w-full object-cover" style={{ objectPosition: `${cropX}% ${cropY}%`, transform: `scale(${zoom})` }} />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Camera className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
        </div>
        <label className="cursor-pointer rounded-full bg-white/5 px-4 py-1.5 text-caption font-bold text-muted-foreground hover:text-foreground">
          {photoPreview ? "تغيير الصورة" : "رفع صورة شخصية"}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhoto(e.target.files?.[0])} />
        </label>

        {photoPreview && (
          <div className="w-full space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-16 text-caption font-bold text-muted-foreground">أفقي</span>
              <input type="range" min={0} max={100} value={cropX} onChange={(e) => setCropX(Number(e.target.value))} className="flex-1" />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-16 text-caption font-bold text-muted-foreground">رأسي</span>
              <input type="range" min={0} max={100} value={cropY} onChange={(e) => setCropY(Number(e.target.value))} className="flex-1" />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-16 text-caption font-bold text-muted-foreground">تكبير</span>
              <input type="range" min={1} max={2} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1" />
            </div>
          </div>
        )}
      </div>

      <input
        type="date"
        value={birthDate}
        onChange={(e) => setBirthDate(e.target.value)}
        className={inputCls}
      />
      <input
        value={nationalId}
        onChange={(e) => setNationalId(e.target.value)}
        placeholder="الرقم القومي"
        dir="ltr"
        className={inputCls}
      />

      <button
        onClick={submit}
        disabled={loading}
        className="w-full rounded-2xl bg-primary py-4 text-body font-black text-primary-foreground disabled:opacity-60"
      >
        {loading ? "جاري التسجيل..." : "سجّل الكارت"}
      </button>
    </div>
  );
}
