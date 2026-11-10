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
  const go = () => {
    if (current && current !== "free" && current !== p.id && !window.confirm(`Switching to ${p.name} ends your current plan immediately (no refund for unused time). Continue?`)) return;
    pay(p, cycle);
  };
  return (
    <Button onClick={go} disabled={!!busy} className={cls} data-testid={`plan-cta-${p.id}`}>
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
      <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((p) => {
          const hot = p.id === "pro";
          const price = cycle === "year" ? p.price_year : p.price_month;
          return (
            <div key={p.id} data-testid={`plan-card-${p.id}`} style={{ transform: `rotate(${[-0.8, 0.6, -0.4, 0.9][plans.indexOf(p) % 4]}deg)` }}
              className={`ticket lift relative rounded-2xl p-6 pt-12 flex flex-col ${hot ? "night border-2 border-amber-400" : "paper border border-border"}`}>
              {hot && <div className="holo absolute inset-x-0 top-0 h-2 opacity-100 [mix-blend-mode:normal]" />}
              <div className="absolute top-4 left-6 right-6 flex justify-between gap-2">
                {hot ? <span className="text-[10px] font-bold uppercase tracking-widest bg-amber-400 text-slate-950 px-2 py-1 rounded -rotate-2">Most popular</span> : <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Season pass</span>}
                {current === p.id && <span className="text-[10px] font-bold uppercase tracking-widest bg-cyan-400 text-slate-950 px-2 py-1 rounded rotate-2" data-testid={`plan-current-${p.id}`}>Your plan</span>}
              </div>
              <p className="font-poster font-black uppercase text-3xl leading-none">{p.name}</p>
              <p className="text-sm text-muted-foreground mt-1 min-h-[40px]">{p.description}</p>
              <div className="mt-5 flex items-baseline gap-2">
                <span className="font-poster font-black text-6xl leading-none" data-testid={`plan-price-${p.id}`}>{inr(price)}</span>
                <span className="text-xs uppercase text-muted-foreground">{p.type === "free" ? "forever" : cycle === "year" ? "/ year" : "/ month"}</span>
              </div>
              <p className="text-xs uppercase tracking-wider text-amber-500 mt-1" data-testid={`plan-cards-${p.id}`}>{p.cards_per_month} cards / month</p>
              <ul className="mt-5 space-y-2 flex-1">
                {p.features.map((f) => <li key={f} className="flex gap-2 text-sm"><Check className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />{f}</li>)}
              </ul>
              <p className="text-[11px] text-muted-foreground mt-5 border-t-2 border-dashed border-border pt-3">{p.terms}</p>
              <Cta p={p} cycle={cycle} cfg={cfg} current={current} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
