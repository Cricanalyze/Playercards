import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { fmtDate } from "@/lib/api";

const useWide = () => {
  const [wide, setWide] = useState(() => window.innerWidth >= 1024);
  useEffect(() => { const f = () => setWide(window.innerWidth >= 1024); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);
  return wide;
};

const Cover = ({ name, count }) => (
  <div className="h-full w-full rounded-r-xl bg-[#0b1a3a] text-white flex flex-col items-center justify-center p-6 text-center relative overflow-hidden" data-testid="flipbook-cover">
    <div className="absolute inset-0 stage-grid opacity-30" />
    <img src="/logo-mark.png" alt="" className="relative w-24 h-24 object-contain" />
    <p className="relative mt-4 text-[10px] tracking-[0.35em] uppercase text-amber-400">FlexoCards</p>
    <p className="relative font-display font-black uppercase text-3xl sm:text-4xl leading-none mt-2">My Storybook</p>
    <p className="relative mt-3 text-sm text-slate-300">{name}</p>
    <p className="relative mt-1 text-xs text-slate-400">{count} card{count === 1 ? "" : "s"}</p>
  </div>
);

const Leaf = ({ page, url, n, side }) => (
  <div className={`h-full w-full bg-[#f7f3ea] text-slate-900 flex flex-col p-4 sm:p-5 ${side === "left" ? "rounded-l-xl" : "rounded-r-xl"}`}>
    <div className="flex-1 min-h-0 grid place-items-center protect">
      {url ? <img src={url} alt={page.title} draggable={false} className="max-h-full max-w-full object-contain drop-shadow-[0_12px_20px_rgba(0,0,0,.25)] rounded-md" />
        : <div className="w-2/3 aspect-[5/7] rounded-md bg-slate-200 animate-pulse" />}
    </div>
    <div className="pt-3 flex items-end justify-between gap-2 border-t border-slate-300/70 mt-3">
      <div className="min-w-0"><p className="font-display font-black uppercase truncate">{page.title}</p><p className="text-[11px] text-slate-500 truncate">{page.sport} · {fmtDate(page.created_at)}</p></div>
      <span className="text-[11px] text-slate-400 font-mono">{n}</span>
    </div>
  </div>
);

export function FlipBook({ pages, urls, name }) {
  const wide = useWide();
  const step = wide ? 2 : 1;
  const items = [{ cover: true }, ...pages];
  // wide: spread 0 = [blank, cover], spread k = [items[2k-1], items[2k]]; narrow: one item per view
  const total = wide ? 1 + Math.ceil((items.length - 1) / 2) : items.length;
  const [i, setI] = useState(0);
  const [dir, setDir] = useState("next");
  useEffect(() => { setI(0); }, [wide]);
  const go = (d) => { setDir(d > 0 ? "next" : "prev"); setI((v) => Math.min(Math.max(0, v + d), total - 1)); };
  useEffect(() => {
    const k = (e) => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  const view = (idx, side) => {
    const it = items[idx];
    if (!it) return <div className={`h-full w-full bg-[#efe9db] ${side === "left" ? "rounded-l-xl" : "rounded-r-xl"}`} />;
    return it.cover ? <Cover name={name} count={pages.length} /> : <Leaf page={it} url={urls[it.id]} n={idx} side={side} />;
  };
  const shown = wide ? (i === 0 ? [null, 0] : [2 * i - 1, 2 * i]) : [i];
  const label = shown.filter((x) => x !== null && items[x] && !items[x].cover).join("–");
  return (
    <div className="flex flex-col items-center" data-testid="flipbook">
      <div className="relative w-full flex items-center justify-center gap-2 sm:gap-4">
        <button onClick={() => go(-1)} disabled={i === 0} aria-label="Previous page" data-testid="flipbook-prev"
          className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 grid place-items-center rounded-full border border-border hover:bg-amber-500 hover:text-slate-950 disabled:opacity-30 transition-colors"><ChevronLeft className="w-5 h-5" /></button>
        <div className="[perspective:2000px] w-full max-w-[860px]">
          <div key={`${i}-${dir}`} className={`flex h-[62vh] max-h-[640px] min-h-[380px] shadow-[0_30px_60px_rgba(0,0,0,.45)] rounded-xl ${dir === "next" ? "page-turn-next" : "page-turn-prev"}`}>
            {shown.map((idx, k) => (
              <div key={k} className={`h-full ${wide ? "w-1/2" : "w-full"} ${wide && k === 0 ? "border-r border-black/10 shadow-[inset_-18px_0_24px_-18px_rgba(0,0,0,.35)]" : ""}`}>
                {idx === null ? <div className="h-full w-full rounded-l-xl bg-gradient-to-r from-[#0b1a3a] to-[#13265a]" /> : view(idx, wide && k === 0 ? "left" : "right")}
              </div>
            ))}
          </div>
        </div>
        <button onClick={() => go(1)} disabled={i >= total - 1} aria-label="Next page" data-testid="flipbook-next"
          className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 grid place-items-center rounded-full border border-border hover:bg-amber-500 hover:text-slate-950 disabled:opacity-30 transition-colors"><ChevronRight className="w-5 h-5" /></button>
      </div>
      <p className="mt-4 text-xs text-muted-foreground" data-testid="flipbook-position">{label ? `Page ${label} of ${pages.length}` : "Cover"} · use the arrows or your keyboard</p>
    </div>
  );
}
