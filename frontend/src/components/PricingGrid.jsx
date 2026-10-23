import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inr } from "@/lib/api";

const billing = (p) =>
  p.type === "free" ? "Free forever" : p.type === "subscription" ? `per ${p.interval} · recurring` : p.default_days ? `one-time · ${p.default_days} days` : "one-time · lifetime";

export function PricingGrid({ plans }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {plans.map((p) => {
        const hot = p.id === "pro_creator";
        return (
          <div key={p.id} data-testid={`plan-card-${p.id}`} className={`relative rounded-2xl border p-6 flex flex-col ${hot ? "border-amber-500 bg-amber-500/5 shadow-[0_0_40px_rgba(212,175,55,.12)]" : "border-border bg-card"}`}>
            {hot && <span className="absolute -top-3 left-6 text-[10px] font-bold uppercase tracking-widest bg-amber-500 text-slate-950 px-2 py-1 rounded">Most flexible</span>}
            <p className="font-display font-black uppercase text-2xl">{p.name}</p>
            <p className="text-sm text-muted-foreground mt-1 min-h-[40px]">{p.description}</p>
            <div className="mt-5 flex items-baseline gap-2">
              <span className="font-display font-black text-5xl" data-testid={`plan-price-${p.id}`}>{p.price_inr ? inr(p.price_inr) : "₹0"}</span>
            </div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{billing(p)}</p>
            <ul className="mt-5 space-y-2 flex-1">
              {p.features.map((f) => <li key={f} className="flex gap-2 text-sm"><Check className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />{f}</li>)}
            </ul>
            <p className="text-[11px] text-muted-foreground mt-5 border-t border-border pt-3">{p.terms}</p>
            {p.type === "free" ? (
              <Button asChild className="mt-4 rounded-full font-bold hover:bg-amber-400 hover:text-slate-950" data-testid={`plan-cta-${p.id}`}><Link to="/create">Start creating</Link></Button>
            ) : (
              <Button disabled variant="outline" className="mt-4 rounded-full" data-testid={`plan-cta-${p.id}`}>Online payments coming soon</Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
