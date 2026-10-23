import { useAppData } from "@/context/AppData";
import { PricingGrid } from "@/components/PricingGrid";

const TERMS = [
  ["One-time vs recurring", "Premium Card and Team Pack are one-time purchases with no auto-renewal. Pro Creator is a recurring subscription billed per period."],
  ["Cancellation", "Cancel Pro Creator any time. You keep access until the end of the period you already paid for; it will not renew."],
  ["Refunds", "One-time purchases can be refunded within 7 days if the premium design has not been exported. Subscription refunds follow applicable law and gateway rules."],
  ["Price changes", "New prices apply to future purchases only. Existing subscriptions keep the terms they were bought on."],
  ["Payments status", "Online payments are not live yet. No charge can be made today. Complimentary access may be granted by our team for testing and promotions."],
];

export default function Pricing() {
  const { plans } = useAppData();
  return (
    <div className="container-x py-12" data-testid="pricing-page">
      <p className="eyebrow">Plans in INR</p>
      <h1 className="font-display font-black uppercase text-4xl sm:text-5xl lg:text-6xl">Simple, fair pricing</h1>
      <p className="text-muted-foreground mt-3 max-w-xl">Basic card creation is free forever. Prices below come directly from our plan settings.</p>
      <div className="mt-10"><PricingGrid plans={plans} /></div>
      <div className="mt-16 grid md:grid-cols-2 gap-6">
        {TERMS.map(([t, d]) => (
          <div key={t} className="rounded-2xl border border-border p-6"><p className="font-display font-bold uppercase text-xl">{t}</p><p className="text-sm text-muted-foreground mt-2">{d}</p></div>
        ))}
      </div>
    </div>
  );
}
