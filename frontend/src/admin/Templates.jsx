import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useApi, errMsg } from "@/lib/api";
import { useAppData } from "@/context/AppData";
import { ScaledCard } from "@/components/card/PlayerCard";
import { demoFor, CATEGORY_LABELS } from "@/lib/cardUtils";
import { useMeta, PageHead } from "./AdminApp";

const LABEL = (l) => l.split("_").map((x) => x[0].toUpperCase() + x.slice(1)).join(" ");

function TemplateForm({ tpl, onClose }) {
  const api = useApi();
  const meta = useMeta();
  const { sports, loadCatalog } = useAppData();
  const [t, setT] = useState(tpl || { name: "", badge: "NEW", layout: "classic_athlete", tier: "free", description: "", accent: "#D4AF37", sports: [], recommended: [], watermark_free: true, active: true, order: 100 });
  const demo = sports.length ? demoFor(0, sports) : null;
  const save = async () => {
    const { id, ...body } = t;
    try { tpl ? await api("put", `/admin/templates/${tpl.id}`, { ...body, order: Number(body.order) }) : await api("post", "/admin/templates", { ...body, order: Number(body.order) }); toast.success("Template saved"); loadCatalog(); onClose(true); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="template-form-dialog">
        <DialogHeader><DialogTitle className="font-display uppercase text-2xl">{tpl ? `Edit ${tpl.name}` : "New template"}</DialogTitle></DialogHeader>
        <div className="grid md:grid-cols-[200px_1fr] gap-6">
          {demo && <ScaledCard width={200} template={t} sport={demo.sport} data={demo.data} photo={demo.photo} />}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Name</Label><Input value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} data-testid="template-name-input" /></div>
              <div className="space-y-1"><Label>Badge</Label><Input value={t.badge} maxLength={14} onChange={(e) => setT({ ...t, badge: e.target.value })} data-testid="template-badge-input" /></div>
              <div className="space-y-1"><Label>Base layout (validated)</Label>
                <Select value={t.layout} onValueChange={(v) => setT({ ...t, layout: v })}><SelectTrigger data-testid="template-layout-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{meta.layouts.map((l) => <SelectItem key={l} value={l}>{LABEL(l)}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Tier</Label>
                <Select value={t.tier} onValueChange={(v) => setT({ ...t, tier: v })}><SelectTrigger data-testid="template-tier-select"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="free">Free</SelectItem><SelectItem value="premium">Premium</SelectItem></SelectContent></Select></div>
              <div className="space-y-1"><Label>Accent colour</Label><div className="flex gap-2"><input type="color" value={t.accent} onChange={(e) => setT({ ...t, accent: e.target.value.toUpperCase() })} className="h-10 w-12" data-testid="template-accent-input" /><Input value={t.accent} onChange={(e) => setT({ ...t, accent: e.target.value })} /></div></div>
              <div className="space-y-1"><Label>Display order</Label><Input type="number" value={t.order} onChange={(e) => setT({ ...t, order: e.target.value })} data-testid="template-order-input" /></div>
            </div>
            <div className="space-y-1"><Label>Description</Label><Input value={t.description} onChange={(e) => setT({ ...t, description: e.target.value })} data-testid="template-description-input" /></div>
            <div className="space-y-1"><Label>Recommended for</Label>
              <div className="grid grid-cols-2 gap-2">{Object.entries(CATEGORY_LABELS).map(([k, l]) => (
                <label key={k} className="flex items-center gap-2 text-sm"><Checkbox checked={t.recommended.includes(k)} onCheckedChange={(v) => setT({ ...t, recommended: v ? [...t.recommended, k] : t.recommended.filter((x) => x !== k) })} />{l}</label>))}</div></div>
            <div className="space-y-1"><Label>Limit to sports (none = all sports)</Label>
              <Select value="" onValueChange={(v) => !t.sports.includes(v) && setT({ ...t, sports: [...t.sports, v] })}><SelectTrigger data-testid="template-sport-add-select"><SelectValue placeholder="Add a sport…" /></SelectTrigger>
                <SelectContent>{sports.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
              <div className="flex flex-wrap gap-1">{t.sports.map((s) => <Badge key={s} variant="outline" className="cursor-pointer" onClick={() => setT({ ...t, sports: t.sports.filter((x) => x !== s) })}>{s} ×</Badge>)}</div></div>
            <div className="flex flex-wrap gap-5">
              <label className="flex items-center gap-2 text-sm"><Switch checked={t.active} onCheckedChange={(v) => setT({ ...t, active: v })} data-testid="template-active-switch" />Enabled</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={t.watermark_free} onCheckedChange={(v) => setT({ ...t, watermark_free: v })} data-testid="template-watermark-switch" />Watermark on free exports</label>
            </div>
            <Button onClick={save} data-testid="template-save-button">Save template</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Templates() {
  const api = useApi();
  const { sports } = useAppData();
  const [list, setList] = useState([]);
  const [edit, setEdit] = useState(null);
  const load = () => api("get", "/admin/templates").then(setList).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const demo = sports.length ? demoFor(0, sports) : null;
  return (
    <div data-testid="admin-templates">
      <PageHead title="Card templates" sub="Templates use a controlled schema (base layout + validated options). No uploaded code is executed.">
        <Button onClick={() => setEdit({})} data-testid="template-new-button">New template</Button>
      </PageHead>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-5">
        {list.map((t) => (
          <div key={t.id} className={`space-y-2 ${t.active ? "" : "opacity-50"}`} data-testid={`admin-template-${t.id}`}>
            {demo && <ScaledCard width={170} template={t} sport={demo.sport} data={demo.data} photo={demo.photo} />}
            <p className="font-display font-bold uppercase">{t.name}</p>
            <div className="flex gap-1"><Badge variant="outline" className="uppercase text-[10px]">{t.tier}</Badge><Badge variant="secondary" className="text-[10px]">{t.active ? "On" : "Off"}</Badge></div>
            <Button size="sm" variant="outline" onClick={() => setEdit(t)} data-testid={`admin-template-edit-${t.id}`}>Edit</Button>
          </div>
        ))}
      </div>
      {edit && <TemplateForm tpl={edit.id ? edit : null} onClose={(saved) => { setEdit(null); if (saved) load(); }} />}
    </div>
  );
}
