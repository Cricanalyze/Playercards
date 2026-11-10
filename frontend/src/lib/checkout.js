import { createContext, useContext, useState } from "react";
import { toast } from "sonner";
import { useApi, errMsg } from "@/lib/api";
import { useAppData } from "@/context/AppData";

// Coupon + GST billing details shared by every buy button on a page.
export const CheckoutExtras = createContext({ coupon: "", billing: {} });

const loadScript = () => new Promise((res, rej) => {
  if (window.Razorpay) return res();
  const s = document.createElement("script");
  s.src = "https://checkout.razorpay.com/v1/checkout.js";
  s.onload = res; s.onerror = () => rej(new Error("Could not load the payment window. Check your connection."));
  document.body.appendChild(s);
});

export function useCheckout() {
  const api = useApi();
  const { refreshMe } = useAppData();
  const extras = useContext(CheckoutExtras);
  const [busy, setBusy] = useState("");
  const open = async (key, body, describe) => {
    setBusy(key);
    try {
      await loadScript();
      const o = await api("post", "/billing/checkout", { ...body, coupon: extras.coupon || "", billing: extras.billing || {} });
      await new Promise((resolve) => {
        const rz = new window.Razorpay({
          key: o.key_id, order_id: o.order_id, amount: o.amount, currency: o.currency, name: "FlexoCards",
          description: describe(o), prefill: { email: o.email, name: o.name },
          theme: { color: "#D4AF37" },
          handler: async (r) => {
            try {
              const v = await api("post", "/billing/verify", r);
              if (v.status === "captured") toast.success(body.kind === "plan" ? `${o.plan_name} is active. Enjoy your new card credits!` : `${o.label} added to your account!`);
              else toast.message(`Payment is ${v.status}. It will be applied automatically once Razorpay confirms it.`);
            } catch (e) { toast.error(errMsg(e, "We couldn't verify the payment. If money was deducted, it will be confirmed automatically or refunded.")); }
            refreshMe(); resolve();
          },
          modal: { ondismiss: () => { toast.message("Payment window closed. No charge was made."); resolve(); } },
        });
        rz.on("payment.failed", (r) => toast.error(r?.error?.description || "Payment failed. You can try again."));
        rz.open();
      });
    } catch (e) { toast.error(errMsg(e, e.message)); }
    finally { setBusy(""); }
  };
  const pay = (plan, cycle) => open(`${plan.id}-${cycle}`, { kind: "plan", plan_id: plan.id, cycle }, (o) => `${o.plan_name} · ${cycle === "year" ? "12 months" : "1 month"}`);
  const buy = (kind, itemId) => open(`${kind}-${itemId}`, { kind, item_id: itemId }, (o) => o.label);
  return { pay, buy, busy };
}
