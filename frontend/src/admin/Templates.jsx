import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useApi, errMsg } from "@/lib/api";
import { useAppData } from "@/context/AppData";
import { ScaledCard } from "@/components/card/PlayerCard";
import { demoFor, CATEGORY_LABELS } from "@/lib/cardUtils";
import { useMeta, PageHead } from "./AdminApp";

const LABEL = (l) => l.split("_").map((x) => x[0].toUpperCase() + x.slice(1)).join(" ");
const COLLECTIONS = { free: ["free", "basic", "pro", "team"], basic: ["basic", "pro", "team"], pro: ["pro", "team"], premium: ["pro", "team"], exclusive: ["team"] };
const BLANK = { name: "", badge: "NEW", layout: "classic_athlete", collection: "free", plans: COLLECTIONS.free, description: "", accent: "#D4AF37", sports: [], recommended: [], frame_image: "", watermark_free: true, active: false, order: 100 };
const strip = ({ id, tier, ...b }) => ({ ...BLANK, ...b, order: Number(b.order) || 0 });

function FrameUpload({ value, onChange }) {
  const ref = useRef(null);
  const onFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!["image/png", "image/webp"].includes(f.type)) return toast.error("Use a transparent PNG or WebP overlay.");
    if (f.size > 1.4 * 1024 * 1024) return toast.error("Keep the overlay under 1.4 MB.");
    const r = new FileReader();
    r.onload = () => onChange(r.result);
    r.readAsDataURL(f);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input ref={ref} type="file" accept="image/png,image/webp" className="hidden" onChange={onFile} data-testid="template-frame-file-input" />
      <Button size="sm" variant="outline" onClick={() => ref.current.click()} data-testid="template-frame-upload-button">{value ? "Replace overlay" : "Upload frame overlay"}</Button>
      {value && <Button size="sm" variant="ghost" onClick={() => onChange("")} data-testid="template-frame-remove-button">Remove overlay</Button>}
      <span className="text-xs text-muted-foreground">Transparent PNG/WebP drawn on top of the layout (360×504 ratio).</span>
    </div>
  );
}

