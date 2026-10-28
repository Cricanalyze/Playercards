import { useState } from "react";
import { toast } from "sonner";
import { useApi, errMsg } from "@/lib/api";
import { useAppData } from "@/context/AppData";

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
  const [busy, setBusy] = useState("");
  const pay = async (plan, cycle) => {
    setBusy(`${plan.id}-${cycle}`);
    try {
      await loadScript();
      const o = await api("post", "/billing/checkout", { plan_id: plan.id, cycle });
      await new Promise((resolve) => {
        const rz = new window.Razorpay({
          key: o.key_id, order_id: o.order_id, amount: o.amount, currency: o.currency, name: "RivalCard",
          description: `${o.plan_name} · ${cycle === "year" ? "12 months" : "1 month"}`, prefill: { email: o.email, name: o.name },
          theme: { color: "#D4AF37" },
          handler: async (r) => {
            try {
              const v = await api("post", "/billing/verify", r);
              if (v.status === "captured") toast.success(`${o.plan_name} is active. Enjoy your new card credits!`);
              else toast.message(`Payment is ${v.status}. Your plan activates automatically once Razorpay confirms it.`);
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
  return { pay, busy };
}
