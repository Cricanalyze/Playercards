import { useAppData } from "@/context/AppData";

export const STADIUM_IMG = "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?crop=entropy&cs=srgb&fm=jpg&w=1800&q=70";

export const Lights = ({ pitch = true }) => (
  <>
    <div className="floodlight left-[-18%]" />
    <div className="floodlight right-[-18%]" style={{ animationDelay: "-4.5s" }} />
    {pitch && <div className="pitch" />}
  </>
);

export const SectionHead = ({ n, eyebrow, title, sub, note }) => (
  <div className="flex items-start gap-4 sm:gap-6">
    <span className="font-poster font-black text-6xl sm:text-8xl leading-[0.8] text-transparent [-webkit-text-stroke:2px_#F59E0B] select-none" aria-hidden>{n}</span>
    <div className="min-w-0">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="font-poster font-black uppercase text-4xl sm:text-5xl lg:text-6xl leading-[0.9] mt-2">{title}</h2>
      {sub && <p className="text-muted-foreground mt-3 max-w-2xl text-sm sm:text-base">{sub}</p>}
      {note && <p className="font-marker text-amber-600 dark:text-amber-400 mt-3 -rotate-1">{note}</p>}
    </div>
  </div>
);

export const PageHero = ({ eyebrow, title, sub, note, children }) => (
  <section className="night overflow-hidden" data-testid="page-hero">
    <img src={STADIUM_IMG} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 -z-10" />
    <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#06080D]/30 to-[#06080D]" />
    <Lights />
    <div className="container-x relative py-16 sm:py-24 rise">
      <span className="sticker">{eyebrow}</span>
      <h1 className="font-poster font-black uppercase text-5xl sm:text-6xl lg:text-7xl leading-[0.88] mt-5 max-w-4xl">{title}</h1>
      {sub && <p className="text-slate-300 mt-4 max-w-xl">{sub}</p>}
      {note && <p className="font-marker text-amber-400 mt-4 -rotate-1">{note}</p>}
      {children}
    </div>
  </section>
);

export const SportsTicker = () => {
  const { sports } = useAppData();
  if (!sports.length) return null;
  const row = [...sports, ...sports];
  return (
    <div className="relative -rotate-[1.5deg] scale-[1.03] bg-amber-400 text-slate-950 border-y-2 border-slate-950 overflow-hidden py-3 z-10" data-testid="sports-ticker">
      <div className="marquee">
        {row.map((s, i) => (
          <span key={`${s.id}-${i}`} className="font-poster font-black uppercase text-2xl tracking-wide px-5 flex items-center gap-5 whitespace-nowrap">{s.name}<span className="text-base">★</span></span>
        ))}
      </div>
    </div>
  );
};
