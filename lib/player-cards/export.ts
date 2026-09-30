import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import { CARD_HEIGHT, CARD_WIDTH, renderCardSvg, type CardRenderData } from "@/lib/player-cards/renderer";
import { cardsPerA4Page } from "@/lib/player-cards/pagination";

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CARD_W_MM = 92;
const CARD_H_MM = CARD_W_MM / (CARD_WIDTH / CARD_HEIGHT);
const GAP_MM = 6;
const MARGIN_X = (PAGE_WIDTH - CARD_W_MM * 2 - GAP_MM) / 2;
const MARGIN_Y = (PAGE_HEIGHT - CARD_H_MM * 2 - GAP_MM) / 2;

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
  const [photoUrl, tournamentLogoUrl] = await Promise.all([
    imageAsDataUrl(data.photoUrl),
    imageAsDataUrl(data.tournamentLogoUrl),
  ]);
  const teamLogoUrl = await imageAsDataUrl(data.teamLogoUrl);
  return { ...data, photoUrl, tournamentLogoUrl, teamLogoUrl };
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
    canvas.width = CARD_WIDTH * 2;
    canvas.height = CARD_HEIGHT * 2;
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

export async function downloadCardPdf(data: CardRenderData, filename = "player-card.pdf") {
  const [front, back] = await Promise.all([renderCardFacePng(data, "front"), renderCardFacePng(data, "back")]);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const x = (PAGE_WIDTH - CARD_W_MM) / 2;
  const y = (PAGE_HEIGHT - CARD_H_MM) / 2;
  doc.addImage(front, "PNG", x, y, CARD_W_MM, CARD_H_MM);
  doc.addPage();
  doc.addImage(back, "PNG", x, y, CARD_W_MM, CARD_H_MM);
  doc.save(filename);
}

export async function downloadCardsPdf(data: CardRenderData[], filename = "player-cards.pdf") {
  if (data.length === 0) return;
  const fronts = await Promise.all(data.map((item) => renderCardFacePng(item, "front")));
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  fronts.forEach((front, index) => {
    const position = index % cardsPerA4Page;
    if (index > 0 && position === 0) doc.addPage();
    const row = Math.floor(position / 2);
    const column = position % 2;
    doc.addImage(front, "PNG", MARGIN_X + column * (CARD_W_MM + GAP_MM), MARGIN_Y + row * (CARD_H_MM + GAP_MM), CARD_W_MM, CARD_H_MM);
  });
  doc.save(filename);
}
