import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import { CARD_ASPECT_RATIO, CARD_HEIGHT, CARD_WIDTH, renderCardSvg, type CardRenderData } from "@/lib/player-cards/renderer";
import { A4_CARDS_PER_PAGE, containRect, getA4CardRect } from "@/lib/player-cards/layout";

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
  const rect = containRect(CARD_WIDTH, CARD_HEIGHT, 180, 277);
  doc.addImage(front, "PNG", 15 + rect.x, 10 + rect.y, rect.width, rect.height);
  doc.addPage();
  doc.addImage(back, "PNG", 15 + rect.x, 10 + rect.y, rect.width, rect.height);
  doc.save(filename);
}

export async function downloadCardsPdf(data: CardRenderData[], filename = "player-cards.pdf") {
  if (data.length === 0) return;
  const faces = await Promise.all(data.map(async (item) => ({
    front: await renderCardFacePng(item, "front"),
    back: await renderCardFacePng(item, "back"),
  })));
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  const addFacePages = (face: "front" | "back") => {
    faces.forEach((item, index) => {
      const rect = getA4CardRect(index, CARD_ASPECT_RATIO);
      if (index > 0 && index % A4_CARDS_PER_PAGE === 0) doc.addPage();
      doc.addImage(item[face], "PNG", rect.x, rect.y, rect.width, rect.height);
    });
  };

  addFacePages("front");
  doc.addPage();
  addFacePages("back");
  doc.save(filename);
}
