import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { Show } from "@clerk/react";
import { toast } from "sonner";
import { Zap, Droplets, Ticket, Receipt, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API, useApi, errMsg, inr } from "@/lib/api";
import { useCheckout } from "@/lib/checkout";

export const STATES = ["Andhra Pradesh", "Assam", "Bihar", "Chandigarh", "Chhattisgarh", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Other"];

export function CheckoutOptions({ extras, setExtras }) {
  const api = useApi();
  const [code, setCode] = useState(extras.coupon);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [gst, setGst] = useState(false);
  const apply = async () => {
    if (!code.trim()) { setExtras({ ...extras, coupon: "" }); setMsg(""); return; }
    setBusy(true);
    try {
      const q = await api("post", "/billing/quote", { kind: "pack", item_id: "pack10", coupon: code });
      setExtras({ ...extras, coupon: q.coupon }); setMsg(`Coupon ${q.coupon} applied. You'll see the discount in the payment window.`);
    } catch (e) {
      const m = errMsg(e);
      if (m.includes("only works on plans")) { setExtras({ ...extras, coupon: code.trim().toUpperCase() }); setMsg("Coupon saved. It works on plans."); }
      else { setExtras({ ...extras, coupon: "" }); setMsg(""); toast.error(m); }
    } finally { setBusy(false); }
  };
  const b = extras.billing || {};
  const setB = (k) => (e) => setExtras({ ...extras, billing: { ...b, [k]: k === "gstin" ? e.target.value.toUpperCase() : e.target.value } });
  return (
    <Show when="signed-in">
      <div className="mt-8 grid md:grid-cols-2 gap-4" data-testid="checkout-options">
        <div className="rounded-2xl border border-border p-4">
          <p className="text-sm font-semibold flex items-center gap-2"><Ticket className="w-4 h-4 text-amber-500" />Have a coupon?</p>
          <div className="flex gap-2 mt-3"><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter code" className="uppercase" data-testid="coupon-input" />
            <Button variant="outline" onClick={apply} disabled={busy} data-testid="coupon-apply-button">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}</Button></div>
          {msg && <p className="text-xs text-emerald-500 mt-2 flex items-center gap-1" data-testid="coupon-message"><Check className="w-3 h-3" />{msg}</p>}
        </div>
        <div className="rounded-2xl border border-border p-4">
          <button onClick={() => setGst(!gst)} className="text-sm font-semibold flex items-center gap-2" data-testid="gst-toggle"><Receipt className="w-4 h-4 text-amber-500" />Need a GST invoice? Add business details</button>
          {gst && (
            <div className="grid sm:grid-cols-3 gap-2 mt-3" data-testid="gst-fields">
              <Input value={b.name || ""} onChange={setB("name")} placeholder="Business name" data-testid="billing-name-input" />
              <Input value={b.gstin || ""} onChange={setB("gstin")} placeholder="GSTIN" maxLength={15} data-testid="billing-gstin-input" />
              <select value={b.state || ""} onChange={setB("state")} className="h-10 rounded-md border border-input bg-background px-2 text-sm" data-testid="billing-state-select">
                <option value="">State</option>{STATES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          )}
          {!gst && <p className="text-xs text-muted-foreground mt-2">Every payment comes with an invoice in your dashboard.</p>}
        </div>
      </div>
    </Show>
  );
}

export function TopUps() {
  const [st, setSt] = useState(null);
  const { buy, busy } = useCheckout();
  useEffect(() => { axios.get(`${API}/store`).then((r) => setSt(r.data)).catch(() => {}); }, []);
  if (!st) return null;
  const Btn = ({ kind, id, children }) => (
    <>
      <Show when="signed-in"><Button onClick={() => buy(kind, id)} disabled={!!busy} className="w-full rounded-full font-bold mt-4" data-testid={`buy-${kind}-${id}`}>{busy === `${kind}-${id}` && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}{children}</Button></Show>
      <Show when="signed-out"><Button asChild className="w-full rounded-full font-bold mt-4"><Link to="/sign-in?redirect_url=/pricing">Sign in to buy</Link></Button></Show>
    </>
  );
  return (
    <section id="topups" className="mt-16 scroll-mt-24" data-testid="topups-section">
      <p className="eyebrow">No subscription needed</p>
      <h2 className="font-display font-black uppercase text-3xl sm:text-4xl mt-1">Top-ups & extras</h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-xl">Out of cards this month? Grab a pack. Pack cards never expire and are used after your monthly credits.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-6">
        {st.packs.map((p, i) => (
          <div key={p.id} className={`rounded-2xl border p-5 flex flex-col ${i === 1 ? "border-amber-500" : "border-border"}`} data-testid={`pack-${p.id}`}>
            <Zap className="w-5 h-5 text-amber-500" />
            <p className="font-display font-black uppercase text-2xl mt-2">{p.cards} cards</p>
            <p className="text-3xl font-display font-black mt-1">{inr(p.price)}</p>
            <p className="text-xs text-muted-foreground">{inr((p.price / p.cards).toFixed(2))} per card · never expires</p>
            <div className="mt-auto"><Btn kind="pack" id={p.id}>Buy pack</Btn></div>
          </div>
        ))}
        <div className="rounded-2xl border border-border p-5 flex flex-col" data-testid="watermark-single">
          <Droplets className="w-5 h-5 text-amber-500" />
          <p className="font-display font-black uppercase text-2xl mt-2">No watermark</p>
          <p className="text-3xl font-display font-black mt-1">{inr(st.wm_price)}</p>
          <p className="text-xs text-muted-foreground">One Free-plan download without the watermark</p>
          <div className="mt-auto"><Btn kind="watermark" id="single">Buy 1 pass</Btn></div>
        </div>
        <div className="rounded-2xl border border-border p-5 flex flex-col" data-testid="watermark-bundle">
          <Droplets className="w-5 h-5 text-amber-500" />
          <p className="font-display font-black uppercase text-2xl mt-2">{st.wm_bundle_qty} passes</p>
          <p className="text-3xl font-display font-black mt-1">{inr(st.wm_bundle_price)}</p>
          <p className="text-xs text-muted-foreground">{st.wm_bundle_qty} watermark-free downloads</p>
          <div className="mt-auto"><Btn kind="watermark" id="bundle">Buy {st.wm_bundle_qty} passes</Btn></div>
        </div>
      </div>
    </section>
  );
}
