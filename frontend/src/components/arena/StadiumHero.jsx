import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

// Hero copy; the 3D stadium world sits behind it (see HomeWorld).
export function StadiumHero({ mine }) {
  return (
    <section id="top" className="relative overflow-hidden text-slate-50" data-testid="stadium-hero">
      <div className="absolute inset-0 bg-gradient-to-r from-[#06080D]/90 via-[#06080D]/45 to-transparent pointer-events-none" />
      <div className="container-x relative flex items-center pt-12 pb-20 lg:pt-16 lg:pb-28 min-h-[78vh] lg:min-h-[88vh]">
        <div className="rise relative z-20 max-w-3xl">
          <span className="sticker">60+ sports · esports too</span>
          <h1 className="font-poster font-black uppercase leading-[0.84] text-[58px] sm:text-7xl lg:text-[110px] mt-6 [text-shadow:0_6px_30px_rgba(0,0,0,.6)]">
            Your game.<br />Your identity.<br /><span className="text-amber-400 [text-shadow:4px_4px_0_#7c2d12]">Your card.</span>
          </h1>
          <p className="mt-6 text-base sm:text-lg text-slate-200 max-w-lg">Turn any photo into a premium collectible player card in under a minute — for cricket, kabaddi, football, chess, BGMI and 55+ more. Download in HD and share to your Status or Story.</p>
          <div className="mt-8 flex flex-wrap gap-3" data-testid="hero-demo-cards">
            <Link to="/create" data-testid="hero-create-card-button" className="press inline-flex items-center gap-2 h-12 px-7 rounded-full bg-amber-400 text-slate-950 font-poster font-black uppercase text-lg tracking-wide hover:bg-amber-300">
              Create your player card <ArrowRight className="w-4 h-4" /></Link>
            <Link to="/explore" data-testid="hero-explore-designs-button" className="inline-flex items-center h-12 px-7 rounded-full border-2 border-white/30 bg-[#06080D]/40 font-poster font-black uppercase text-lg tracking-wide hover:border-white hover:bg-white/10 transition-colors">
              Explore designs</Link>
          </div>
          <p className="mt-6 text-xs text-slate-300">Free account · 2 card downloads a month · Photos stay on your device</p>
          {mine && (
            <button type="button" onClick={() => document.getElementById("templates")?.scrollIntoView({ behavior: "smooth" })} data-testid="hero-your-card-note"
              className="mt-5 inline-flex items-center gap-2 sticker sticker-cyan text-sm">
              Your card “{mine.data?.name || mine.sport?.name}” is standing on the pitch ↓
            </button>
          )}
        </div>
      </div>
      <p className="absolute bottom-6 left-1/2 -translate-x-1/2 font-marker text-amber-300 text-sm animate-bounce pointer-events-none" data-testid="hero-scroll-hint">scroll to enter the stadium ↓</p>
    </section>
  );
}
