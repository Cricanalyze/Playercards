import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useApi, errMsg, inr } from "@/lib/api";
import { useAppData } from "@/context/AppData";
import { useMeta, PageHead } from "./AdminApp";

const BLANK = { name: "", type: "one_time", price_inr: 49, interval: "none", default_days: null, trial_days: 0, description: "", features: [], terms: "", active: true, order: 10, eligible_templates: [],
  entitlements: { all_premium_templates: false, premium_template_choices: 0, remove_watermark: true, saved_cards: 10, team_cards: 0 } };

const F = ({ label, children }) => <div className="space-y-1"><Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>{children}</div>;

function PlanForm({ plan, onClose }) {
  const api = useApi();
  const { templates, loadCatalog } = useAppData();
  const [p, setP] = useState({ ...BLANK, ...plan });
  const isFree = plan?.id === "free";
  const set = (k) => (e) => setP({ ...p, [k]: e?.target ? e.target.value : e });
  const setE = (k, v) => setP({ ...p, entitlements: { ...p.entitlements, [k]: v } });
  const save = async () => {
    const body = { ...p, price_inr: Number(p.price_inr), default_days: p.default_days ? Number(p.default_days) : null, trial_days: Number(p.trial_days || 0), order: Number(p.order || 0),
      features: typeof p.features === "string" ? p.features.split("\n").filter(Boolean) : p.features, type: isFree ? "one_time" : p.type };
    delete body.id;
    try { plan?.id ? await api("put", `/admin/plans/${plan.id}`, body) : await api("post", "/admin/plans", body); toast.success("Plan saved. Existing subscribers keep their original terms."); loadCatalog(); onClose(true); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="plan-form-dialog">
        <DialogHeader><DialogTitle className="font-display uppercase text-2xl">{plan?.id ? `Edit ${plan.name}` : "New plan"}</DialogTitle></DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          <F label="Name"><Input value={p.name} onChange={set("name")} data-testid="plan-name-input" /></F>
          <F label="Price (INR)"><Input type="number" value={p.price_inr} onChange={set("price_inr")} disabled={isFree} data-testid="plan-price-input" /></F>
          {!isFree && <F label="Type"><Select value={p.type} onValueChange={set("type")}><SelectTrigger data-testid="plan-type-select"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="one_time">One-time</SelectItem><SelectItem value="subscription">Subscription</SelectItem><SelectItem value="team">Team pack</SelectItem></SelectContent></Select></F>}
          {!isFree && <F label="Billing interval"><Select value={p.interval} onValueChange={set("interval")}><SelectTrigger data-testid="plan-interval-select"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="none">None</SelectItem><SelectItem value="month">Monthly</SelectItem><SelectItem value="year">Yearly</SelectItem></SelectContent></Select></F>}
          <F label="Access days (blank = lifetime)"><Input type="number" value={p.default_days || ""} onChange={set("default_days")} data-testid="plan-days-input" /></F>
          <F label="Trial days"><Input type="number" value={p.trial_days} onChange={set("trial_days")} data-testid="plan-trial-input" /></F>
          <F label="Saved cards limit"><Input type="number" value={p.entitlements.saved_cards} onChange={(e) => setE("saved_cards", Number(e.target.value))} data-testid="plan-saved-limit-input" /></F>
          <F label="Team cards"><Input type="number" value={p.entitlements.team_cards} onChange={(e) => setE("team_cards", Number(e.target.value))} data-testid="plan-team-cards-input" /></F>
          <F label="Premium template choices"><Input type="number" min={0} max={8} value={p.entitlements.premium_template_choices} onChange={(e) => setE("premium_template_choices", Number(e.target.value))} data-testid="plan-choices-input" /></F>
          <F label="Display order"><Input type="number" value={p.order} onChange={set("order")} data-testid="plan-order-input" /></F>
        </div>
        <div className="flex flex-wrap gap-5">
          <label className="flex items-center gap-2 text-sm"><Switch checked={p.entitlements.all_premium_templates} onCheckedChange={(v) => setE("all_premium_templates", v)} data-testid="plan-all-premium-switch" />All premium templates</label>
          <label className="flex items-center gap-2 text-sm"><Switch checked={p.entitlements.remove_watermark} onCheckedChange={(v) => setE("remove_watermark", v)} data-testid="plan-watermark-switch" />Remove watermark</label>
          {!isFree && <label className="flex items-center gap-2 text-sm"><Switch checked={p.active} onCheckedChange={(v) => setP({ ...p, active: v })} data-testid="plan-active-switch" />Active</label>}
        </div>
        <F label="Eligible premium templates">
          <div className="grid grid-cols-2 gap-2">{templates.filter((t) => t.tier === "premium").map((t) => (
            <label key={t.id} className="flex items-center gap-2 text-sm"><Checkbox checked={p.eligible_templates.includes(t.id)} data-testid={`plan-eligible-${t.id}`}
              onCheckedChange={(v) => setP({ ...p, eligible_templates: v ? [...p.eligible_templates, t.id] : p.eligible_templates.filter((x) => x !== t.id) })} />{t.name}</label>))}</div>
        </F>
        <F label="Description"><Input value={p.description} onChange={set("description")} data-testid="plan-description-input" /></F>
        <F label="Features (one per line)"><Textarea rows={4} value={Array.isArray(p.features) ? p.features.join("\n") : p.features} onChange={set("features")} data-testid="plan-features-input" /></F>
        <F label="Terms (cancellation / refunds)"><Textarea rows={2} value={p.terms} onChange={set("terms")} data-testid="plan-terms-input" /></F>
        <Button onClick={save} data-testid="plan-save-button">Save plan</Button>
      </DialogContent>
    </Dialog>
  );
}

export default function Plans() {
  const api = useApi();
  const meta = useMeta();
  const [plans, setPlans] = useState([]);
  const [edit, setEdit] = useState(null);
  const load = () => api("get", "/admin/plans").then(setPlans).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const manage = meta.my_perms.includes("plans.manage");
  return (
    <div data-testid="admin-plans">
      <PageHead title="Plans" sub="Plan definitions are separate from subscriptions. Price changes apply to future purchases only.">
        {manage && <Button onClick={() => setEdit({})} data-testid="plan-new-button">New plan</Button>}
      </PageHead>
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {plans.map((p) => (
          <div key={p.id} className="rounded-xl border border-border p-5 space-y-2" data-testid={`admin-plan-${p.id}`}>
            <div className="flex items-center justify-between"><p className="font-display font-black uppercase text-xl">{p.name}</p><Badge variant={p.active ? "secondary" : "outline"}>{p.active ? "Active" : "Inactive"}</Badge></div>
            <p className="font-display font-black text-3xl">{inr(p.price_inr)}<span className="text-xs text-muted-foreground font-sans font-normal ml-1">{p.type}{p.interval !== "none" ? ` / ${p.interval}` : ""}</span></p>
            <p className="text-xs text-muted-foreground">{p.default_days ? `${p.default_days} days access` : "No expiry"} · saved {p.entitlements.saved_cards} · {p.entitlements.all_premium_templates ? "all premium" : `${p.entitlements.premium_template_choices} premium choice`}</p>
            {manage && <Button size="sm" variant="outline" onClick={() => setEdit(p)} data-testid={`plan-edit-${p.id}`}>Edit</Button>}
          </div>
        ))}
      </div>
      {edit && <PlanForm plan={edit.id ? edit : null} onClose={(saved) => { setEdit(null); if (saved) load(); }} />}
    </div>
  );
}
