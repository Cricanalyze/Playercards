const KEY = "fc_last_card";

// Keeps a small copy of the user's last downloaded card on this device only (never uploaded).
export async function rememberCard(url, userId, meta) {
  const img = new Image();
  img.src = url;
  await img.decode();
  const w = 540;
  const c = document.createElement("canvas");
  c.width = w; c.height = Math.round((img.height / img.width) * w);
  const g = c.getContext("2d");
  g.fillStyle = "#0B0F17"; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(img, 0, 0, c.width, c.height);
  try { localStorage.setItem(KEY, JSON.stringify({ u: userId, url: c.toDataURL("image/jpeg", 0.85), at: Date.now(), ...meta })); } catch { /* storage full */ }
}

export function recallCard(userId) {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    return v && v.u === userId ? v : null;
  } catch { return null; }
}
