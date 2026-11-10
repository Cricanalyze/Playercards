import { jsPDF } from "jspdf";
import { fmtDate } from "@/lib/api";

const toDataUrl = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
const size = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.onerror = () => res([1, 1]); i.src = src; });

export async function buildStorybookPdf(pages, blobs, name) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, H = 297;
  // cover
  pdf.setFillColor(11, 26, 58); pdf.rect(0, 0, W, H, "F");
  pdf.setFillColor(245, 180, 0); pdf.rect(0, H - 14, W, 3, "F");
  try {
    const logo = await toDataUrl(await (await fetch("/logo-wordmark.png")).blob());
    const [lw, lh] = await size(logo);
    pdf.setFillColor(255, 255, 255); pdf.roundedRect(35, 70, 140, 140 * lh / lw + 12, 4, 4, "F");
    pdf.addImage(logo, "PNG", 41, 76, 128, 128 * lh / lw);
  } catch { /* logo optional */ }
  pdf.setTextColor(245, 180, 0); pdf.setFont("helvetica", "bold"); pdf.setFontSize(11);
  pdf.text("F L E X O C A R D S", W / 2, 150, { align: "center" });
  pdf.setTextColor(255, 255, 255); pdf.setFontSize(34);
  pdf.text("MY STORYBOOK", W / 2, 168, { align: "center" });
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(13); pdf.setTextColor(203, 213, 225);
  pdf.text(name || "", W / 2, 182, { align: "center" });
  pdf.setFontSize(10);
  pdf.text(`${pages.length} cards · made ${fmtDate(new Date().toISOString())}`, W / 2, 190, { align: "center" });
  let n = 0;
  for (const p of pages) {
    if (!blobs[p.id]) continue;
    n += 1;
    const img = await toDataUrl(blobs[p.id]);
    const [iw, ih] = await size(img);
    pdf.addPage();
    pdf.setFillColor(247, 243, 234); pdf.rect(0, 0, W, H, "F");
    const maxW = 170, maxH = 225, s = Math.min(maxW / iw, maxH / ih);
    const w = iw * s, h = ih * s;
    pdf.addImage(img, "PNG", (W - w) / 2, 18 + (maxH - h) / 2, w, h);
    pdf.setDrawColor(203, 213, 225); pdf.line(20, 252, W - 20, 252);
    pdf.setTextColor(11, 26, 58); pdf.setFont("helvetica", "bold"); pdf.setFontSize(15);
    pdf.text((p.title || "Player card").toUpperCase().slice(0, 48), 20, 262);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(10); pdf.setTextColor(100, 116, 139);
    pdf.text(`${p.sport || ""} · ${fmtDate(p.created_at)}`, 20, 269);
    pdf.text(String(n), W - 20, 262, { align: "right" });
    pdf.setFontSize(8); pdf.text("FlexoCards · Buddy Innovations and Technologies Private Limited", W / 2, H - 10, { align: "center" });
  }
  pdf.save(`flexocards-storybook-${new Date().toISOString().slice(0, 10)}.pdf`);
  return n;
}
