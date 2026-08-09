"use client";

import { useState } from "react";
import { toast } from "sonner";
import { X, Save, Camera, Loader2 } from "lucide-react";
import { IdCard, type IdCardData } from "@/components/player-card/id-card";

export type Registration = {
  id: string;
  full_name: string;
  role: string;
  role_label: string;
  team_name: string;
  tournament_name: string;
  tournament_logo_url: string | null;
  serial_number: string;
  qr_payload: string;
  photo_url: string | null;
  national_id: string;
  birth_date: string;
  registration_date: string;
  crop_x: number | null;
  crop_y: number | null;
  zoom: number | null;
  created_at: string;
};

const inputCls = "h-10 w-full rounded-lg bg-secondary px-3 text-caption font-bold outline-none ring-1 ring-white/10 focus:ring-accent-blue";

const ROLE_OPTIONS = [
  { value: "player", label: "لاعب" },
  { value: "manager", label: "مدير فني" },
];

export function RegistrationEditModal({
  registration,
  onClose,
  onSaved,
}: {
  registration: Registration;
  onClose: () => void;
  onSaved: (row: Registration) => void;
}) {
  const [fullName, setFullName] = useState(registration.full_name || "");
  const [role, setRole] = useState(registration.role || "player");
  const [teamName, setTeamName] = useState(registration.team_name || "");
  const [birthDate, setBirthDate] = useState(registration.birth_date || "");
  const [nationalId, setNationalId] = useState(registration.national_id || "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState(registration.photo_url || "");
  const [cropX, setCropX] = useState(registration.crop_x ?? 50);
  const [cropY, setCropY] = useState(registration.crop_y ?? 50);
  const [zoom, setZoom] = useState(registration.zoom ?? 1);
  const [saving, setSaving] = useState(false);

  const roleLabel = ROLE_OPTIONS.find((r) => r.value === role)?.label || "لاعب";

  const previewData: IdCardData = {
    fullName,
    role,
    roleLabel,
    team: teamName || "لاعب حر",
    tournament: registration.tournament_name,
    tournamentLogoUrl: registration.tournament_logo_url || undefined,
    serial: registration.serial_number,
    qrPayload: registration.qr_payload,
    birthDate,
    registrationDate: registration.registration_date,
    nationalId,
    photoUrl: photoPreview,
    cropX,
    cropY,
    zoom,
  };

  const handlePhoto = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("اختار صورة صحيحة");
    if (file.size > 4 * 1024 * 1024) return toast.error("حجم الصورة كبير (أقصى 4 ميجا)");
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const save = async () => {
    if (!fullName.trim()) return toast.error("اكتب الاسم");
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("id", registration.id);
      fd.set("fullName", fullName.trim());
      fd.set("role", role);
      fd.set("roleLabel", roleLabel);
      fd.set("teamName", teamName.trim() || "لاعب حر");
      fd.set("birthDate", birthDate);
      fd.set("nationalId", nationalId.trim());
      fd.set("cropX", String(cropX));
      fd.set("cropY", String(cropY));
      fd.set("zoom", String(zoom));
      if (photoFile) fd.set("photo", photoFile);

      const res = await fetch("/api/admin/player-registrations", { method: "PATCH", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "فشل الحفظ");
      toast.success("تم حفظ التعديلات");
      onSaved(data.row);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "فشل حفظ التعديلات");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        dir="rtl"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-brand-dark p-5 ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-h3 font-black">تعديل بطاقة {registration.full_name}</h2>
          <button onClick={onClose} className="rounded-full bg-white/5 p-2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <IdCard data={previewData} />
          </div>

          <div className="space-y-3">
            <div className="flex gap-2 rounded-full bg-card p-1 ring-1 ring-white/10">
              {ROLE_OPTIONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRole(r.value)}
                  className={`flex-1 rounded-full py-1.5 text-caption font-black transition-colors ${role === r.value ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="الاسم بالكامل" className={inputCls} />
            <input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="اسم الفريق" className={inputCls} />
            <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={inputCls} />
            <input value={nationalId} onChange={(e) => setNationalId(e.target.value)} placeholder="الرقم القومي" dir="ltr" className={inputCls} />

            <label className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-card text-caption font-bold text-muted-foreground ring-1 ring-white/10 hover:text-foreground">
              <Camera className="h-4 w-4" />
              {photoFile ? "تم اختيار صورة جديدة ✓" : "تغيير الصورة"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhoto(e.target.files?.[0])} />
            </label>

            {photoPreview && (
              <div className="space-y-2 rounded-xl bg-card p-3 ring-1 ring-white/10">
                <div className="flex items-center gap-2">
                  <span className="w-14 text-[11px] font-bold text-muted-foreground">أفقي</span>
                  <input type="range" min={0} max={100} value={cropX} onChange={(e) => setCropX(Number(e.target.value))} className="flex-1" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-14 text-[11px] font-bold text-muted-foreground">رأسي</span>
                  <input type="range" min={0} max={100} value={cropY} onChange={(e) => setCropY(Number(e.target.value))} className="flex-1" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-14 text-[11px] font-bold text-muted-foreground">تكبير</span>
                  <input type="range" min={1} max={2} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1" />
                </div>
              </div>
            )}

            <button
              onClick={save}
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-body font-black text-primary-foreground disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              حفظ التعديلات
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
