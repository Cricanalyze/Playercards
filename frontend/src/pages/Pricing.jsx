import { useAppData } from "@/context/AppData";
import { PricingGrid } from "@/components/PricingGrid";
import { PaidHighlights } from "@/components/PaidHighlights";
import { useState } from "react";
import { CheckoutExtras } from "@/lib/checkout";
import { CheckoutOptions, TopUps } from "@/components/Store";
import { PageHero } from "@/components/arena/Bits";

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
    <div data-testid="pricing-page">
      <PageHero eyebrow="Plans in INR" title="Simple, fair pricing" sub="Basic card creation is free forever. Prices below come directly from our plan settings." />
      <div className="container-x py-12">
      <CheckoutOptions extras={extras} setExtras={setExtras} />
      <div className="mt-8"><PricingGrid plans={plans} /></div>
      <TopUps />
      <PaidHighlights />
      <div className="mt-16 grid md:grid-cols-2 gap-x-6 gap-y-10">
        {TERMS.map(([t, d], i) => (
          <div key={t} className="paper relative rounded-md border border-border p-6 pt-7" style={{ transform: `rotate(${i % 2 ? 0.7 : -0.7}deg)` }}><span className="tape" /><p className="font-poster font-black uppercase text-2xl leading-none">{t}</p><p className="text-sm text-muted-foreground mt-2">{d}</p></div>
        ))}
      </div>
      </div>
    </div>
    </CheckoutExtras.Provider>
  );
}
