import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import { BRAND_LOGO, PRINT_HEIGHT, PRINT_WIDTH, renderCardSvg, type CardRenderData } from "@/lib/player-cards/renderer";
import {
  A4_HEIGHT_MM,
  A4_WIDTH_MM,
  getA4CardRect,
  getCutGuideRect,
  PRINT_CARD_HEIGHT_MM,
  PRINT_CARD_WIDTH_MM,
  chunk,
} from "@/lib/player-cards/layout";

async function imageAsDataUrl(source: string | undefined) {
  if (!source || source.startsWith("data:")) return source;
  try {
    const response = await fetch(source, { mode: "cors" });
    if (!response.ok) return source;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return source;
  }
}

async function prepareData(data: CardRenderData) {
  await document.fonts?.ready;
  const [photoUrl, tournamentLogoUrl, teamLogoUrl, brandLogoUrl] = await Promise.all([
    imageAsDataUrl(data.photoUrl),
    imageAsDataUrl(data.tournamentLogoUrl),
    imageAsDataUrl(data.teamLogoUrl),
    imageAsDataUrl(BRAND_LOGO),
  ]);
  return { ...data, photoUrl, tournamentLogoUrl, teamLogoUrl, brandLogoUrl };
}

async function svgToPng(svg: string) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("تعذر تحميل صورة البطاقة."));
      element.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = PRINT_WIDTH * 2;
    canvas.height = PRINT_HEIGHT * 2;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("تعذر تجهيز مساحة تصدير البطاقة.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function renderCardFacePng(data: CardRenderData, face: "front" | "back") {
  const prepared = await prepareData(data);
  const qrDataUrl = await QRCode.toDataURL(prepared.qrPayload, { width: 220, margin: 0 });
  return svgToPng(renderCardSvg(prepared, face, qrDataUrl));
}

function drawCutGuides(doc: jsPDF, rect: { x: number; y: number; width: number; height: number }) {
  const guide = getCutGuideRect(rect);
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.1);
  doc.line(guide.x, guide.y, rect.x, guide.y);
  doc.line(guide.x, guide.y, guide.x, rect.y);
  doc.line(guide.x + guide.width, guide.y, rect.x + rect.width, guide.y);
  doc.line(guide.x + guide.width, guide.y, guide.x + guide.width, rect.y);
  doc.line(guide.x, guide.y + guide.height, rect.x, rect.y + rect.height);
  doc.line(guide.x, guide.y + guide.height, guide.x, rect.y + rect.height);
  doc.line(guide.x + guide.width, guide.y + guide.height, rect.x + rect.width, rect.y + rect.height);
  doc.line(guide.x + guide.width, guide.y + guide.height, guide.x + guide.width, rect.y + rect.height);
}

function addFace(doc: jsPDF, image: string, rect: { x: number; y: number; width: number; height: number }, showCutGuides: boolean) {
  doc.addImage(image, "PNG", rect.x, rect.y, rect.width, rect.height, undefined, "FAST");
  if (showCutGuides) drawCutGuides(doc, rect);
}

export async function createSingleCardPdf(data: CardRenderData) {
  const [front, back] = await Promise.all([renderCardFacePng(data, "front"), renderCardFacePng(data, "back")]);
  const doc = new jsPDF({ unit: "mm", format: [PRINT_CARD_WIDTH_MM, PRINT_CARD_HEIGHT_MM], orientation: "landscape", compress: true });
  doc.addImage(front, "PNG", 0, 0, PRINT_CARD_WIDTH_MM, PRINT_CARD_HEIGHT_MM, undefined, "FAST");
  doc.addPage([PRINT_CARD_WIDTH_MM, PRINT_CARD_HEIGHT_MM], "landscape");
  doc.addImage(back, "PNG", 0, 0, PRINT_CARD_WIDTH_MM, PRINT_CARD_HEIGHT_MM, undefined, "FAST");
  doc.setProperties({ title: data.fullName || "Player Card", subject: "Player card front and back" });
  return doc;
}

export async function downloadCardPdf(data: CardRenderData, filename = "player-card.pdf") {
  const doc = await createSingleCardPdf(data);
  doc.save(filename);
}

export async function createCardsPdf(data: CardRenderData[], showCutGuides = true) {
  if (data.length === 0) return null;
  const faces = await Promise.all(data.map(async (item) => ({
    front: await renderCardFacePng(item, "front"),
    back: await renderCardFacePng(item, "back"),
  })));
  const doc = new jsPDF({ unit: "mm", format: [A4_WIDTH_MM, A4_HEIGHT_MM], orientation: "portrait", compress: true });
  const pages = chunk(faces, 4);
  pages.forEach((page, pageIndex) => {
    if (pageIndex > 0) doc.addPage([A4_WIDTH_MM, A4_HEIGHT_MM], "portrait");
    page.forEach((item, playerIndex) => {
      addFace(doc, item.front, getA4CardRect(playerIndex, "front"), showCutGuides);
      addFace(doc, item.back, getA4CardRect(playerIndex, "back"), showCutGuides);
    });
  });
  doc.setProperties({ title: "Player Cards", subject: "Four player card fronts and backs per A4 sheet" });
  return doc;
}

export async function downloadCardsPdf(data: CardRenderData[], filename = "player-cards.pdf") {
  const doc = await createCardsPdf(data);
  if (doc) doc.save(filename);
}

export const PRINT_SHEET_SPEC = {
  a4: { width: A4_WIDTH_MM, height: A4_HEIGHT_MM },
  card: { width: PRINT_CARD_WIDTH_MM, height: PRINT_CARD_HEIGHT_MM },
};
