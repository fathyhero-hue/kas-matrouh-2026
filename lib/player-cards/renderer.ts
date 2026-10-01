export const CARD_WIDTH = 640;
export const CARD_HEIGHT = 404;
export const CARD_ASPECT_RATIO = CARD_WIDTH / CARD_HEIGHT;

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

export const BRAND_LOGO = "/tournament-logos/matrouh-sports.png";

const LABELS = {
  brand: "\u0645\u0637\u0631\u0648\u062d \u0627\u0644\u0631\u064a\u0627\u0636\u064a\u0629",
  card: "\u0628\u0637\u0627\u0642\u0629 \u0631\u064a\u0627\u0636\u064a\u0629",
  name: "\u0627\u0644\u0627\u0633\u0645",
  team: "\u0627\u0644\u0641\u0631\u064a\u0642",
  role: "\u0627\u0644\u0635\u0641\u0629",
  birthDate: "\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0645\u064a\u0644\u0627\u062f",
  registrationDate: "\u0627\u0644\u062a\u0633\u062c\u064a\u0644",
  nationalId: "\u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0642\u0648\u0645\u064a",
  player: "\u0644\u0627\u0639\u0628",
  manager: "\u0645\u062f\u064a\u0631 \u0641\u0646\u064a",
  noPhoto: "\u0644\u0627 \u062a\u0648\u062c\u062f \u0635\u0648\u0631\u0629",
  unavailable: "\u063a\u064a\u0631 \u0645\u0639\u0631\u0648\u0636",
} as const;

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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function wrapLines(value: string, maxChars: number, maxLines = 2) {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return ["..."];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && next.length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;
  const result = lines.slice(0, maxLines);
  const last = result[maxLines - 1];
  result[maxLines - 1] = `${last.slice(0, Math.max(1, maxChars - 1))}\u2026`;
  return result;
}

function textBlock(
  value: unknown,
  options: {
    x: number;
    y: number;
    anchor?: "start" | "middle" | "end";
    fill: string;
    fontSize: number;
    maxChars: number;
    maxLines?: number;
    lineHeight?: number;
    fontWeight?: number;
    direction?: "rtl" | "ltr";
  },
) {
  const lines = wrapLines(String(value || ""), options.maxChars, options.maxLines ?? 2);
  const longest = Math.max(...lines.map((line) => line.length));
  const fontSize = Math.max(10, Math.min(options.fontSize, options.fontSize * options.maxChars / Math.max(options.maxChars, longest)));
  const tspans = lines.map((line, index) => `<tspan x="${options.x}" dy="${index === 0 ? 0 : options.lineHeight ?? fontSize * 1.18}">${xmlText(line)}</tspan>`).join("");
  return `<text x="${options.x}" y="${options.y}" text-anchor="${options.anchor ?? "end"}" fill="${options.fill}" font-size="${fontSize.toFixed(1)}" font-weight="${options.fontWeight ?? 700}" direction="${options.direction ?? "rtl"}" unicode-bidi="plaintext">${tspans}</text>`;
}

function maskNationalId(value?: string) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return LABELS.unavailable;
  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

