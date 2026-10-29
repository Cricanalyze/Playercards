import { jsPDF } from "jspdf";

const money = (n) => `Rs. ${Number(n || 0).toFixed(2)}`;

export function downloadInvoicePdf(inv) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  pdf.setFillColor(11, 26, 58); pdf.rect(0, 0, W, 34, "F");
  pdf.setTextColor(245, 180, 0); pdf.setFont("helvetica", "bolditalic"); pdf.setFontSize(22); pdf.text("FlexoCards", 15, 20);
  pdf.setTextColor(255, 255, 255); pdf.setFont("helvetica", "bold"); pdf.setFontSize(16); pdf.text(inv.title.toUpperCase(), W - 15, 16, { align: "right" });
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(9);
  pdf.text(`No. ${inv.number}`, W - 15, 23, { align: "right" }); pdf.text(`Date: ${new Date(inv.date).toLocaleDateString("en-IN")}`, W - 15, 28, { align: "right" });
  pdf.setTextColor(30, 41, 59);
  const s = inv.seller, b = inv.buyer;
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(9); pdf.text("FROM", 15, 46); pdf.text("BILL TO", 110, 46);
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(10);
  const left = [s.legal_name, ...(s.address ? pdf.splitTextToSize(s.address, 85) : []), s.state && `State: ${s.state}${s.state_code ? ` (${s.state_code})` : ""}`, s.gstin && `GSTIN: ${s.gstin}`, s.email, s.phone].filter(Boolean);
  const right = [b.name, b.email !== b.name && b.email, b.state && `State: ${b.state}`, b.gstin && `GSTIN: ${b.gstin}`].filter(Boolean);
  left.forEach((l, i) => pdf.text(l, 15, 52 + i * 5)); right.forEach((l, i) => pdf.text(l, 110, 52 + i * 5));
  let y = 58 + Math.max(left.length, right.length) * 5;
  pdf.setFillColor(241, 245, 249); pdf.rect(15, y, W - 30, 8, "F");
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(9);
  [["Description", 18], ["SAC", 110], ["Price", 130], ["Discount", 152], ["Taxable", W - 18]].forEach(([h, x], i) => pdf.text(h, x, y + 5.5, i === 4 ? { align: "right" } : undefined));
  pdf.setFont("helvetica", "normal"); y += 14;
  inv.lines.forEach((l) => {
    pdf.text(l.desc, 18, y); pdf.text(l.sac || "", 110, y); pdf.text(money(l.list_price), 130, y); pdf.text(money(l.discount), 152, y); pdf.text(money(l.taxable), W - 18, y, { align: "right" });
    y += 7;
  });
  pdf.setDrawColor(203, 213, 225); pdf.line(110, y, W - 15, y); y += 7;
  const row = (k, v, bold) => { pdf.setFont("helvetica", bold ? "bold" : "normal"); pdf.text(k, 130, y); pdf.text(v, W - 18, y, { align: "right" }); y += 6; };
  row("Taxable value", money(inv.taxable));
  inv.taxes.forEach((t) => row(t.name, money(t.amount)));
  if (inv.coupon) row(`Coupon ${inv.coupon}`, "applied");
  pdf.setFontSize(12); row("Total paid", money(inv.total), true); pdf.setFontSize(9);
  y += 6; pdf.setTextColor(100, 116, 139);
  pdf.text(`Payment ID: ${inv.payment_id || "-"} · Status: ${inv.status}`, 15, y);
  if (!s.gstin) pdf.text("This is a payment receipt. A GST tax invoice is issued once the seller's GSTIN is registered.", 15, y + 5);
  pdf.text("This is a computer-generated document and does not need a signature.", 15, 285);
  pdf.save(`${inv.number}.pdf`);
}
