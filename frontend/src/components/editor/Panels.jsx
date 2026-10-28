import { useEffect, useState } from "react";
import { Lock, Check } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { SportsGrid } from "@/components/SportsGrid";
import { ScaledCard } from "@/components/card/PlayerCard";
import { ACCENTS } from "@/lib/cardUtils";
import { useApi, errMsg } from "@/lib/api";
export { PhotoPanel } from "./PhotoPanel";

export const canUse = (t, ent) => !t.plans?.length || t.plans.includes(ent?.plan_id || "free");
export const PLAN_NAMES = { free: "Free", basic: "Basic", pro: "Pro", team: "Team" };
export const needPlan = (t) => ["free", "basic", "pro", "team"].find((p) => !t.plans?.length || t.plans.includes(p));
export const CollectionBadge = ({ t }) => (
  <span className={`text-[9px] font-bold uppercase px-1.5 rounded ${t.collection === "free" ? "bg-muted text-muted-foreground" : "bg-amber-500 text-slate-950"}`}>{t.collection || t.tier}</span>
);

export const SportPanel = ({ sports, sport, onPick }) => <SportsGrid sports={sports} selectedId={sport?.id} onSelect={onPick} compact />;

export const TemplatePanel = ({ templates, state, sport, ent, onPick }) => {
  const list = templates.filter((t) => !t.sports?.length || t.sports.includes(sport?.id));
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {list.map((t) => {
        const locked = !canUse(t, ent);
        const on = state.templateId === t.id;
        return (
          <button key={t.id} data-testid={`template-select-${t.id}`} onClick={() => onPick(t.id)} className={`text-left rounded-xl p-2 border transition-colors ${on ? "border-amber-500 bg-amber-500/10" : "border-border hover:border-amber-500/50"}`}>
            <div className="relative">
              <ScaledCard width={140} template={t} sport={sport} data={state.data} photo={state.photo} />
              {locked && <span className="absolute top-2 right-2 bg-black/70 text-amber-400 rounded-full p-1.5"><Lock className="w-3 h-3" /></span>}
              {on && <span className="absolute top-2 left-2 bg-amber-500 text-slate-950 rounded-full p-1"><Check className="w-3 h-3" /></span>}
            </div>
            <div className="mt-2 flex items-center justify-between gap-1">
              <span className="font-display font-bold uppercase text-sm truncate">{t.name}</span>
              <CollectionBadge t={t} />
            </div>
            {locked && <span className="text-[10px] text-amber-500 uppercase tracking-wide block" data-testid={`template-needs-${t.id}`}>Needs {PLAN_NAMES[needPlan(t)] || "upgrade"}</span>}
            {t.recommended?.includes(sport?.category) && <span className="text-[10px] text-cyan-500 uppercase tracking-wide">Great for {sport.name}</span>}
          </button>
        );
      })}
    </div>
  );
};

const F = ({ id, label, children }) => (<div className="space-y-1.5"><Label htmlFor={id} className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>{children}</div>);

export const DetailsPanel = ({ sport, d, setData }) => {
  const set = (k, max) => (e) => setData({ [k]: e.target.value.slice(0, max) });
  const esports = sport?.kind === "esports";
  const fields = [
    ["name", "Player name", 40, true], ["nickname", esports ? "Gamer tag" : "Nickname", 24, true],
    ["team", esports ? "Team / clan" : "Team or club", 40, sport?.kind !== "individual" || d.show.team],
    ["jersey", "Jersey number", 3, sport?.kind === "team"], ["position", sport?.position_label || "Position", 28, true],
    ["country", "Country / region", 30, true], ["season", "Season or date", 12, true], ["rating", esports ? "Rank / rating" : "Rating (e.g. 87)", 8, true],
    ["tagline", "Tagline", 60, true], ["social", "Social handle", 30, true],
  ];
  const ach = d.achievements || [];
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        {fields.filter((f) => f[3]).map(([k, l, max]) => (
          <F key={k} id={`f-${k}`} label={l}><Input id={`f-${k}`} data-testid={`detail-${k}-input`} value={d[k] || ""} maxLength={max} onChange={set(k, max)} placeholder={k === "name" ? "e.g. Aarav Sharma" : ""} /></F>
        ))}
      </div>
      {sport?.kind === "individual" && !d.show.team && <button className="text-xs text-amber-500 hover:underline" data-testid="detail-add-team-button" onClick={() => setData({ show: { ...d.show, team: true } })}>+ Add a club or academy</button>}
      <F id="ach" label="Achievements (up to 3)">
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Input key={i} data-testid={`detail-achievement-${i}-input`} maxLength={48} value={ach[i] || ""} placeholder={i === 0 ? "e.g. District champion 2025" : "Optional"}
              onChange={(e) => { const n = [...ach]; n[i] = e.target.value; setData({ achievements: n.filter((x, j) => x || j < i).slice(0, 3) }); }} />
          ))}
        </div>
      </F>
    </div>
  );
};

