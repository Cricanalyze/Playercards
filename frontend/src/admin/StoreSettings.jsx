import { useState } from "react";
import { toast } from "sonner";
import { Store, Receipt, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useApi, errMsg } from "@/lib/api";
import { STATES } from "@/components/Store";

const F = ({ label, children }) => <div className="space-y-1.5 min-w-0"><Label className="text-xs">{label}</Label>{children}</div>;

export function StoreSettings({ data, onSaved }) {
  const api = useApi();
  const [f, setF] = useState(data);
  const [busy, setBusy] = useState(false);
  const setPack = (i, k, v) => setF({ ...f, packs: f.packs.map((p, j) => (j === i ? { ...p, [k]: k === "id" ? v : Number(v) } : p)) });
  const save = async () => {
    setBusy(true);
    try { onSaved(await api("put", "/admin/settings/store", { ...f, wm_price: Number(f.wm_price), wm_bundle_qty: Number(f.wm_bundle_qty), wm_bundle_price: Number(f.wm_bundle_price), storybook_price: Number(f.storybook_price || 29), storybook_bundle_price: Number(f.storybook_bundle_price || 69), ref_reward_cards: Number(f.ref_reward_cards), ref_max_rewards: Number(f.ref_max_rewards) })); toast.success("Store prices saved"); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <section className="rounded-xl border border-border p-5 space-y-4" data-testid="settings-store">
      <div className="flex gap-3"><Store className="w-5 h-5 text-amber-500 mt-0.5" /><div><p className="font-semibold">Top-ups, watermark passes & referrals</p><p className="text-xs text-muted-foreground">Prices in ₹ shown on the Pricing page.</p></div></div>
      <div className="grid sm:grid-cols-3 gap-3">
        {f.packs.map((p, i) => (
          <div key={i} className="rounded-lg bg-muted/40 p-3 grid grid-cols-2 gap-2" data-testid={`store-pack-${i}`}>
            <F label="Cards"><Input type="number" value={p.cards} onChange={(e) => setPack(i, "cards", e.target.value)} data-testid={`store-pack-${i}-cards`} /></F>
            <F label="Price ₹"><Input type="number" value={p.price} onChange={(e) => setPack(i, "price", e.target.value)} data-testid={`store-pack-${i}-price`} /></F>
          </div>
        ))}
      </div>
      <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <F label="1 watermark pass ₹"><Input type="number" value={f.wm_price} onChange={(e) => setF({ ...f, wm_price: e.target.value })} data-testid="store-wm-price" /></F>
        <F label="Bundle size"><Input type="number" value={f.wm_bundle_qty} onChange={(e) => setF({ ...f, wm_bundle_qty: e.target.value })} data-testid="store-wm-qty" /></F>
        <F label="Bundle price ₹"><Input type="number" value={f.wm_bundle_price} onChange={(e) => setF({ ...f, wm_bundle_price: e.target.value })} data-testid="store-wm-bundle-price" /></F>
        <F label="Storybook add-on ₹ (30 days)"><Input type="number" value={f.storybook_price ?? 29} onChange={(e) => setF({ ...f, storybook_price: e.target.value })} data-testid="store-storybook-price" /></F>
        <F label="Storybook 90-day bundle ₹"><Input type="number" value={f.storybook_bundle_price ?? 69} onChange={(e) => setF({ ...f, storybook_bundle_price: e.target.value })} data-testid="store-storybook-bundle-price" /></F>
        <F label="Referral reward (cards)"><Input type="number" value={f.ref_reward_cards} onChange={(e) => setF({ ...f, ref_reward_cards: e.target.value })} data-testid="store-ref-reward" /></F>
        <F label="Max rewards per user"><Input type="number" value={f.ref_max_rewards} onChange={(e) => setF({ ...f, ref_max_rewards: e.target.value })} data-testid="store-ref-max" /></F>
        <F label="Referrals on"><Switch checked={f.ref_enabled} onCheckedChange={(v) => setF({ ...f, ref_enabled: v })} data-testid="store-ref-enabled" /></F>
      </div>
      <Button onClick={save} disabled={busy} data-testid="store-save-button">{busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Save store settings</Button>
    </section>
  );
}

export function InvoiceSettings({ data, onSaved }) {
  const api = useApi();
  const [f, setF] = useState(data);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? (k === "gstin" || k === "prefix" ? e.target.value.toUpperCase() : e.target.value) : e });
  const save = async () => {
    setBusy(true);
    try { onSaved(await api("put", "/admin/settings/invoice", { ...f, gst_rate: Number(f.gst_rate) })); toast.success("Invoice details saved"); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <section className="rounded-xl border border-border p-5 space-y-4" data-testid="settings-invoice">
      <div className="flex gap-3"><Receipt className="w-5 h-5 text-amber-500 mt-0.5" /><div><p className="font-semibold">GST invoices</p><p className="text-xs text-muted-foreground">Every paid order gets a numbered invoice. Add your GSTIN to issue GST tax invoices with CGST/SGST or IGST.</p></div></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <F label="Legal name"><Input value={f.legal_name} onChange={set("legal_name")} data-testid="inv-legal-name" /></F>
        <F label="GSTIN"><Input value={f.gstin} onChange={set("gstin")} maxLength={15} placeholder="Leave blank if not registered" data-testid="inv-gstin" /></F>
        <F label="State"><select value={f.state} onChange={set("state")} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" data-testid="inv-state"><option value="">Select state</option>{STATES.map((s) => <option key={s}>{s}</option>)}</select></F>
        <F label="State code"><Input value={f.state_code} onChange={set("state_code")} maxLength={2} placeholder="29" data-testid="inv-state-code" /></F>
        <div className="sm:col-span-2"><F label="Registered address"><Input value={f.address} onChange={set("address")} data-testid="inv-address" /></F></div>
        <F label="GST rate %"><Input type="number" value={f.gst_rate} onChange={set("gst_rate")} data-testid="inv-rate" /></F>
        <F label="SAC code"><Input value={f.sac} onChange={set("sac")} data-testid="inv-sac" /></F>
        <F label="Invoice prefix"><Input value={f.prefix} onChange={set("prefix")} maxLength={8} data-testid="inv-prefix" /></F>
        <F label="Billing email"><Input value={f.email} onChange={set("email")} data-testid="inv-email" /></F>
        <F label="Phone"><Input value={f.phone} onChange={set("phone")} data-testid="inv-phone" /></F>
        <F label="Prices include GST"><Switch checked={f.inclusive} onCheckedChange={set("inclusive")} data-testid="inv-inclusive" /></F>
      </div>
      <Button onClick={save} disabled={busy} data-testid="invoice-save-button">{busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Save invoice details</Button>
    </section>
  );
}
