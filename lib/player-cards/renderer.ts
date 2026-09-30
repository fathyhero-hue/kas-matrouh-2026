export type CardRenderData = {
  fullName: string;
  role: "player" | "manager" | string;
  roleLabel: string;
  team: string;
  teamLogoUrl?: string;
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

export const CARD_WIDTH = 640;
export const CARD_HEIGHT = 404;
export const CARD_ASPECT_RATIO = CARD_WIDTH / CARD_HEIGHT;
export const BRAND_LOGO = "/tournament-logos/matrouh-sports.png";

function escapeXml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

const xmlText = (value: unknown, fallback = "") => escapeXml(value || fallback);
const xmlImage = (value?: string) => (value ? escapeXml(value) : "");

function photoMarkup(data: CardRenderData) {
  if (!data.photoUrl) {
    return [
      `<rect x="40" y="138" width="165" height="215" rx="20" fill="#e2e8f0"/>`,
      `<text x="122" y="250" text-anchor="middle" fill="#64748b" font-size="16" font-weight="700">مكان الصورة</text>`,
    ].join("");
  }
  const cropX = Math.min(100, Math.max(0, Number(data.cropX ?? 50)));
  const cropY = Math.min(100, Math.max(0, Number(data.cropY ?? 50)));
  const zoom = Math.min(2, Math.max(1, Number(data.zoom ?? 1)));
  const width = 165 * zoom;
  const height = 215 * zoom;
  const x = 40 + (165 - width) * (cropX / 100);
  const y = 138 + (215 - height) * (cropY / 100);
  return [
    `<clipPath id="player-photo-clip"><rect x="40" y="138" width="165" height="215" rx="20"/></clipPath>`,
    `<rect x="40" y="138" width="165" height="215" rx="20" fill="#e2e8f0"/>`,
    `<image href="${xmlImage(data.photoUrl)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" clip-path="url(#player-photo-clip)"/>`,
  ].join("");
}

function qrMarkup(qrDataUrl?: string) {
  if (!qrDataUrl) {
    return `<rect x="548" y="333" width="60" height="60" rx="5" fill="#e2e8f0"/><text x="578" y="368" text-anchor="middle" fill="#64748b" font-size="10" font-weight="700">QR</text>`;
  }
  return `<image href="${xmlImage(qrDataUrl)}" x="548" y="333" width="60" height="60" preserveAspectRatio="xMidYMid meet"/>`;
}

function svgOpen(data: CardRenderData) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" role="img" aria-label="${xmlText(data.fullName || data.tournament)}" style="font-family:Cairo,Tajawal,Arial,sans-serif">`;
}

function renderBack(data: CardRenderData) {
  return [
    svgOpen(data),
    `<defs>`,
    `<linearGradient id="back-gradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#35115f"/><stop offset=".48" stop-color="#4b1690"/><stop offset=".82" stop-color="#1d4ed8"/><stop offset="1" stop-color="#16a34a"/></linearGradient>`,
    `<radialGradient id="back-glow" cx="1" cy="0"><stop offset="0" stop-color="#ffffff" stop-opacity=".18"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>`,
    `</defs>`,
    `<rect width="640" height="404" rx="26" fill="url(#back-gradient)"/>`,
    `<rect width="640" height="404" rx="26" fill="url(#back-glow)"/>`,
    `<image href="${xmlImage(BRAND_LOGO)}" x="160" y="65" width="320" height="270" opacity=".14" preserveAspectRatio="xMidYMid meet"/>`,
    `<image href="${xmlImage(BRAND_LOGO)}" x="270" y="92" width="100" height="100" preserveAspectRatio="xMidYMid meet"/>`,
    `<text x="320" y="250" text-anchor="middle" fill="#ffffff" font-size="30" font-weight="900">${xmlText(data.tournament)}</text>`,
    `<text x="320" y="292" text-anchor="middle" fill="#fde047" font-size="19" font-weight="900">${xmlText(data.role === "manager" ? "بطاقة مدير فني" : "بطاقة لاعب")}</text>`,
    `</svg>`,
  ].join("");
}

