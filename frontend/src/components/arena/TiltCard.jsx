import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform, useMotionTemplate } from "framer-motion";
import { ScaledCard } from "@/components/card/PlayerCard";
import { useAppData } from "@/context/AppData";
import { demoFor } from "@/lib/cardUtils";

const clamp = (v) => Math.min(1, Math.max(0, v));
const isTouch = () => typeof window !== "undefined" && window.matchMedia?.("(hover: none)").matches;

// iOS only allows motion sensors after a tap; Android works straight away.
export const askTiltPermission = () => {
  const D = window.DeviceOrientationEvent;
  if (isTouch() && D && typeof D.requestPermission === "function") D.requestPermission().catch(() => {});
};

function useDeviceTilt(px, py) {
  useEffect(() => {
    if (!isTouch() || !window.DeviceOrientationEvent) return;
    let base = null;
    const on = (e) => {
      if (e.beta == null || e.gamma == null) return;
      if (base === null) base = e.beta;
      px.set(clamp(0.5 + e.gamma / 50));
      py.set(clamp(0.5 + (e.beta - base) / 50));
    };
    window.addEventListener("deviceorientation", on);
    return () => window.removeEventListener("deviceorientation", on);
  }, [px, py]);
}

const CardBack = ({ sport, data, serial }) => (
  <div className="face absolute inset-0 rounded-[14px] overflow-hidden night border border-amber-500/40 p-[7%] flex flex-col text-left" style={{ transform: "rotateY(180deg)" }}>
    <div className="flex justify-between font-mono text-[10px] uppercase tracking-widest text-amber-400"><span>FlexoCards · Certified</span><span>No. {serial}/500</span></div>
    <p className="font-poster font-black uppercase text-[2.1em] leading-[0.9] mt-4">{data.name || "Player"}</p>
    <p className="text-[0.78em] uppercase tracking-wider text-slate-400 mt-1">{sport?.name}{data.team ? ` · ${data.team}` : ""}</p>
    <div className="mt-4 flex-1 divide-y divide-white/10 border-y border-white/10">
      {(sport?.stats || []).slice(0, 6).map((s) => (
        <div key={s.key} className="flex justify-between py-[0.42em] text-[0.8em]"><span className="text-slate-400 uppercase tracking-wide">{s.label}</span><span className="font-mono font-bold">{data.stats?.[s.key] || "—"}</span></div>
      ))}
    </div>
    <div className="mt-4 flex items-end justify-between gap-3">
      <div className="barcode h-8 flex-1 text-white/80" />
      {data.rating && <span className="font-poster font-black text-[2em] leading-none text-amber-400">{data.rating}</span>}
    </div>
    <p className="font-marker text-[0.72em] text-slate-400 mt-2">tap to flip back</p>
  </div>
);

export function TiltCard({ width, template, sport, data, photo, flip = true, slab = false, serial = "001", testid, max = 14 }) {
  const [flipped, setFlipped] = useState(false);
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const cfg = { stiffness: 180, damping: 18 };
  const rx = useSpring(useTransform(py, [0, 1], [max, -max]), cfg);
  const ry = useSpring(useTransform(px, [0, 1], [-max, max]), cfg);
  const gx = useTransform(px, (v) => `${v * 100}%`);
  const gy = useTransform(py, (v) => `${v * 100}%`);
  const glare = useMotionTemplate`radial-gradient(circle at ${gx} ${gy}, rgba(255,255,255,.42), transparent 48%)`;
  const move = (e) => { if (e.pointerType === "touch") return; const r = e.currentTarget.getBoundingClientRect(); px.set((e.clientX - r.left) / r.width); py.set((e.clientY - r.top) / r.height); };
  const leave = (e) => { if (e.pointerType === "touch") return; px.set(0.5); py.set(0.5); };
  useDeviceTilt(px, py);
  const tap = () => { askTiltPermission(); if (flip) setFlipped((f) => !f); };
  const h = width * 1.4;
  return (
    <div style={{ width, perspective: 1100, fontSize: width / 20 }}>
      <motion.div onPointerMove={move} onPointerLeave={leave} onClick={tap}
        style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }} className={flip ? "cursor-pointer" : ""} data-testid={testid}>
        {slab && (
          <div className="mb-2 rounded-md bg-gradient-to-r from-slate-200 to-white text-slate-900 px-3 py-1.5 flex justify-between items-center font-mono text-[10px] uppercase tracking-widest shadow" style={{ transform: "translateZ(30px)" }}>
            <span className="font-bold">Flexo · Gem Mint</span><span className="font-poster font-black text-lg leading-none">10</span>
          </div>
        )}
        <motion.div animate={{ rotateY: flipped ? 180 : 0 }} transition={{ type: "spring", stiffness: 110, damping: 15 }} style={{ transformStyle: "preserve-3d", height: h }} className="relative">
          <div className="face absolute inset-0 rounded-[14px] overflow-hidden shadow-[0_30px_60px_-25px_rgba(0,0,0,.7)]">
            <ScaledCard width={width} template={template} sport={sport} data={data} photo={photo} />
            <motion.div className="holo absolute inset-0 pointer-events-none" style={{ backgroundPosition: useMotionTemplate`${gx} ${gy}` }} />
            <motion.div className="absolute inset-0 pointer-events-none" style={{ background: glare }} />
          </div>
          {flip && <CardBack sport={sport} data={data} serial={serial} />}
        </motion.div>
      </motion.div>
    </div>
  );
}

export function DemoTilt({ i, width, template, ...rest }) {
  const { sports, templates } = useAppData();
  if (!sports.length || !templates.length) return <div style={{ width, height: width * 1.4 }} className="skeleton rounded-2xl" />;
  const demo = demoFor(i, sports);
  return <TiltCard width={width} template={template || templates.find((t) => t.id === demo.templateId)} sport={demo.sport} data={demo.data} photo={demo.photo} serial={String(i + 1).padStart(3, "0")} {...rest} />;
}
