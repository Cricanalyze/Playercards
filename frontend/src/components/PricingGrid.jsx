import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inr, API } from "@/lib/api";
import { useAppData } from "@/context/AppData";
import { useCheckout } from "@/lib/checkout";

function useBilling() {
  const [cfg, setCfg] = useState(null);
  useEffect(() => { fetch(`${API}/billing/config`).then((r) => r.json()).then(setCfg).catch(() => setCfg({ enabled: false })); }, []);
  return cfg;
}

const Cta = ({ p, cycle, cfg, current }) => {
  const { isSignedIn } = useAppData();
  const { pay, busy } = useCheckout();
  const cls = "mt-4 rounded-full font-bold hover:bg-amber-400 hover:text-slate-950";
  if (p.type === "free") return <Button asChild className={cls} data-testid={`plan-cta-${p.id}`}><Link to="/create">Start creating</Link></Button>;
  if (!isSignedIn) return <Button asChild className={cls} data-testid={`plan-cta-${p.id}`}><Link to="/sign-in">Sign in to choose {p.name}</Link></Button>;
  if (!cfg?.enabled) return <Button disabled variant="outline" className="mt-4 rounded-full" data-testid={`plan-cta-${p.id}`}>Payments pending setup</Button>;
  const label = current === p.id ? `Renew ${p.name}` : current && current !== "free" ? `Switch to ${p.name}` : `Get ${p.name}`;
  return (
    <Button onClick={() => pay(p, cycle)} disabled={!!busy} className={cls} data-testid={`plan-cta-${p.id}`}>
      {busy === `${p.id}-${cycle}` && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}{label} · {inr(cycle === "year" ? p.price_year : p.price_month)}
    </Button>
  );
};

export function PricingGrid({ plans }) {
  const [cycle, setCycle] = useState("month");
  const cfg = useBilling();
  const { me } = useAppData();
  const current = me?.entitlements?.plan_id;
  return (
    <div>
      <div className="inline-flex rounded-full border border-border p-1 text-xs font-bold uppercase mb-6" role="tablist" data-testid="billing-cycle-toggle">
        {[["month", "Monthly"], ["year", "Yearly · 2 months free"]].map(([c, l]) => (
          <button key={c} data-testid={`billing-cycle-${c}`} onClick={() => setCycle(c)} className={`px-4 h-8 rounded-full transition-colors ${cycle === c ? "bg-amber-500 text-slate-950" : "text-muted-foreground hover:text-foreground"}`}>{l}</button>
        ))}
      </div>
      {cfg && !cfg.enabled && <p className="text-xs text-muted-foreground mb-4" data-testid="payments-pending-note">Online payments are pending setup. No charge can be made right now.</p>}
      {cfg?.mode === "test" && <p className="text-xs text-amber-500 mb-4" data-testid="payments-test-mode-note">Payments are in Razorpay test mode — use test cards; no real money moves.</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((p) => {
          const hot = p.id === "pro";
          const price = cycle === "year" ? p.price_year : p.price_month;
          return (
            <div key={p.id} data-testid={`plan-card-${p.id}`} className={`relative rounded-2xl border p-6 flex flex-col ${hot ? "border-amber-500 bg-amber-500/5 shadow-[0_0_40px_rgba(212,175,55,.12)]" : "border-border bg-card"}`}>
              {hot && <span className="absolute -top-3 left-6 text-[10px] font-bold uppercase tracking-widest bg-amber-500 text-slate-950 px-2 py-1 rounded">Most popular</span>}
              {current === p.id && <span className="absolute -top-3 right-6 text-[10px] font-bold uppercase tracking-widest bg-cyan-500 text-slate-950 px-2 py-1 rounded" data-testid={`plan-current-${p.id}`}>Your plan</span>}
              <p className="font-display font-black uppercase text-2xl">{p.name}</p>
              <p className="text-sm text-muted-foreground mt-1 min-h-[40px]">{p.description}</p>
              <div className="mt-5 flex items-baseline gap-2">
                <span className="font-display font-black text-5xl" data-testid={`plan-price-${p.id}`}>{inr(price)}</span>
                <span className="text-xs uppercase text-muted-foreground">{p.type === "free" ? "forever" : cycle === "year" ? "/ year" : "/ month"}</span>
              </div>
              <p className="text-xs uppercase tracking-wider text-amber-500 mt-1" data-testid={`plan-cards-${p.id}`}>{p.cards_per_month} cards / month</p>
              <ul className="mt-5 space-y-2 flex-1">
                {p.features.map((f) => <li key={f} className="flex gap-2 text-sm"><Check className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />{f}</li>)}
              </ul>
              <p className="text-[11px] text-muted-foreground mt-5 border-t border-border pt-3">{p.terms}</p>
              <Cta p={p} cycle={cycle} cfg={cfg} current={current} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
