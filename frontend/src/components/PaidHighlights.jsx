import { Link } from "react-router-dom";
import { BookOpen, Film, FileDown, Globe, Clock } from "lucide-react";

const ITEMS = [
  [BookOpen, "Flip-book album", "Every card you download becomes a page. Flip through it on the site or download it as a file that works offline."],
  [Film, "Story video", "A 9:16 video with 5 seconds for each card, ready for Instagram Stories, Reels and WhatsApp Status."],
  [FileDown, "PDF booklet", "A printable A4 booklet with a cover and one card per page."],
];

export const PaidHighlights = () => (
  <section className="mt-16 rounded-3xl border border-amber-500/40 bg-[#0b1a3a] text-white p-6 sm:p-10 relative overflow-hidden" data-testid="pricing-storybook-highlight">
    <div className="absolute inset-0 stage-grid opacity-25 pointer-events-none" />
    <div className="relative">
      <span className="inline-flex px-3 h-7 items-center rounded-full bg-amber-500 text-slate-950 text-[11px] font-black uppercase tracking-widest">Add-on · ₹29 for 30 days</span>
      <h2 className="font-display font-black uppercase text-3xl sm:text-5xl mt-4 leading-none">Your cards, as a storybook</h2>
      <p className="text-slate-300 mt-3 max-w-2xl text-sm sm:text-base">Add Storybook to any plan, Free included, for ₹29. For 30 days every card you download goes into a private storybook you can view and download three ways.</p>
      <div className="grid md:grid-cols-3 gap-4 mt-8">
        {ITEMS.map(([Icon, t, d]) => (
          <div key={t} className="rounded-2xl border border-white/10 bg-white/5 p-5" data-testid={`pricing-storybook-${t.split(" ")[0].toLowerCase()}`}>
            <Icon className="w-6 h-6 text-amber-400" />
            <p className="font-display font-bold uppercase text-xl mt-3">{t}</p>
            <p className="text-sm text-slate-300 mt-1">{d}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 grid sm:grid-cols-2 gap-3 text-sm">
        <p className="flex gap-2 items-start text-slate-200"><Globe className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />All paid plans: public share links anyone can open.</p>
        <p className="flex gap-2 items-start text-slate-200"><Clock className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />All paid plans: edit a card for 6 hours after you create it.</p>
      </div>
      <Link to="/storybook" className="inline-block mt-6 text-amber-400 text-sm font-semibold hover:underline" data-testid="pricing-storybook-link">See my storybook &rarr;</Link>
    </div>
  </section>
);
