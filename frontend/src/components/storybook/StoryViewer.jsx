import { useEffect, useRef, useState } from "react";
import { X, Pause, Play, Share2 } from "lucide-react";
import { toast } from "sonner";

const DURATION = 5000;

export function StoryViewer({ pages, urls, blobs, start = 0, onClose }) {
  const [i, setI] = useState(start);
  const [paused, setPaused] = useState(false);
  const [prog, setProg] = useState(0);
  const touch = useRef(null);
  const last = useRef(performance.now());
  const next = () => (i < pages.length - 1 ? (setI(i + 1), setProg(0)) : onClose());
  const prev = () => { setI(Math.max(0, i - 1)); setProg(0); };
  useEffect(() => {
    let raf;
    last.current = performance.now();
    const loop = (t) => {
      const dt = t - last.current;
      last.current = t;
      if (!paused) setProg((p) => p + dt / DURATION);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [paused, i]);
  useEffect(() => { if (prog >= 1) next(); }, [prog]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const k = (e) => { if (e.key === "ArrowRight") next(); if (e.key === "ArrowLeft") prev(); if (e.key === "Escape") onClose(); if (e.key === " ") setPaused((v) => !v); };
    window.addEventListener("keydown", k);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; };
  });
  const p = pages[i];
  const share = async (e) => {
    e.stopPropagation();
    const blob = blobs[p.id];
    if (!blob) return;
    const file = new File([blob], `${p.title || "card"}-flexocards.png`, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], title: p.title }); } catch { /* cancelled */ } return; }
    const a = document.createElement("a"); a.href = urls[p.id]; a.download = file.name; a.click();
    toast.success("Card downloaded");
  };
  const tap = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (e.clientX - r.left < r.width / 3) prev(); else next();
  };
  return (
    <div className="fixed inset-0 z-[90] bg-black flex items-center justify-center" data-testid="story-viewer">
      {urls[p.id] && <img src={urls[p.id]} alt="" className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-40 scale-110" />}
      <div className="relative h-full sm:h-[92vh] w-full sm:w-auto sm:aspect-[9/16] sm:rounded-2xl overflow-hidden bg-[#0b1a3a] select-none protect"
        onClick={tap}
        onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} onPointerLeave={() => setPaused(false)}
        onTouchStart={(e) => { touch.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - (touch.current ?? 0); if (Math.abs(dx) > 60) { e.preventDefault(); if (dx < 0) next(); else prev(); } }}>
        <div className="absolute top-0 inset-x-0 p-3 z-10 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex gap-1">
            {pages.map((x, k) => (
              <div key={x.id} className="h-1 flex-1 rounded-full bg-white/25 overflow-hidden">
                <div className="h-full bg-amber-400" style={{ width: `${k < i ? 100 : k === i ? Math.min(100, prog * 100) : 0}%` }} />
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-white">
            <img src="/logo-mark.png" alt="" className="w-8 h-8 rounded-full bg-white p-0.5 object-contain" />
            <div className="min-w-0 flex-1"><p className="text-sm font-bold truncate" data-testid="story-title">{p.title}</p><p className="text-[11px] text-white/70 truncate">{p.sport} · {i + 1} of {pages.length}</p></div>
            <button onClick={(e) => { e.stopPropagation(); setPaused((v) => !v); }} aria-label={paused ? "Play" : "Pause"} data-testid="story-pause" className="w-9 h-9 grid place-items-center rounded-full hover:bg-white/15">{paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}</button>
            <button onClick={share} aria-label="Share" data-testid="story-share" className="w-9 h-9 grid place-items-center rounded-full hover:bg-white/15"><Share2 className="w-4 h-4" /></button>
            <button onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Close" data-testid="story-close" className="w-9 h-9 grid place-items-center rounded-full hover:bg-white/15"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <div key={p.id} className="absolute inset-0 grid place-items-center p-4 pt-24 pb-10 rise">
          {urls[p.id] ? <img src={urls[p.id]} alt={p.title} draggable={false} className="max-h-full max-w-full object-contain rounded-lg drop-shadow-[0_20px_40px_rgba(0,0,0,.5)]" />
            : <div className="w-3/4 aspect-[5/7] rounded-lg bg-white/10 animate-pulse" />}
        </div>
        <p className="absolute bottom-3 inset-x-0 text-center text-[10px] tracking-[0.3em] uppercase text-white/50">Tap · swipe · hold to pause</p>
      </div>
    </div>
  );
}
