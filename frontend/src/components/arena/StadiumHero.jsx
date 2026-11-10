import { useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { DemoTilt } from "./TiltCard";
import { Lights, STADIUM_IMG } from "./Bits";

const small = () => typeof window !== "undefined" && window.innerWidth < 640;

export function StadiumHero() {
  const ref = useRef(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const yL = useTransform(p, [0, 1], [0, -180]);
  const yR = useTransform(p, [0, 1], [0, -280]);
  const rot = useTransform(p, [0, 1], [0, -18]);
  const scale = useTransform(p, [0, 1], [1, 1.18]);
  const bg = useTransform(p, [0, 1], ["0%", "18%"]);
  const sm = small();
  return (
    <section ref={ref} className="night overflow-hidden" data-testid="stadium-hero">
      <motion.img src={STADIUM_IMG} alt="" style={{ y: bg }} className="absolute inset-0 w-full h-[115%] object-cover opacity-25 -z-10" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#06080D]/50 via-[#06080D]/70 to-[#06080D]" />
      <Lights />
      <div className="container-x relative grid lg:grid-cols-[1.05fr_1fr] gap-6 lg:gap-10 items-center pt-12 pb-20 lg:pt-16 lg:pb-28 lg:min-h-[86vh]">
        <div className="rise relative z-20">
          <span className="sticker">60+ sports · esports too</span>
          <h1 className="font-poster font-black uppercase leading-[0.84] text-[58px] sm:text-7xl lg:text-[104px] mt-6">
            Your game.<br />Your identity.<br /><span className="text-amber-400 [text-shadow:4px_4px_0_#7c2d12]">Your card.</span>
          </h1>
          <p className="mt-6 text-base sm:text-lg text-slate-300 max-w-lg">Turn any photo into a premium collectible player card in under a minute — for cricket, kabaddi, football, chess, BGMI and 55+ more. Download in HD and share to your Status or Story.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/create" data-testid="hero-create-card-button" className="press inline-flex items-center gap-2 h-12 px-7 rounded-full bg-amber-400 text-slate-950 font-poster font-black uppercase text-lg tracking-wide hover:bg-amber-300">
              Create your player card <ArrowRight className="w-4 h-4" /></Link>
            <Link to="/explore" data-testid="hero-explore-designs-button" className="inline-flex items-center h-12 px-7 rounded-full border-2 border-white/30 font-poster font-black uppercase text-lg tracking-wide hover:border-white hover:bg-white/5 transition-colors">
              Explore designs</Link>
          </div>
          <p className="mt-6 text-xs text-slate-400">Free account · 2 card downloads a month · Photos stay on your device</p>
        </div>
        <div className="relative h-[430px] sm:h-[560px]" data-testid="hero-demo-cards">
          <motion.div style={{ y: yL, rotate: -11 }} className="absolute -left-10 sm:left-0 top-24 sm:top-20 opacity-90"><DemoTilt i={1} width={sm ? 150 : 220} testid="hero-card-left" /></motion.div>
          <motion.div style={{ y: yR, rotate: 10 }} className="absolute -right-10 sm:right-0 top-28 sm:top-28 opacity-90"><DemoTilt i={2} width={sm ? 150 : 220} testid="hero-card-right" /></motion.div>
          <div className="absolute inset-x-0 top-0 flex justify-center z-10">
            <motion.div style={{ scale, rotate: rot }}><DemoTilt i={0} width={sm ? 220 : 270} slab testid="hero-card-main" /></motion.div>
          </div>
          <p className="absolute z-20 bottom-2 sm:bottom-4 right-2 sm:right-10 font-marker text-amber-300 text-sm sm:text-base rotate-[-6deg]" data-testid="hero-flip-hint">↖ tap a card to flip it</p>
          <span className="absolute bottom-0 left-0 text-[10px] uppercase tracking-widest text-slate-500">Fictional demo players</span>
        </div>
      </div>
    </section>
  );
}
