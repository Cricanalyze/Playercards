import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useApi, errMsg, inr } from "@/lib/api";
import { useAppData } from "@/context/AppData";
import { useMeta, PageHead } from "./AdminApp";

const TOOLS = [["remove_watermark", "Remove watermark"], ["bg_removal", "Background removal"], ["bg_library", "Background library"],
  ["custom_backgrounds", "Custom background uploads"], ["premium_backgrounds", "Premium backgrounds"], ["advanced_effects", "Advanced effects"],
  ["team_presets", "Team background presets"], ["shared_branding", "Shared team branding"]];

const F = ({ label, children }) => <div className="space-y-1"><Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>{children}</div>;

function PlanForm({ plan, onClose }) {
  const api = useApi();
  const { loadCatalog } = useAppData();
  const [p, setP] = useState(plan);
  const isFree = plan.id === "free";
  const set = (k) => (e) => setP({ ...p, [k]: e.target.value });
  const setE = (k, v) => setP({ ...p, entitlements: { ...p.entitlements, [k]: v } });
  const save = async () => {
    const body = { name: p.name, description: p.description, terms: p.terms, active: p.active, order: Number(p.order || 0), entitlements: p.entitlements,
      price_month: Number(p.price_month), price_year: Number(p.price_year), cards_per_month: Number(p.cards_per_month),
      features: typeof p.features === "string" ? p.features.split("\n").filter(Boolean) : p.features };
    try { await api("put", `/admin/plans/${plan.id}`, body); toast.success("Plan updated everywhere on the site"); loadCatalog(); onClose(true); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="plan-form-dialog">
        <DialogHeader><DialogTitle className="font-display uppercase text-2xl">Edit {plan.name}</DialogTitle></DialogHeader>
        <div className="grid sm:grid-cols-3 gap-3">
          <F label="Name"><Input value={p.name} onChange={set("name")} data-testid="plan-name-input" /></F>
          <F label="Monthly price (₹)"><Input type="number" min={0} value={p.price_month} onChange={set("price_month")} disabled={isFree} data-testid="plan-price-month-input" /></F>
          <F label="Yearly price (₹)"><Input type="number" min={0} value={p.price_year} onChange={set("price_year")} disabled={isFree} data-testid="plan-price-year-input" /></F>
          <F label="Cards per month"><Input type="number" min={0} value={p.cards_per_month} onChange={set("cards_per_month")} data-testid="plan-cards-input" /></F>
          <F label="Bg removals / month"><Input type="number" min={0} value={p.entitlements.bg_removal_limit} onChange={(e) => setE("bg_removal_limit", Number(e.target.value))} data-testid="plan-bg-limit-input" /></F>
          <F label="Saved cards limit"><Input type="number" min={0} value={p.entitlements.saved_cards} onChange={(e) => setE("saved_cards", Number(e.target.value))} data-testid="plan-saved-limit-input" /></F>
          <F label="Display order"><Input type="number" value={p.order} onChange={set("order")} data-testid="plan-order-input" /></F>
        </div>
        <F label="Background tools & features">
          <div className="grid sm:grid-cols-2 gap-2">
            {TOOLS.map(([k, l]) => <label key={k} className="flex items-center gap-2 text-sm"><Switch checked={!!p.entitlements[k]} onCheckedChange={(v) => setE(k, v)} data-testid={`plan-tool-${k}`} />{l}</label>)}
            <p className="text-xs text-muted-foreground sm:col-span-2">Photo editing and standard backgrounds are always on for every plan.</p>
          </div>
        </F>
        {!isFree && <label className="flex items-center gap-2 text-sm"><Switch checked={p.active} onCheckedChange={(v) => setP({ ...p, active: v })} data-testid="plan-active-switch" />Plan enabled (shown on pricing & purchasable)</label>}
        <F label="Description"><Input value={p.description} onChange={set("description")} data-testid="plan-description-input" /></F>
        <F label="Features (one per line)"><Textarea rows={4} value={Array.isArray(p.features) ? p.features.join("\n") : p.features} onChange={set("features")} data-testid="plan-features-input" /></F>
        <F label="Terms"><Textarea rows={2} value={p.terms} onChange={set("terms")} data-testid="plan-terms-input" /></F>
        <Button onClick={save} data-testid="plan-save-button">Save plan</Button>
      </DialogContent>
    </Dialog>
  );
}

function AccessForm({ plan, onClose }) {
  const api = useApi();
  const [list, setList] = useState([]);
  const [sel, setSel] = useState([]);
  useEffect(() => { api("get", "/admin/templates").then((l) => { setList(l); setSel(l.filter((t) => t.plans?.includes(plan.id)).map((t) => t.id)); }).catch(() => {}); }, [api, plan.id]);
  const save = async () => { try { await api("put", `/admin/plans/${plan.id}/templates`, { template_ids: sel }); toast.success("Template access updated"); onClose(true); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="plan-access-dialog">
        <DialogHeader><DialogTitle className="font-display uppercase text-2xl">{plan.name} · template access</DialogTitle></DialogHeader>
        <div className="grid sm:grid-cols-2 gap-2">
          {list.map((t) => (
            <label key={t.id} className="flex items-center gap-2 text-sm"><Checkbox checked={sel.includes(t.id)} data-testid={`plan-access-${t.id}`}
              onCheckedChange={(v) => setSel(v ? [...sel, t.id] : sel.filter((x) => x !== t.id))} />{t.name}<Badge variant="outline" className="text-[9px] uppercase ml-auto">{t.collection}</Badge></label>
          ))}
        </div>
        <Button onClick={save} data-testid="plan-access-save-button">Save access</Button>
      </DialogContent>
    </Dialog>
  );
}

export default function Plans() {
  const api = useApi();
  const meta = useMeta();
  const [plans, setPlans] = useState([]);
  const [edit, setEdit] = useState(null);
  const [access, setAccess] = useState(null);
  const load = () => api("get", "/admin/plans").then(setPlans).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const manage = meta.my_perms.includes("plans.manage");
  const done = (saved) => { setEdit(null); setAccess(null); if (saved) load(); };
  return (
    <div data-testid="admin-plans">
      <PageHead title="Plans" sub="Edit the four plans in place. Changes apply immediately to entitlements and future purchases." />
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {plans.map((p) => (
          <div key={p.id} className="rounded-xl border border-border p-5 space-y-2" data-testid={`admin-plan-${p.id}`}>
            <div className="flex items-center justify-between"><p className="font-display font-black uppercase text-xl">{p.name}</p><Badge variant={p.active ? "secondary" : "outline"}>{p.active ? "Enabled" : "Disabled"}</Badge></div>
            <p className="font-display font-black text-3xl">{inr(p.price_month)}<span className="text-xs text-muted-foreground font-sans font-normal ml-1">/mo · {inr(p.price_year)}/yr</span></p>
            <p className="text-xs text-muted-foreground">{p.cards_per_month} cards/month · {p.entitlements.bg_removal ? `${p.entitlements.bg_removal_limit} bg removals` : "no bg removal"} · {p.template_count} templates · {p.subscribers} active</p>
            {manage && <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setEdit(p)} data-testid={`plan-edit-${p.id}`}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => setAccess(p)} data-testid={`plan-access-${p.id}-button`}>Template access</Button></div>}
          </div>
        ))}
      </div>
      {edit && <PlanForm plan={edit} onClose={done} />}
      {access && <AccessForm plan={access} onClose={done} />}
    </div>
  );
}
