import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi, errMsg, fmtDate } from "@/lib/api";
import { PageHead } from "./AdminApp";

const EMPTY = { code: "", type: "percent", value: 10, applies_to: "all", max_uses: 0, once_per_user: true, expires_at: "", active: true };

export default function Coupons() {
  const api = useApi();
  const [rows, setRows] = useState([]);
  const [f, setF] = useState(EMPTY);
  const load = () => api("get", "/admin/coupons").then(setRows).catch((e) => toast.error(errMsg(e)));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async (body) => {
    try { await api("post", "/admin/coupons", { ...body, value: Number(body.value), max_uses: Number(body.max_uses), expires_at: body.expires_at ? new Date(`${body.expires_at.slice(0, 10)}T23:59:59`).toISOString() : "" }); toast.success("Coupon saved"); setF(EMPTY); load(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const del = async (c) => { if (!window.confirm(`Delete ${c.code}?`)) return; try { await api("delete", `/admin/coupons/${c.code}`); load(); } catch (e) { toast.error(errMsg(e)); } };
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? e.target.value : e });
  return (
    <div data-testid="admin-coupons">
      <PageHead title="Coupons" sub="Discount codes for plans, card packs and watermark passes. Customers enter them on the Pricing page." />
      <form onSubmit={(e) => { e.preventDefault(); save(f); }} className="rounded-xl border border-border p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end mb-6">
        <div><p className="text-xs mb-1">Code</p><Input required value={f.code} onChange={set("code")} placeholder="LAUNCH50" className="uppercase" data-testid="coupon-code-input" /></div>
        <div><p className="text-xs mb-1">Discount</p><div className="flex gap-2">
          <Input type="number" min={1} value={f.value} onChange={set("value")} data-testid="coupon-value-input" />
          <select value={f.type} onChange={set("type")} className="h-10 rounded-md border border-input bg-background px-2 text-sm" data-testid="coupon-type-select"><option value="percent">%</option><option value="flat">₹ off</option></select></div></div>
        <div><p className="text-xs mb-1">Works on</p><select value={f.applies_to} onChange={set("applies_to")} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" data-testid="coupon-applies-select">
          <option value="all">Everything</option><option value="plans">Plans only</option><option value="extras">Packs & passes only</option></select></div>
        <div><p className="text-xs mb-1">Max uses (0 = unlimited)</p><Input type="number" min={0} value={f.max_uses} onChange={set("max_uses")} data-testid="coupon-max-input" /></div>
        <div><p className="text-xs mb-1">Expires (optional)</p><Input type="date" value={f.expires_at} onChange={set("expires_at")} data-testid="coupon-expiry-input" /></div>
        <label className="flex items-center gap-2 text-sm"><Switch checked={f.once_per_user} onCheckedChange={set("once_per_user")} data-testid="coupon-once-switch" />Once per customer</label>
        <Button type="submit" data-testid="coupon-save-button"><Plus className="w-4 h-4 mr-1" />Save coupon</Button>
      </form>
      <div className="rounded-xl border border-border overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Discount</TableHead><TableHead>Works on</TableHead><TableHead>Used</TableHead><TableHead>Expires</TableHead><TableHead>Active</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.code} data-testid={`coupon-row-${c.code}`}>
                <TableCell className="font-mono font-bold">{c.code}</TableCell>
                <TableCell>{c.type === "percent" ? `${c.value}%` : `₹${c.value}`}</TableCell>
                <TableCell className="text-sm">{{ all: "Everything", plans: "Plans", extras: "Packs & passes" }[c.applies_to]}</TableCell>
                <TableCell>{c.uses || 0}{c.max_uses ? ` / ${c.max_uses}` : ""}</TableCell>
                <TableCell className="text-sm">{c.expires_at ? fmtDate(c.expires_at) : "Never"}</TableCell>
                <TableCell><Switch checked={c.active} onCheckedChange={(v) => save({ ...c, active: v, expires_at: c.expires_at ? c.expires_at.slice(0, 10) : "" })} data-testid={`coupon-active-${c.code}`} /></TableCell>
                <TableCell><Button size="icon" variant="ghost" onClick={() => del(c)} aria-label="Delete" data-testid={`coupon-delete-${c.code}`}><Trash2 className="w-4 h-4" /></Button></TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">No coupons yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