function renderFront(data: CardRenderData, qrDataUrl?: string) {
  const tournamentLogo = data.tournamentLogoUrl || BRAND_LOGO;
  return [
    svgOpen(data),
    `<defs>`,
    `<linearGradient id="front-wash" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#541ca2" stop-opacity=".10"/><stop offset=".45" stop-color="#0d9488" stop-opacity=".04"/><stop offset="1" stop-color="#f59e0b" stop-opacity=".08"/></linearGradient>`,
    `<linearGradient id="top-bar" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4b1690"/><stop offset=".5" stop-color="#1da1f2"/><stop offset="1" stop-color="#22c55e"/></linearGradient>`,
    `<linearGradient id="role-pill" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4b1690"/><stop offset="1" stop-color="#1da1f2"/></linearGradient>`,
    `</defs>`,
    `<rect width="640" height="404" rx="26" fill="#ffffff" stroke="#d5d5d5"/>`,
    `<rect width="640" height="404" rx="26" fill="url(#front-wash)"/>`,
    `<rect width="640" height="8" rx="4" fill="url(#top-bar)"/>`,
    `<image href="${xmlImage(BRAND_LOGO)}" x="28" y="22" width="52" height="52" preserveAspectRatio="xMidYMid meet"/>`,
    `<text x="92" y="45" fill="#4b1690" font-size="19" font-weight="900">مطروح الرياضية</text>`,
    `<text x="92" y="66" fill="#6b7280" font-size="11" font-weight="700">بطاقة تعريف معتمدة</text>`,
    `<image href="${xmlImage(tournamentLogo)}" x="548" y="18" width="64" height="64" preserveAspectRatio="xMidYMid meet"/>`,
    `<text x="580" y="96" text-anchor="middle" fill="#6b7280" font-size="10" font-weight="900">${xmlText(data.tournament)}</text>`,
    photoMarkup(data),
    `<rect x="57" y="360" width="132" height="25" rx="12" fill="url(#role-pill)"/>`,
    `<text x="123" y="377" text-anchor="middle" fill="#ffffff" font-size="12" font-weight="900">${xmlText(data.role === "manager" ? "مدير فني" : "لاعب")}</text>`,
    `<text x="123" y="398" text-anchor="middle" fill="#475569" font-size="9" font-weight="900" direction="ltr">${xmlText(data.serial)}</text>`,
    `<g text-anchor="end">`,
    `<text x="520" y="143" fill="#6b7280" font-size="10" font-weight="900">الاسم</text>`,
    `<text x="520" y="166" fill="#111827" font-size="22" font-weight="900">${xmlText(data.fullName, "................")}</text>`,
    `<line x1="285" y1="174" x2="520" y2="174" stroke="#e5e7eb"/>`,
    `<text x="520" y="198" fill="#6b7280" font-size="10" font-weight="900">الفريق</text>`,
    data.teamLogoUrl ? `<image href="${xmlImage(data.teamLogoUrl)}" x="285" y="186" width="28" height="28" preserveAspectRatio="xMidYMid meet"/>` : "",
    `<text x="520" y="220" fill="#0f766e" font-size="15" font-weight="900">${xmlText(data.team, "لاعب حر")}</text>`,
    `<text x="400" y="198" fill="#6b7280" font-size="10" font-weight="900">الصفة</text>`,
    `<text x="400" y="220" fill="#4b1690" font-size="15" font-weight="900">${xmlText(data.roleLabel)}</text>`,
    `<text x="520" y="251" fill="#6b7280" font-size="10" font-weight="900">تاريخ الميلاد</text>`,
    `<text x="520" y="272" fill="#111827" font-size="14" font-weight="900">${xmlText(data.birthDate, "----/--/--")}</text>`,
    `<text x="400" y="251" fill="#6b7280" font-size="10" font-weight="900">التسجيل</text>`,
    `<text x="400" y="272" fill="#111827" font-size="14" font-weight="900">${xmlText(data.registrationDate)}</text>`,
    `<text x="520" y="302" fill="#6b7280" font-size="10" font-weight="900">الرقم القومي</text>`,
    `<text x="520" y="323" fill="#111827" font-size="14" font-weight="900" direction="ltr">${xmlText(data.nationalId, "00000000000000")}</text>`,
    `</g>`,
    `<line x1="285" y1="326" x2="530" y2="326" stroke="#ececec"/>`,
    `<rect x="285" y="344" width="240" height="13" rx="3" fill="#111827"/>`,
    `<path d="M285 344h240" stroke="#ffffff" stroke-width="2" stroke-dasharray="2 8 4 5 1 7" opacity=".85"/>`,
    `<text x="405" y="374" text-anchor="middle" fill="#475569" font-size="9" font-weight="900" direction="ltr">${xmlText(data.serial)}</text>`,
    qrMarkup(qrDataUrl),
    `</svg>`,
  ].join("");
}

export function renderCardSvg(data: CardRenderData, face: "front" | "back", qrDataUrl?: string) {
  return face === "back" ? renderBack(data) : renderFront(data, qrDataUrl);
}
