import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Rocket, Wrench, Loader2, Eye, Play, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useApi, errMsg } from "@/lib/api";
import { useSiteStatus } from "@/context/SiteStatus";

const toLocal = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fromLocal = (v) => (v ? new Date(v).toISOString() : "");
const PRESETS = [[15, "15 min"], [30, "30 min"], [60, "1 hour"], [120, "2 hours"], [240, "4 hours"], [480, "8 hours"]];
const STATE = {
  live: ["Live", "text-emerald-500 border-emerald-500"],
  coming_soon: ["Coming soon page is on", "text-amber-500 border-amber-500"],
  maintenance: ["Maintenance in progress", "text-destructive border-destructive"],
  maintenance_scheduled: ["Maintenance scheduled", "text-sky-500 border-sky-500"],
};

const Card = ({ icon: Icon, title, on, onToggle, testId, children }) => (
  <div className={`rounded-xl border p-4 space-y-4 transition-colors ${on ? "border-amber-500 bg-amber-500/5" : "border-border"}`} data-testid={testId}>
    <div className="flex items-center justify-between gap-3">
      <p className="font-semibold flex items-center gap-2"><Icon className="w-4 h-4 text-amber-500" />{title}</p>
      <Switch checked={on} onCheckedChange={onToggle} data-testid={`${testId}-switch`} />
    </div>
    {children}
  </div>
);

export function SiteModeSettings({ data, status, onSaved }) {
  const api = useApi();
  const { refresh } = useSiteStatus();
  const [f, setF] = useState(data);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? e.target.value : e });
  const save = async (next = f) => {
    setBusy(true);
    try { const r = await api("put", "/admin/settings/site", { ...next, mt_duration_min: Number(next.mt_duration_min) }); setF(r.site); onSaved(r); refresh(); toast.success("Site status updated"); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  const startNow = () => save({ ...f, mt_enabled: true, mt_start_at: new Date().toISOString(), cs_enabled: false });
  const goLive = () => save({ ...f, cs_enabled: false, mt_enabled: false });
  const [label, tone] = STATE[status.state] || STATE.live;
  return (
    <section className="rounded-xl border border-border p-5 space-y-4" data-testid="settings-site-mode">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3"><Globe className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
          <div><p className="font-semibold">Site status</p><p className="text-xs text-muted-foreground">Block the whole website for visitors and users with a Coming soon or Maintenance page. Admins can still use the site.</p></div></div>
        <span className={`px-3 h-7 inline-flex items-center rounded-full border text-xs font-bold ${tone}`} data-testid="site-state-badge">{label}</span>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Card icon={Rocket} title="Coming soon page" on={f.cs_enabled} onToggle={(v) => setF({ ...f, cs_enabled: v, mt_enabled: v ? false : f.mt_enabled })} testId="site-coming-soon">
          <div className="space-y-1.5"><Label>Launch date & time</Label><Input type="datetime-local" value={toLocal(f.cs_launch_at)} onChange={(e) => setF({ ...f, cs_launch_at: fromLocal(e.target.value) })} data-testid="cs-launch-input" /></div>
          <div className="flex items-center justify-between gap-3"><Label className="text-sm font-normal">Open the site automatically at launch time</Label><Switch checked={f.cs_auto_open} onCheckedChange={set("cs_auto_open")} data-testid="cs-auto-open-switch" /></div>
          <div className="space-y-1.5"><Label>Headline</Label><Input value={f.cs_title} maxLength={80} onChange={set("cs_title")} data-testid="cs-title-input" /></div>
          <div className="space-y-1.5"><Label>Message</Label><Textarea rows={2} value={f.cs_message} maxLength={300} onChange={set("cs_message")} data-testid="cs-message-input" /></div>
          <Button asChild variant="outline" size="sm"><Link to="/?preview=coming_soon" target="_blank" data-testid="cs-preview-link"><Eye className="w-4 h-4 mr-1" />Preview page</Link></Button>
        </Card>
        <Card icon={Wrench} title="Maintenance page" on={f.mt_enabled} onToggle={(v) => setF({ ...f, mt_enabled: v, cs_enabled: v ? false : f.cs_enabled })} testId="site-maintenance">
          <div className="space-y-1.5"><Label>Starts at</Label>
            <div className="flex gap-2"><Input type="datetime-local" value={toLocal(f.mt_start_at)} onChange={(e) => setF({ ...f, mt_start_at: fromLocal(e.target.value) })} data-testid="mt-start-input" />
              <Button type="button" variant="outline" onClick={startNow} disabled={busy} data-testid="mt-start-now-button"><Play className="w-4 h-4 mr-1" />Start now</Button></div>
          </div>
          <div className="space-y-1.5"><Label>How long</Label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map(([m, l]) => (
                <button type="button" key={m} onClick={() => setF({ ...f, mt_duration_min: m })} data-testid={`mt-duration-${m}`}
                  className={`px-3 h-8 rounded-full border text-xs font-semibold transition-colors ${Number(f.mt_duration_min) === m ? "bg-amber-500 border-amber-500 text-slate-950" : "border-border hover:border-amber-500"}`}>{l}</button>
              ))}
              <div className="flex items-center gap-1"><Input type="number" min={5} max={10080} value={f.mt_duration_min} onChange={set("mt_duration_min")} className="w-24 h-8" data-testid="mt-duration-input" /><span className="text-xs text-muted-foreground">min</span></div>
            </div>
            <p className="text-[11px] text-muted-foreground">Visitors see a banner before it starts. The site opens again by itself when the time is up.</p>
          </div>
          <div className="space-y-1.5"><Label>Message</Label><Textarea rows={2} value={f.mt_message} maxLength={300} onChange={set("mt_message")} data-testid="mt-message-input" /></div>
          <Button asChild variant="outline" size="sm"><Link to="/?preview=maintenance" target="_blank" data-testid="mt-preview-link"><Eye className="w-4 h-4 mr-1" />Preview page</Link></Button>
        </Card>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => save()} disabled={busy} data-testid="site-mode-save-button">{busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Save site status</Button>
        {status.state !== "live" && <Button variant="outline" onClick={goLive} disabled={busy} data-testid="site-go-live-button">Open site now for everyone</Button>}
      </div>
    </section>
  );
}