export const StatsPanel = ({ sport, d, setData }) => {
  const toggle = (k, on) => {
    const keys = on ? [...d.statKeys, k] : d.statKeys.filter((x) => x !== k);
    if (keys.length > 6) return toast.error("Cards show up to 6 stats. Untick one first.");
    setData({ statKeys: keys });
  };
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{sport?.name} stats — tick up to 6 to show. All stats are self-reported.</p>
      {(sport?.stats || []).map((s) => (
        <div key={s.key} className="flex items-center gap-3">
          <Checkbox data-testid={`stat-toggle-${s.key}`} checked={d.statKeys.includes(s.key)} onCheckedChange={(v) => toggle(s.key, !!v)} aria-label={`Show ${s.label}`} />
          <Label className="w-32 shrink-0 text-sm truncate">{s.label}</Label>
          <Input data-testid={`stat-value-${s.key}`} maxLength={9} className="h-9 font-mono" value={d.stats[s.key] || ""} onChange={(e) => setData({ stats: { ...d.stats, [s.key]: e.target.value.slice(0, 9) } })} placeholder="—" />
        </div>
      ))}
    </div>
  );
};

const SHOW = [["nickname", "Nickname"], ["team", "Team"], ["jersey", "Jersey"], ["position", "Position"], ["country", "Country"], ["season", "Season"], ["rating", "Rating"], ["achievements", "Achievements"], ["tagline", "Tagline"], ["social", "Social handle"], ["stats", "Stats"]];

const TeamBranding = ({ d, setData, ent }) => {
  const api = useApi();
  const [brand, setBrand] = useState(null);
  const ok = !!ent?.features?.shared_branding;
  useEffect(() => { if (ok) api("get", "/me/brand").then(setBrand).catch(() => {}); }, [ok, api]);
  const save = async () => { try { setBrand(await api("put", "/me/brand", { team: d.team || "", accent: d.accent || "" })); toast.success("Team branding saved for your squad cards"); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <div className="rounded-xl border border-border p-4 space-y-2" data-testid="team-branding-section">
      <p className="font-semibold text-sm flex items-center gap-2">Shared team branding {!ok && <><Lock className="w-3 h-3" /><span className="text-[10px] font-bold uppercase bg-amber-500 text-slate-950 px-1.5 rounded">Team</span></>}</p>
      {ok ? (
        <div className="flex flex-wrap gap-2 items-center">
          <Button size="sm" variant="outline" className="rounded-full" onClick={save} data-testid="brand-save-button">Save current team & accent</Button>
          {(brand?.team || brand?.accent) && <Button size="sm" className="rounded-full" onClick={() => setData({ team: brand.team, accent: brand.accent, show: { ...d.show, team: true } })} data-testid="brand-apply-button">Apply {brand.team || "brand"}</Button>}
        </div>
      ) : <p className="text-xs text-muted-foreground">Save your squad's team name and colour once and apply it to every player card. Included in the Team plan.</p>}
    </div>
  );
};

export const StylePanel = ({ d, template, setData, onReset, ent }) => (
  <div className="space-y-6">
    <TeamBranding d={d} setData={setData} ent={ent} />
    <div>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Accent colour</Label>
      <div className="flex flex-wrap gap-2 mt-2">
        <button data-testid="accent-default" onClick={() => setData({ accent: "" })} className={`h-9 px-3 rounded-full border text-xs ${!d.accent ? "border-amber-500" : "border-border"}`} style={{ color: template?.accent }}>Template</button>
        {ACCENTS.map((c) => (
          <button key={c} data-testid={`accent-${c.slice(1)}`} aria-label={`Accent ${c}`} onClick={() => setData({ accent: c })}
            className={`w-9 h-9 rounded-full border-2 transition-transform hover:scale-110 ${d.accent === c ? "border-foreground" : "border-transparent"}`} style={{ background: c }} />
        ))}
        <input type="color" data-testid="accent-custom-input" aria-label="Custom accent" value={d.accent || template?.accent || "#D4AF37"} onChange={(e) => setData({ accent: e.target.value })} className="w-9 h-9 rounded-full bg-transparent cursor-pointer" />
      </div>
    </div>
    <div>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Visible fields</Label>
      <div className="grid grid-cols-2 gap-3 mt-3">
        {SHOW.map(([k, l]) => (
          <label key={k} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm">
            {l}<Switch data-testid={`show-${k}-switch`} checked={!!d.show[k]} onCheckedChange={(v) => setData({ show: { ...d.show, [k]: v } })} />
          </label>
        ))}
      </div>
    </div>
    <Button variant="outline" className="rounded-full" onClick={onReset} data-testid="style-reset-card-button">Reset all card details</Button>
  </div>
);
