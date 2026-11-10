import { useAppData } from "@/context/AppData";
import { PricingGrid } from "@/components/PricingGrid";
import { PaidHighlights } from "@/components/PaidHighlights";
import { useState } from "react";
import { CheckoutExtras } from "@/lib/checkout";
import { CheckoutOptions, TopUps } from "@/components/Store";

const TERMS = [
  ["Monthly vs yearly", "Monthly gives 1 month of access; yearly gives 12 months for the price of 10. Plans don't auto-renew — renew or switch any time."],
  ["Card credits", "Each PNG download or share uses 1 credit. Credits reset on the 1st of every month, including on yearly plans. Unused credits don't roll over."],
  ["Changing plans", "Buying a different plan replaces your current paid plan straight away. Renewing the same plan adds time to your expiry date."],
  ["Expiry", "When a plan expires you drop back to Free. Your saved cards and storybook pages are kept, but new cards stop being added to the storybook and public links turn off."],
  ["Refunds", "Refunds follow applicable law and Razorpay rules. A refunded payment ends the plan it paid for."],
  ["Price changes", "New prices apply to future purchases only."],
];

export default function Pricing() {
  const { plans } = useAppData();
  const [extras, setExtras] = useState({ coupon: "", billing: {} });
  return (
    <CheckoutExtras.Provider value={extras}>
    <div className="container-x py-12" data-testid="pricing-page">
      <p className="eyebrow">Plans in INR</p>
      <h1 className="font-display font-black uppercase text-4xl sm:text-5xl lg:text-6xl">Simple, fair pricing</h1>
      <p className="text-muted-foreground mt-3 max-w-xl">Basic card creation is free forever. Prices below come directly from our plan settings.</p>
      <CheckoutOptions extras={extras} setExtras={setExtras} />
      <div className="mt-8"><PricingGrid plans={plans} /></div>
      <TopUps />
      <PaidHighlights />
      <div className="mt-16 grid md:grid-cols-2 gap-6">
        {TERMS.map(([t, d]) => (
          <div key={t} className="rounded-2xl border border-border p-6"><p className="font-display font-bold uppercase text-xl">{t}</p><p className="text-sm text-muted-foreground mt-2">{d}</p></div>
        ))}
      </div>
    </div>
    </CheckoutExtras.Provider>
  );
}
