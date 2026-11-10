import { useEffect, useRef, useState } from "react";

const parts = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [["Days", Math.floor(s / 86400)], ["Hours", Math.floor((s % 86400) / 3600)], ["Minutes", Math.floor((s % 3600) / 60)], ["Seconds", s % 60]];
};

export function useCountdown(target, onDone) {
  const [left, setLeft] = useState(() => (target ? new Date(target) - Date.now() : 0));
  const done = useRef(false);
  useEffect(() => {
    done.current = false;
    if (!target) return undefined;
    const tick = () => {
      const l = new Date(target) - Date.now();
      setLeft(l);
      if (l <= 0 && !done.current) { done.current = true; onDone?.(); }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps
  return left;
}

export function Countdown({ target, onDone, compact = false }) {
  const left = useCountdown(target, onDone);
  if (!target) return null;
  const p = parts(left);
  const shown = compact ? p.filter(([, v], i) => v > 0 || i >= 2) : p;
  return (
    <div className="flex gap-2 sm:gap-4" data-testid="countdown">
      {shown.map(([label, v]) => (
        <div key={label} className="flex flex-col items-center" data-testid={`countdown-${label.toLowerCase()}`}>
          <span className="font-display font-black text-4xl sm:text-6xl tabular-nums w-[2.4ch] text-center rounded-2xl bg-white/5 border border-white/10 py-2 sm:py-3 text-amber-400 shadow-[0_0_30px_rgba(245,180,0,.12)]">
            {String(v).padStart(2, "0")}
          </span>
          <span className="mt-2 text-[10px] sm:text-xs uppercase tracking-[0.25em] text-slate-400">{label}</span>
        </div>
      ))}
    </div>
  );
}
