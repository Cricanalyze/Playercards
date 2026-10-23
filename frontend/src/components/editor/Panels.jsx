import { useRef } from "react";
import { Lock, Upload, Trash2, RefreshCw, ZoomIn, Check } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { SportsGrid } from "@/components/SportsGrid";
import { ScaledCard } from "@/components/card/PlayerCard";
import { ACCENTS, MAX_MB, processPhoto } from "@/lib/cardUtils";

export const canUse = (t, ent) => t.tier === "free" || ent?.all_premium_templates || ent?.premium_templates?.includes(t.id);

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
              {t.tier === "premium" && <span className="text-[9px] font-bold uppercase bg-amber-500 text-slate-950 px-1.5 rounded">Pro</span>}
            </div>
            {t.recommended?.includes(sport?.category) && <span className="text-[10px] text-cyan-500 uppercase tracking-wide">Great for {sport.name}</span>}
          </button>
        );
      })}
    </div>
  );
};

export const PhotoPanel = ({ photo, setPhoto }) => {
  const input = useRef(null);
  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try { setPhoto({ src: await processPhoto(f), zoom: 1, x: 0, y: 0 }); toast.success("Photo added. Drag the card preview to reposition."); }
    catch (err) { toast.error(err.message); }
  };
  const set = (k) => (v) => setPhoto({ ...photo, [k]: v[0] }, false);
  return (
    <div className="space-y-5">
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} data-testid="photo-file-input" />
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => input.current.click()} className="rounded-full font-bold hover:bg-amber-400 hover:text-slate-950" data-testid="photo-upload-button">
          {photo.src ? <><RefreshCw className="w-4 h-4 mr-1" /> Replace photo</> : <><Upload className="w-4 h-4 mr-1" /> Upload photo</>}</Button>
        {photo.src && <Button variant="outline" className="rounded-full" onClick={() => setPhoto({ src: "", zoom: 1, x: 0, y: 0 })} data-testid="photo-remove-button"><Trash2 className="w-4 h-4 mr-1" /> Remove</Button>}
        {photo.src && <Button variant="ghost" className="rounded-full" onClick={() => setPhoto({ ...photo, zoom: 1, x: 0, y: 0 })} data-testid="photo-reset-position-button">Reset position</Button>}
      </div>
      <p className="text-xs text-muted-foreground">JPG, PNG or WebP up to {MAX_MB} MB. Your photo is processed on this device only and is never uploaded. Only use photos you have permission to use.</p>
      {photo.src && (
        <div className="space-y-4">
          {[["zoom", "Zoom", 1, 3, 0.02], ["x", "Left / right", -50, 50, 0.5], ["y", "Up / down", -50, 50, 0.5]].map(([k, l, min, max, step]) => (
            <div key={k} className="space-y-2">
              <Label className="flex items-center gap-2 text-xs uppercase tracking-wider">{k === "zoom" && <ZoomIn className="w-3 h-3" />}{l}</Label>
              <Slider data-testid={`photo-${k}-slider`} min={min} max={max} step={step} value={[photo[k]]} onValueChange={set(k)} />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Tip: drag directly on the card preview to move the photo.</p>
        </div>
      )}
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

export const StylePanel = ({ d, template, setData, onReset }) => (
  <div className="space-y-6">
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
