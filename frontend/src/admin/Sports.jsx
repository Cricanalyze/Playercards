import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi, errMsg } from "@/lib/api";
import { useAppData } from "@/context/AppData";
import { CATEGORY_LABELS } from "@/lib/cardUtils";
import { PageHead } from "./AdminApp";

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);

function SportForm({ sport, onClose }) {
  const api = useApi();
  const { loadCatalog } = useAppData();
  const [s, setS] = useState(sport || { name: "", category: "team", kind: "team", position_label: "Position", stats: [], active: true, order: 100 });
  const [statsText, setStatsText] = useState((sport?.stats || []).map((x) => x.label).join("\n"));
  const save = async () => {
    const labels = statsText.split("\n").map((x) => x.trim()).filter(Boolean);
    const old = Object.fromEntries((sport?.stats || []).map((x) => [x.label, x.key]));
    const body = { name: s.name, category: s.category, kind: s.kind, position_label: s.position_label, active: s.active, order: Number(s.order),
      stats: labels.map((l) => ({ label: l.slice(0, 30), key: old[l] || slug(l) || "stat" })) };
    try { sport ? await api("put", `/admin/sports/${sport.id}`, body) : await api("post", "/admin/sports", body); toast.success("Sport saved"); loadCatalog(); onClose(true); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const Sel = ({ k, items, id }) => (
    <Select value={s[k]} onValueChange={(v) => setS({ ...s, [k]: v })}><SelectTrigger data-testid={id}><SelectValue /></SelectTrigger>
      <SelectContent>{items.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="sport-form-dialog">
        <DialogHeader><DialogTitle className="font-display uppercase text-2xl">{sport ? `Edit ${sport.name}` : "Add sport or game"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1"><Label>Name</Label><Input value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} data-testid="sport-name-input" /></div>
          <div className="space-y-1"><Label>Category</Label><Sel k="category" id="sport-category-select" items={Object.entries(CATEGORY_LABELS)} /></div>
          <div className="space-y-1"><Label>Kind</Label><Sel k="kind" id="sport-kind-select" items={[["team", "Team (team, jersey)"], ["individual", "Individual"], ["esports", "Esports (gamer tag)"]]} /></div>
          <div className="space-y-1"><Label>Position field label</Label><Input value={s.position_label} onChange={(e) => setS({ ...s, position_label: e.target.value })} data-testid="sport-position-label-input" /></div>
          <div className="space-y-1"><Label>Order</Label><Input type="number" value={s.order} onChange={(e) => setS({ ...s, order: e.target.value })} data-testid="sport-order-input" /></div>
        </div>
        <div className="space-y-1"><Label>Statistics (one per line, max 12)</Label><Textarea rows={7} value={statsText} onChange={(e) => setStatsText(e.target.value)} data-testid="sport-stats-input" placeholder={"Matches\nGoals\nAssists"} /></div>
        <label className="flex items-center gap-2 text-sm"><Switch checked={s.active} onCheckedChange={(v) => setS({ ...s, active: v })} data-testid="sport-active-switch" />Active (visible to users)</label>
        <Button onClick={save} data-testid="sport-save-button">Save</Button>
      </DialogContent>
    </Dialog>
  );
}

export default function Sports() {
  const api = useApi();
  const [list, setList] = useState([]);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState(null);
  const load = () => api("get", "/admin/sports").then(setList).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = list.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div data-testid="admin-sports">
      <PageHead title="Sports registry" sub={`${list.length} sports & games. Changes apply instantly, no code needed.`}>
        <Input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} className="w-48" data-testid="admin-sport-search" />
        <Button onClick={() => setEdit({})} data-testid="sport-add-button">Add sport</Button>
      </PageHead>
      <div className="rounded-xl border border-border overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Sport</TableHead><TableHead>Category</TableHead><TableHead>Kind</TableHead><TableHead>Stats</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.id} data-testid={`admin-sport-row-${s.id}`}>
                <TableCell className="font-semibold">{s.name}</TableCell>
                <TableCell className="text-sm">{CATEGORY_LABELS[s.category]}</TableCell>
                <TableCell className="text-sm capitalize">{s.kind}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{s.stats.map((x) => x.label).join(", ")}</TableCell>
                <TableCell><Badge variant={s.active ? "secondary" : "outline"}>{s.active ? "Active" : "Hidden"}</Badge></TableCell>
                <TableCell><Button size="sm" variant="outline" onClick={() => setEdit(s)} data-testid={`admin-sport-edit-${s.id}`}>Edit</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {edit && <SportForm sport={edit.id ? edit : null} onClose={(saved) => { setEdit(null); if (saved) load(); }} />}
    </div>
  );
}
