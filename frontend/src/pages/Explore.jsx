import { useState } from "react";
import { Link } from "react-router-dom";
import { useAppData } from "@/context/AppData";
import { demoFor } from "@/lib/cardUtils";
import { TiltCard } from "@/components/arena/TiltCard";
import { PageHero } from "@/components/arena/Bits";

const TIERS = ["all", "free", "basic", "pro", "premium", "exclusive"];

export default function Explore() {
  const { templates, sports } = useAppData();
  const [tier, setTier] = useState("all");
  const list = templates.filter((t) => tier === "all" || (t.collection || t.tier) === tier);
  return (
    <div data-testid="explore-page">
      <PageHero eyebrow="Template gallery" title="Explore designs" sub="Every design is original artwork. Previews use fictional demo players." note="tap any card to flip it and see the stats side">
        <div className="flex flex-wrap gap-2 mt-8">
          {TIERS.map((t, i) => (
            <button key={t} data-testid={`explore-filter-${t}`} onClick={() => setTier(t)} style={{ transform: `rotate(${i % 2 ? 1.5 : -1.5}deg)` }}
              className={`text-sm font-poster font-black uppercase tracking-wider px-4 h-9 rounded-md border-2 transition-colors ${tier === t ? "bg-amber-400 text-slate-950 border-slate-950 press" : "border-white/25 text-slate-200 hover:border-white"}`}>{t}</button>
          ))}
        </div>
      </PageHero>
      <div className="container-x py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-14">
          {list.map((t, i) => {
            const demo = sports.length ? demoFor(i, sports) : null;
            return (
              <div key={t.id} className="group" data-testid={`explore-template-${t.id}`}>
                <div className="sleeve flex justify-center">
                  {demo && <TiltCard width={240} template={t} sport={demo.sport} data={demo.data} photo={demo.photo} serial={String(i + 1).padStart(3, "0")} testid={`explore-card-${t.id}`} />}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <p className="font-poster font-black uppercase text-2xl leading-none">{t.name}</p>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded -rotate-2 ${t.collection !== "free" ? "bg-amber-400 text-slate-950" : "bg-muted text-muted-foreground"}`}>{t.collection || t.tier}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{t.description}</p>
                <p className="text-[11px] uppercase tracking-wide text-cyan-600 dark:text-cyan-400 mt-1" data-testid={`explore-plans-${t.id}`}>Included in: {(t.plans || []).map((p) => p[0].toUpperCase() + p.slice(1)).join(", ")}</p>
                <Link to={`/create?template=${t.id}`} data-testid={`explore-use-${t.id}`} className="press mt-3 inline-flex items-center h-9 px-5 rounded-full bg-amber-400 text-slate-950 font-poster font-black uppercase tracking-wide hover:bg-amber-300">Use this design</Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