function photoMarkup(data: CardRenderData) {
  const x = 28;
  const y = 116;
  const width = 176;
  const height = 208;
  if (!data.photoUrl) {
    return [
      `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="20" fill="#e2e8f0"/>`,
      `<text x="${x + width / 2}" y="${y + height / 2 + 6}" text-anchor="middle" fill="#64748b" font-size="15" font-weight="800">${LABELS.noPhoto}</text>`,
    ].join("");
  }
  const cropX = clamp(Number(data.cropX ?? 50), 0, 100);
  const cropY = clamp(Number(data.cropY ?? 50), 0, 100);
  const zoom = clamp(Number(data.zoom ?? 1), 1, 2);
  const translateX = (1 - zoom) * width * (cropX / 100);
  const translateY = (1 - zoom) * height * (cropY / 100);
  return [
    `<clipPath id="player-photo-clip"><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="20"/></clipPath>`,
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="20" fill="#e2e8f0"/>`,
    `<g clip-path="url(#player-photo-clip)"><image href="${xmlImage(data.photoUrl)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" transform="translate(${translateX.toFixed(2)} ${translateY.toFixed(2)}) translate(${x} ${y}) scale(${zoom.toFixed(3)}) translate(${-x} ${-y})"/></g>`,
  ].join("");
}

function qrMarkup(qrDataUrl?: string) {
  if (!qrDataUrl) return `<rect x="536" y="316" width="64" height="64" rx="7" fill="#e2e8f0"/><text x="568" y="353" text-anchor="middle" fill="#64748b" font-size="10" font-weight="800">QR</text>`;
  return `<image href="${xmlImage(qrDataUrl)}" x="536" y="316" width="64" height="64" preserveAspectRatio="xMidYMid meet"/>`;
}

function svgOpen(data: CardRenderData) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${xmlText(data.fullName || data.tournament)}" style="font-family:Cairo,Tajawal,Arial,sans-serif">`;
}

function renderBack(data: CardRenderData) {
  return [
    svgOpen(data),
    `<defs><linearGradient id="back-gradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#24134b"/><stop offset=".48" stop-color="#4b1690"/><stop offset=".82" stop-color="#155eaa"/><stop offset="1" stop-color="#0f766e"/></linearGradient><radialGradient id="back-glow" cx="1" cy="0"><stop offset="0" stop-color="#ffffff" stop-opacity=".22"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs>`,
    `<rect x="0" y="0" width="640" height="404" rx="26" fill="url(#back-gradient)"/>`,
    `<rect x="0" y="0" width="640" height="404" rx="26" fill="url(#back-glow)"/>`,
    `<path d="M24 326L178 172L250 244L382 112L616 346" fill="none" stroke="#ffffff" stroke-opacity=".08" stroke-width="24"/>`,
    `<circle cx="92" cy="72" r="52" fill="#ffffff" fill-opacity=".05"/><circle cx="548" cy="332" r="74" fill="#22c55e" fill-opacity=".08"/>`,
    `<image href="${xmlImage(BRAND_LOGO)}" x="270" y="58" width="100" height="100" preserveAspectRatio="xMidYMid meet"/>`,
    `<text x="320" y="216" text-anchor="middle" fill="#ffffff" font-size="28" font-weight="900" direction="rtl">${xmlText(data.tournament)}</text>`,
    `<text x="320" y="258" text-anchor="middle" fill="#fde047" font-size="19" font-weight="900" direction="rtl">${data.role === "manager" ? LABELS.manager : LABELS.card}</text>`,
    `<line x1="230" y1="286" x2="410" y2="286" stroke="#ffffff" stroke-opacity=".28"/>`,
    `<text x="320" y="319" text-anchor="middle" fill="#ffffff" fill-opacity=".86" font-size="13" font-weight="700" direction="rtl">${LABELS.brand}</text>`,
    `</svg>`,
  ].join("");
}

function renderFront(data: CardRenderData, qrDataUrl?: string) {
  const tournamentLogo = data.tournamentLogoUrl || BRAND_LOGO;
  const role = data.role === "manager" ? LABELS.manager : data.roleLabel || LABELS.player;
  return [
    svgOpen(data),
    `<defs><linearGradient id="front-wash" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f8fafc"/><stop offset=".58" stop-color="#f1f5f9"/><stop offset="1" stop-color="#e8f7f4"/></linearGradient><linearGradient id="top-bar" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4b1690"/><stop offset=".5" stop-color="#1da1f2"/><stop offset="1" stop-color="#14b8a6"/></linearGradient><linearGradient id="role-pill" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4b1690"/><stop offset="1" stop-color="#0d9488"/></linearGradient></defs>`,
    `<rect x="0" y="0" width="640" height="404" rx="26" fill="url(#front-wash)" stroke="#cbd5e1" stroke-width="2"/>`,
    `<path d="M24 104H616M24 108H616" stroke="#4b1690" stroke-opacity=".07" stroke-width="2"/>`,
    `<rect x="24" y="20" width="592" height="4" rx="2" fill="url(#top-bar)"/>`,
    `<image href="${xmlImage(BRAND_LOGO)}" x="536" y="30" width="52" height="52" preserveAspectRatio="xMidYMid meet"/>`,
    `<image href="${xmlImage(tournamentLogo)}" x="404" y="34" width="42" height="42" preserveAspectRatio="xMidYMid meet"/>`,
    textBlock(data.tournament, { x: 612, y: 97, anchor: "end", fill: "#64748b", fontSize: 11, maxChars: 21, maxLines: 2, lineHeight: 13, fontWeight: 800 }),
    `<image href="${xmlImage(data.teamLogoUrl)}" x="28" y="30" width="52" height="52" preserveAspectRatio="xMidYMid meet"/>`,
    textBlock(data.team, { x: 54, y: 98, anchor: "middle", fill: "#334155", fontSize: 11, maxChars: 14, maxLines: 2, lineHeight: 13, fontWeight: 900 }),
    `<text x="532" y="55" text-anchor="end" fill="#4b1690" font-size="16" font-weight="900" direction="rtl">${LABELS.brand}</text>`,
    `<text x="532" y="76" text-anchor="end" fill="#64748b" font-size="10" font-weight="700" direction="rtl">${LABELS.card}</text>`,
    photoMarkup(data),
    `<rect x="40" y="332" width="152" height="26" rx="13" fill="url(#role-pill)"/>`,
    `<text x="116" y="350" text-anchor="middle" fill="#ffffff" font-size="12" font-weight="900" direction="rtl">${xmlText(role)}</text>`,
    `<text x="116" y="382" text-anchor="middle" fill="#475569" font-size="10" font-weight="900" direction="ltr">${xmlText(data.serial)}</text>`,
    `<g>
      <text x="612" y="132" text-anchor="end" fill="#64748b" font-size="10" font-weight="900" direction="rtl">${LABELS.name}</text>
      ${textBlock(data.fullName, { x: 612, y: 160, anchor: "end", fill: "#0f172a", fontSize: 22, maxChars: 25, maxLines: 2, lineHeight: 24, fontWeight: 900 })}
      <line x1="230" y1="204" x2="612" y2="204" stroke="#cbd5e1"/>
      <text x="612" y="228" text-anchor="end" fill="#64748b" font-size="10" font-weight="900" direction="rtl">${LABELS.team}</text>
      ${textBlock(data.team, { x: 540, y: 250, anchor: "end", fill: "#0f766e", fontSize: 14, maxChars: 18, maxLines: 2, lineHeight: 16, fontWeight: 900 })}
      <image href="${xmlImage(data.teamLogoUrl)}" x="552" y="226" width="28" height="28" preserveAspectRatio="xMidYMid meet"/>
      <text x="412" y="228" text-anchor="end" fill="#64748b" font-size="10" font-weight="900" direction="rtl">${LABELS.role}</text>
      ${textBlock(role, { x: 412, y: 250, anchor: "end", fill: "#4b1690", fontSize: 14, maxChars: 12, maxLines: 2, lineHeight: 16, fontWeight: 900 })}
      <text x="612" y="278" text-anchor="end" fill="#64748b" font-size="10" font-weight="900" direction="rtl">${LABELS.birthDate}</text>
      <text x="612" y="299" text-anchor="end" fill="#0f172a" font-size="14" font-weight="900" direction="ltr">${xmlText(data.birthDate, "----/--/--")}</text>
      <text x="412" y="278" text-anchor="end" fill="#64748b" font-size="10" font-weight="900" direction="rtl">${LABELS.registrationDate}</text>
      <text x="412" y="299" text-anchor="end" fill="#0f172a" font-size="14" font-weight="900" direction="ltr">${xmlText(data.registrationDate, "----/--/--")}</text>
      <text x="612" y="326" text-anchor="end" fill="#64748b" font-size="10" font-weight="900" direction="rtl">${LABELS.nationalId}</text>
      <text x="612" y="347" text-anchor="end" fill="#0f172a" font-size="14" font-weight="900" direction="ltr">${xmlText(maskNationalId(data.nationalId))}</text>
    </g>`,
    `<rect x="230" y="363" width="232" height="12" rx="3" fill="#111827"/>`,
    `<path d="M230 363h232" stroke="#ffffff" stroke-width="2" stroke-dasharray="2 8 4 5 1 7" opacity=".85"/>`,
    `<text x="346" y="394" text-anchor="middle" fill="#475569" font-size="9" font-weight="900" direction="ltr">${xmlText(data.serial)}</text>`,
    qrMarkup(qrDataUrl),
    `</svg>`,
  ].join("");
}

export function renderCardSvg(data: CardRenderData, face: "front" | "back", qrDataUrl?: string) {
  return face === "back" ? renderBack(data) : renderFront(data, qrDataUrl);
}
