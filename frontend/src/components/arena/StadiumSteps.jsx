import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Trophy, Upload, Palette, Download } from "lucide-react";

const STEPS = [
  [Trophy, "Pick your sport", "60+ sports & games, each with its own stats."],
  [Upload, "Upload a photo", "Crop, zoom and position it. It never leaves your phone."],
  [Palette, "Style it", "Original templates, accent colours, ratings and achievements."],
  [Download, "Download & share", "HD card and 9:16 story PNG, ready for Status or Stories."],
];
const N = STEPS.length;

function Panel({ p, i }) {
  const c = (i + 0.5) / N;
  const d = 1 / N;
  const opacity = useTransform(p, [c - d * 0.75, c - d * 0.3, c + d * 0.3, c + d * 0.75], [0, 1, 1, i === N - 1 ? 1 : 0]);
  const y = useTransform(p, [c - d * 0.75, c - d * 0.3], [40, 0]);
  const [Icon, t, desc] = STEPS[i];
  return (
    <motion.div style={{ opacity, y }} className="absolute inset-x-0 bottom-8 sm:bottom-14 pointer-events-none">
      <div className="container-x">
        <div className="w-[min(500px,100%)] rounded-2xl border-2 border-amber-400/70 bg-[#0D121B]/85 p-6 sm:p-8 relative" data-testid={`how-step-${i + 1}`}>
          <span className="absolute -top-4 right-6 sticker text-sm">No. 0{i + 1} / 0{N}</span>
          <div className="flex items-start gap-5">
            <span className="font-poster font-black text-[84px] leading-[0.75] text-amber-400">{i + 1}</span>
            <div>
              <Icon className="w-6 h-6 text-cyan-300" />
              <p className="font-poster font-black uppercase text-3xl sm:text-4xl mt-2 leading-none">{t}</p>
              <p className="text-slate-300 mt-2">{desc}</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Scroll stage; the 3D stadium behind the page flies the camera while this section is pinned.
export function StadiumSteps() {
  const ref = useRef(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const bar = useTransform(p, [0, 1], ["0%", "100%"]);
  return (
    <section ref={ref} id="how" className="relative text-slate-50" style={{ height: `${N * 90 + 40}vh` }} data-testid="how-stage">
      <div className="sticky top-0 h-screen overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-[#06080D]/90 to-transparent pointer-events-none" />
        <div className="container-x pt-20 sm:pt-24 relative z-10 pointer-events-none">
          <p className="eyebrow">How it works · scroll to walk out</p>
          <h2 className="font-poster font-black uppercase text-4xl sm:text-6xl leading-[0.9] mt-2">Card ready in<br />under a minute</h2>
          <div className="mt-5 h-1 w-48 bg-white/10 rounded-full overflow-hidden"><motion.div style={{ width: bar }} className="h-full bg-amber-400" /></div>
        </div>
        {STEPS.map((_, i) => <Panel key={i} p={p} i={i} />)}
      </div>
    </section>
  );
}
