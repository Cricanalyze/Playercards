import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Trophy, Upload, Palette, Download } from "lucide-react";
import { Lights } from "./Bits";

const STEPS = [
  [Trophy, "Pick your sport", "60+ sports & games, each with its own stats."],
  [Upload, "Upload a photo", "Crop, zoom and position it. It never leaves your phone."],
  [Palette, "Style it", "Original templates, accent colours, ratings and achievements."],
  [Download, "Download & share", "HD card and 9:16 story PNG, ready for Status or Stories."],
];
const GAP = 1100;
const N = STEPS.length;

function Panel({ p, i, sm }) {
  const c = i / (N - 1);
  const d = 1 / (N - 1);
  const opacity = useTransform(p, [c - d, c - d * 0.4, c, c + d * 0.2, c + d * 0.38], [0, 0.45, 1, 0.5, 0]);
  const [Icon, t, desc] = STEPS[i];
  return (
    <motion.div style={{ opacity, z: -i * GAP, x: sm ? 0 : (i % 2 ? 200 : -200) }} className="absolute inset-0 grid place-items-center pointer-events-none">
      <div className="w-[min(520px,84vw)] rounded-2xl border-2 border-amber-400/70 bg-[#0D121B]/95 p-7 sm:p-9 relative shadow-[0_40px_80px_-30px_rgba(245,158,11,.35)]" data-testid={`how-step-${i + 1}`}>
        <span className="absolute -top-4 right-6 sticker text-sm">No. 0{i + 1} / 0{N}</span>
        <div className="flex items-start gap-5">
          <span className="font-poster font-black text-[96px] leading-[0.75] text-amber-400">{i + 1}</span>
          <div>
            <Icon className="w-6 h-6 text-cyan-300" />
            <p className="font-poster font-black uppercase text-3xl sm:text-4xl mt-2 leading-none">{t}</p>
            <p className="text-slate-300 mt-2">{desc}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function StadiumSteps() {
  const ref = useRef(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const z = useTransform(p, [0, 1], [0, (N - 1) * GAP]);
  const floor = useTransform(p, [0, 1], ["0px", "1400px"]);
  const bar = useTransform(p, [0, 1], ["0%", "100%"]);
  const sm = typeof window !== "undefined" && window.innerWidth < 640;
  return (
    <section ref={ref} id="how" className="night mt-24" style={{ height: `${N * 85 + 30}vh` }} data-testid="how-stage">
      <div className="sticky top-0 h-screen overflow-hidden">
        <Lights pitch={false} />
        <motion.div className="absolute left-[-60%] right-[-60%] bottom-[-25%] h-[70%] -z-10 [transform:perspective(560px)_rotateX(72deg)] [transform-origin:50%_100%] [mask-image:linear-gradient(to_top,#000_20%,transparent_90%)]"
          style={{ backgroundPositionY: floor, backgroundImage: "linear-gradient(rgba(245,158,11,.35) 2px, transparent 2px), linear-gradient(90deg, rgba(92,242,255,.18) 2px, transparent 2px)", backgroundSize: "120px 120px" }} />
        <div className="container-x pt-20 sm:pt-24 relative z-10">
          <p className="eyebrow">How it works · scroll to walk out</p>
          <h2 className="font-poster font-black uppercase text-4xl sm:text-6xl leading-[0.9] mt-2">Card ready in<br />under a minute</h2>
          <div className="mt-5 h-1 w-48 bg-white/10 rounded-full overflow-hidden"><motion.div style={{ width: bar }} className="h-full bg-amber-400" /></div>
        </div>
        <div className="absolute inset-0 top-24" style={{ perspective: 900 }}>
          <motion.div style={{ z, transformStyle: "preserve-3d" }} className="absolute inset-0">
            {STEPS.map((_, i) => <Panel key={i} p={p} i={i} sm={sm} />)}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