function TemplateForm({ tpl, onClose }) {
  const api = useApi();
  const meta = useMeta();
  const { sports, plans, loadCatalog } = useAppData();
  const [t, setT] = useState(tpl ? { ...BLANK, ...tpl } : BLANK);
  const demo = sports.length ? demoFor(0, sports) : null;
  const save = async () => {
    try { tpl ? await api("put", `/admin/templates/${tpl.id}`, strip(t)) : await api("post", "/admin/templates", strip(t)); toast.success("Template saved"); loadCatalog(); onClose(true); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="template-form-dialog">
        <DialogHeader><DialogTitle className="font-display uppercase text-2xl">{tpl ? `Edit ${tpl.name}` : "New template"}</DialogTitle></DialogHeader>
        <div className="grid md:grid-cols-[200px_1fr] gap-6">
          {demo && <div data-testid="template-live-preview"><ScaledCard width={200} template={t} sport={demo.sport} data={demo.data} photo={demo.photo} /><p className="text-[10px] text-muted-foreground mt-1 text-center">Live preview</p></div>}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Name</Label><Input value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} data-testid="template-name-input" /></div>
              <div className="space-y-1"><Label>Badge</Label><Input value={t.badge} maxLength={14} onChange={(e) => setT({ ...t, badge: e.target.value })} data-testid="template-badge-input" /></div>
              <div className="space-y-1"><Label>Base layout</Label>
                <Select value={t.layout} onValueChange={(v) => setT({ ...t, layout: v })}><SelectTrigger data-testid="template-layout-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{meta.layouts.map((l) => <SelectItem key={l} value={l}>{LABEL(l)}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Collection</Label>
                <Select value={t.collection} onValueChange={(v) => setT({ ...t, collection: v, plans: COLLECTIONS[v] })}><SelectTrigger data-testid="template-collection-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.keys(COLLECTIONS).map((c) => <SelectItem key={c} value={c}>{LABEL(c)}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label>Accent colour</Label><div className="flex gap-2"><input type="color" value={t.accent} onChange={(e) => setT({ ...t, accent: e.target.value.toUpperCase() })} className="h-10 w-12" data-testid="template-accent-input" /><Input value={t.accent} onChange={(e) => setT({ ...t, accent: e.target.value })} /></div></div>
              <div className="space-y-1"><Label>Display order</Label><Input type="number" value={t.order} onChange={(e) => setT({ ...t, order: e.target.value })} data-testid="template-order-input" /></div>
            </div>
            <div className="space-y-1"><Label>Available on plans</Label>
              <div className="flex flex-wrap gap-4">{plans.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm"><Checkbox checked={t.plans.includes(p.id)} data-testid={`template-plan-${p.id}`} onCheckedChange={(v) => setT({ ...t, plans: v ? [...t.plans, p.id] : t.plans.filter((x) => x !== p.id) })} />{p.name}</label>))}</div></div>
            <div className="space-y-1"><Label>Description</Label><Input value={t.description} onChange={(e) => setT({ ...t, description: e.target.value })} data-testid="template-description-input" /></div>
            <div className="space-y-1"><Label>Frame overlay</Label><FrameUpload value={t.frame_image} onChange={(v) => setT({ ...t, frame_image: v })} /></div>
            <div className="space-y-1"><Label>Recommended for</Label>
              <div className="grid grid-cols-2 gap-2">{Object.entries(CATEGORY_LABELS).map(([k, l]) => (
                <label key={k} className="flex items-center gap-2 text-sm"><Checkbox checked={t.recommended.includes(k)} onCheckedChange={(v) => setT({ ...t, recommended: v ? [...t.recommended, k] : t.recommended.filter((x) => x !== k) })} />{l}</label>))}</div></div>
            <div className="space-y-1"><Label>Assign to sports (none = all sports)</Label>
              <Select value="" onValueChange={(v) => !t.sports.includes(v) && setT({ ...t, sports: [...t.sports, v] })}><SelectTrigger data-testid="template-sport-add-select"><SelectValue placeholder="Add a sport…" /></SelectTrigger>
                <SelectContent>{sports.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
              <div className="flex flex-wrap gap-1">{t.sports.map((s) => <Badge key={s} variant="outline" className="cursor-pointer" onClick={() => setT({ ...t, sports: t.sports.filter((x) => x !== s) })}>{s} ×</Badge>)}</div></div>
            <div className="flex flex-wrap gap-5">
              <label className="flex items-center gap-2 text-sm"><Switch checked={t.active} onCheckedChange={(v) => setT({ ...t, active: v })} data-testid="template-active-switch" />Published</label>
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
  const { sports, loadCatalog } = useAppData();
  const [list, setList] = useState([]);
  const [edit, setEdit] = useState(null);
  const load = () => api("get", "/admin/templates").then(setList).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const demo = sports.length ? demoFor(0, sports) : null;
  const act = async (fn, ok) => { try { await fn(); toast.success(ok); load(); loadCatalog(); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <div data-testid="admin-templates">
      <PageHead title="Card templates" sub={`${list.length} templates. New templates start unpublished — preview, then publish.`}>
        <Button onClick={() => setEdit({})} data-testid="template-new-button">New template</Button>
      </PageHead>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-5">
        {list.map((t) => (
          <div key={t.id} className={`space-y-2 ${t.active ? "" : "opacity-60"}`} data-testid={`admin-template-${t.id}`}>
            {demo && <ScaledCard width={170} template={t} sport={demo.sport} data={demo.data} photo={demo.photo} />}
            <p className="font-display font-bold uppercase">{t.name}</p>
            <div className="flex flex-wrap gap-1"><Badge variant="outline" className="uppercase text-[10px]">{t.collection}</Badge><Badge variant="secondary" className="text-[10px]">{t.active ? "Published" : "Draft"}</Badge></div>
            <p className="text-[10px] text-muted-foreground">Plans: {(t.plans || []).join(", ") || "all"}</p>
            <div className="flex flex-wrap gap-1">
              <Button size="sm" variant="outline" onClick={() => setEdit(t)} data-testid={`admin-template-edit-${t.id}`}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => act(() => api("put", `/admin/templates/${t.id}`, strip({ ...t, active: !t.active })), t.active ? "Unpublished" : "Published")} data-testid={`admin-template-toggle-${t.id}`}>{t.active ? "Unpublish" : "Publish"}</Button>
              <AlertDialog>
                <AlertDialogTrigger asChild><Button size="sm" variant="ghost" className="text-destructive" data-testid={`admin-template-delete-${t.id}`}>Delete</Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Delete {t.name}?</AlertDialogTitle><AlertDialogDescription>This removes the template for everyone. Saved cards using it will fall back to the first template.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => act(() => api("delete", `/admin/templates/${t.id}`), "Template deleted")} data-testid={`admin-template-confirm-delete-${t.id}`}>Delete</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </div>
      {edit && <TemplateForm tpl={edit.id ? edit : null} onClose={(saved) => { setEdit(null); if (saved) load(); }} />}
    </div>
  );
}
