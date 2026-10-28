import { useState } from "react";
import { Link } from "react-router-dom";
import { useAppData } from "@/context/AppData";
import { ScaledCard } from "@/components/card/PlayerCard";
import { demoFor } from "@/lib/cardUtils";
import { Button } from "@/components/ui/button";

export default function Explore() {
  const { templates, sports } = useAppData();
  const [tier, setTier] = useState("all");
  const list = templates.filter((t) => tier === "all" || (t.collection || t.tier) === tier);
  return (
    <div className="container-x py-12" data-testid="explore-page">
      <p className="eyebrow">Template gallery</p>
      <h1 className="font-display font-black uppercase text-4xl sm:text-5xl lg:text-6xl">Explore designs</h1>
      <p className="text-muted-foreground mt-3 max-w-xl">Every design is original artwork. Previews use fictional demo players.</p>
      <div className="flex gap-2 mt-8">
        {["all", "free", "basic", "pro", "premium", "exclusive"].map((t) => (
          <button key={t} data-testid={`explore-filter-${t}`} onClick={() => setTier(t)} className={`text-xs font-bold uppercase tracking-wider px-4 h-9 rounded-full border transition-colors ${tier === t ? "bg-amber-500 text-slate-950 border-amber-500" : "border-border hover:border-foreground/40"}`}>{t}</button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mt-10">
        {list.map((t, i) => {
          const demo = sports.length ? demoFor(i, sports) : null;
          return (
            <div key={t.id} className="group" data-testid={`explore-template-${t.id}`}>
              <div className="card-tilt flex justify-center">{demo && <ScaledCard width={260} template={t} sport={demo.sport} data={demo.data} photo={demo.photo} />}</div>
              <div className="mt-4 flex items-center justify-between">
                <p className="font-display font-black uppercase text-xl">{t.name}</p>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${t.collection !== "free" ? "bg-amber-500 text-slate-950" : "bg-muted text-muted-foreground"}`}>{t.collection || t.tier}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{t.description}</p>
              <p className="text-[11px] uppercase tracking-wide text-cyan-500 mt-1" data-testid={`explore-plans-${t.id}`}>Included in: {(t.plans || []).map((p) => p[0].toUpperCase() + p.slice(1)).join(", ")}</p>
              <Button asChild size="sm" className="mt-3 rounded-full font-bold hover:bg-amber-400 hover:text-slate-950" data-testid={`explore-use-${t.id}`}><Link to={`/create?template=${t.id}`}>Use this design</Link></Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
