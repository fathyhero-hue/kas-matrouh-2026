"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

const BRAND_LOGO = "/tournament-logos/matrouh-sports.png";
const FONT_FAMILY = "'Cairo', 'Tajawal', system-ui, sans-serif";

export type IdCardData = {
  fullName: string;
  role: "player" | "manager" | string;
  roleLabel: string;
  team: string;
  tournament: string;
  tournamentLogoUrl?: string;
  serial: string;
  qrPayload: string;
  birthDate?: string;
  registrationDate?: string;
  nationalId?: string;
  photoUrl?: string;
  cropX?: number;
  cropY?: number;
  zoom?: number;
};

export function IdCard({ data }: { data: IdCardData }) {
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    // Generated client-side (no third-party network call) so it always
    // renders regardless of network/firewall conditions.
    QRCode.toDataURL(data.qrPayload, { width: 96, margin: 0 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [data.qrPayload]);

  const cropX = Number(data.cropX ?? 50);
  const cropY = Number(data.cropY ?? 50);
  const zoom = Number(data.zoom ?? 1);
  const cardType = data.role === "manager" ? "بطاقة مدير فني" : "بطاقة لاعب";

  return (
    <div dir="rtl" className="print-card-grid grid grid-cols-1 gap-5 justify-items-center">
      {/* Front */}
      <div className="id-card-print relative w-full max-w-[430px] aspect-[1.586/1] rounded-[22px] overflow-hidden shadow-2xl border border-[#d5d5d5] text-black bg-white">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(84,28,162,0.10),rgba(13,148,136,0.04)_44%,rgba(245,158,11,0.08)_100%)]"></div>
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#4b1690] via-[#1da1f2] to-[#22c55e]"></div>
        <div className="absolute -right-14 -top-14 w-44 h-44 rounded-full bg-[#4b1690]/8 blur-2xl"></div>
        <div className="absolute -left-16 -bottom-12 w-48 h-48 rounded-full bg-[#22c55e]/8 blur-2xl"></div>
        <div className="relative z-10 p-3 h-full flex flex-col" style={{ fontFamily: FONT_FAMILY }}>
          <div className="flex items-start justify-between gap-2 mb-1 shrink-0">
            <div className="flex items-center gap-1.5">
              <div className="w-10 h-10 rounded-full bg-transparent border-0 shadow-none p-0 overflow-visible">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={BRAND_LOGO} className="w-full h-full object-contain rounded-full" alt="مطروح الرياضية" />
              </div>
              <div>
                <div className="text-[#4b1690] text-[14px] leading-none font-black">مطروح الرياضية</div>
                <div className="text-[8px] text-gray-500 font-bold mt-0.5">بطاقة تعريف معتمدة</div>
              </div>
            </div>
            <div className="text-left flex flex-col items-center gap-1">
              <div className="w-12 h-12 object-contain bg-transparent border-0 p-0 overflow-visible">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={data.tournamentLogoUrl || BRAND_LOGO} className="w-full h-full object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,0.25)]" alt="بطولة" />
              </div>
              <div className="text-[7px] text-gray-500 font-black max-w-[92px] leading-tight text-center truncate">{data.tournament}</div>
            </div>
          </div>

          <div className="flex gap-2 flex-1 min-h-0 mt-0 overflow-hidden">
            <div className="w-[90px] shrink-0 flex flex-col items-center">
              <div className="relative w-[82px] h-[106px] rounded-[14px] overflow-hidden border-2 border-[#4b1690]/20 bg-gradient-to-b from-slate-100 to-slate-200 shadow-inner">
                {data.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.photoUrl}
                    alt="صورة المشارك"
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ objectPosition: `${cropX}% ${cropY}%`, transform: `scale(${zoom})` }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-500 font-black p-2 text-center">مكان الصورة</div>
                )}
              </div>
              <div className="mt-1 text-[8px] text-white font-black px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#4b1690] to-[#1da1f2] shadow-md">{data.role === "manager" ? "مدير فني" : "لاعب"}</div>
              <div className="mt-0.5 text-[6px] text-slate-600 font-black leading-none" dir="ltr">{data.serial}</div>
            </div>

            <div className="flex-1 min-w-0 flex flex-col justify-start overflow-hidden relative">
              <div className="space-y-0.5 text-right overflow-hidden pb-[46px]">
                <div>
                  <div className="text-[7px] text-gray-500 font-black leading-none">الاسم</div>
                  <div className="text-[13px] leading-tight font-black text-[#111827] border-b border-[#e6e6e6] pb-0.5 min-h-[18px] truncate">{data.fullName || "................"}</div>
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9px] leading-tight">
                  <div>
                    <div className="text-[7px] text-gray-500 font-black leading-none">الصفة</div>
                    <div className="font-black text-[#4b1690]">{data.roleLabel}</div>
                  </div>
                  <div>
                    <div className="text-[7px] text-gray-500 font-black leading-none">الفريق</div>
                    <div className="font-black text-[#0f766e] truncate leading-tight">{data.team || "لاعب حر"}</div>
                  </div>
                  <div>
                    <div className="text-[7px] text-gray-500 font-black leading-none">تاريخ الميلاد</div>
                    <div className="font-black">{data.birthDate || "----/--/--"}</div>
                  </div>
                  <div>
                    <div className="text-[7px] text-gray-500 font-black leading-none">تاريخ التسجيل</div>
                    <div className="font-black">{data.registrationDate}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-[7px] text-gray-500 font-black leading-none">الرقم القومي</div>
                    <div className="font-black tracking-wide leading-tight" dir="ltr">{data.nationalId || "00000000000000"}</div>
                  </div>
                </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 pt-1 grid grid-cols-[1fr_42px] items-end gap-1.5 border-t border-[#ececec] bg-white/80">
                <div className="text-center min-w-0">
                  <div className="flex items-end justify-center">
                    <div className="w-full min-w-[120px]">
                      <div className="h-[12px] rounded-sm overflow-hidden bg-[repeating-linear-gradient(90deg,#111_0_1px,transparent_1px_3px,#111_3px_5px,transparent_5px_8px,#111_8px_9px,transparent_9px_12px)]"></div>
                      <div className="text-[6px] text-slate-700 font-black mt-0.5 leading-none" dir="ltr">{data.serial}</div>
                    </div>
                  </div>
                </div>

                <div className="w-[36px] h-[36px] rounded-md bg-white border border-slate-200 p-0.5 overflow-hidden shrink-0">
                  {qrDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qrDataUrl} alt="QR Code" className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full animate-pulse bg-slate-200" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Back */}
      <div className="id-card-print relative w-full max-w-[430px] aspect-[1.586/1] rounded-[22px] overflow-hidden shadow-2xl border border-[#4b1690]/20 text-white">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#35115f_0%,#4b1690_45%,#1d4ed8_82%,#16a34a_100%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(249,115,22,0.20),transparent_28%)]"></div>
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.14]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BRAND_LOGO} className="w-[65%] h-[65%] object-contain" alt="Watermark" />
        </div>
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center p-6" style={{ fontFamily: FONT_FAMILY }}>
          <div className="w-20 h-20 rounded-full bg-white/12 backdrop-blur-sm p-2 shadow-2xl border border-white/20 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BRAND_LOGO} className="w-full h-full object-contain" alt="مطروح الرياضية" />
          </div>
          <div className="mt-5 text-[24px] leading-tight font-black text-white max-w-[280px]">{data.tournament}</div>
          <div className="mt-3 text-[15px] text-yellow-300 font-black tracking-wide">{cardType}</div>
        </div>
      </div>
    </div>
  );
}
