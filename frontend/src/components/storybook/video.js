const W = 1080, H = 1920, SEC = 5, FPS = 30;
const NAVY = "#0b1a3a", GOLD = "#f5b400";

const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

export const videoSupported = () => typeof MediaRecorder !== "undefined" && !!document.createElement("canvas").captureStream;

const pickMime = () => ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
  .find((m) => MediaRecorder.isTypeSupported(m)) || "";

const cover = (ctx, img) => {
  const s = Math.max(W / img.width, H / img.height);
  ctx.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
};

function draw(ctx, t, slides, logo) {
  const n = slides.length;
  const i = Math.min(n - 1, Math.floor(t / (SEC * 1000)));
  const local = (t - i * SEC * 1000) / (SEC * 1000);
  const { p, img } = slides[i];
  const fade = local < 0.08 ? local / 0.08 : local > 0.92 ? (1 - local) / 0.08 : 1;

  ctx.fillStyle = NAVY; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.globalAlpha = 0.55 * fade; ctx.filter = "blur(50px) brightness(0.6)"; cover(ctx, img); ctx.restore();
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "rgba(6,11,26,.85)"); g.addColorStop(0.3, "rgba(6,11,26,.2)"); g.addColorStop(0.75, "rgba(6,11,26,.2)"); g.addColorStop(1, "rgba(6,11,26,.9)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // card with slow zoom
  const zoom = 1 + 0.06 * local;
  const s = Math.min((W * 0.84) / img.width, (H * 0.6) / img.height) * zoom;
  const w = img.width * s, h = img.height * s, x = (W - w) / 2, y = H * 0.53 - h / 2 + (1 - fade) * 40;
  ctx.save(); ctx.globalAlpha = fade; ctx.shadowColor = "rgba(0,0,0,.6)"; ctx.shadowBlur = 60; ctx.shadowOffsetY = 30;
  ctx.drawImage(img, x, y, w, h); ctx.restore();

  // progress bars
  const pad = 48, gap = 10, bw = (W - pad * 2 - gap * (n - 1)) / n;
  for (let k = 0; k < n; k++) {
    ctx.fillStyle = "rgba(255,255,255,.25)"; ctx.fillRect(pad + k * (bw + gap), 56, bw, 8);
    const f = k < i ? 1 : k === i ? local : 0;
    ctx.fillStyle = GOLD; ctx.fillRect(pad + k * (bw + gap), 56, bw * f, 8);
  }
  // header
  if (logo) { ctx.save(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(pad + 44, 150, 44, 0, Math.PI * 2); ctx.fill(); ctx.drawImage(logo, pad + 8, 114, 72, 72); ctx.restore(); }
  ctx.fillStyle = "#fff"; ctx.font = "800 44px 'Barlow Condensed', 'DM Sans', sans-serif"; ctx.textBaseline = "middle";
  ctx.fillText((p.title || "Player card").toUpperCase().slice(0, 30), pad + 110, 136);
  ctx.fillStyle = "rgba(255,255,255,.7)"; ctx.font = "500 30px 'DM Sans', sans-serif";
  ctx.fillText(`${p.sport || ""}${p.sport ? " · " : ""}${i + 1} of ${n}`, pad + 110, 180);
  // footer
  ctx.textAlign = "center";
  ctx.font = "italic 900 64px 'Barlow Condensed', 'DM Sans', sans-serif";
  const fw = ctx.measureText("FLEXOCARDS").width, fx = W / 2 - fw / 2;
  ctx.textAlign = "left"; ctx.fillStyle = "#fff"; ctx.fillText("FLEXO", fx, H - 150);
  ctx.fillStyle = GOLD; ctx.fillText("CARDS", fx + ctx.measureText("FLEXO").width, H - 150);
  ctx.textAlign = "center"; ctx.fillStyle = "rgba(255,255,255,.6)"; ctx.font = "600 26px 'DM Sans', sans-serif";
  ctx.fillText("CREATE  ·  CUSTOMIZE  ·  SHARE", W / 2, H - 92);
  ctx.textAlign = "left";
}

// Records 5 seconds per card in real time; returns { blob, ext }.
export async function buildStoryVideo(pages, urls, onProgress) {
  const slides = [];
  for (const p of pages) if (urls[p.id]) slides.push({ p, img: await load(urls[p.id]) });
  if (!slides.length) throw new Error("No cards loaded yet");
  const logo = await load("/logo-mark.png").catch(() => null);
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  draw(ctx, 0, slides, logo);
  const mimeType = pickMime();
  const rec = new MediaRecorder(canvas.captureStream(FPS), { mimeType, videoBitsPerSecond: 8_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise((r) => { rec.onstop = r; });
  const total = slides.length * SEC * 1000;
  rec.start(500);
  const t0 = performance.now();
  await new Promise((done) => {
    const frame = () => {
      const t = performance.now() - t0;
      if (t >= total) { done(); return; }
      draw(ctx, t, slides, logo);
      onProgress?.(t / total);
      requestAnimationFrame(frame);
    };
    frame();
  });
  rec.stop();
  await stopped;
  const type = (mimeType || "video/webm").split(";")[0];
  return { blob: new Blob(chunks, { type }), ext: type.includes("mp4") ? "mp4" : "webm", seconds: slides.length * SEC };
}
