import { Suspense, lazy, useState } from "react";
import { Link } from "react-router-dom";
import { Share2, Users, Smartphone, Lock, Layers, Shirt } from "lucide-react";
import { useAppData } from "@/context/AppData";
import { demoFor } from "@/lib/cardUtils";
import { SportsGrid } from "@/components/SportsGrid";
import { PricingGrid } from "@/components/PricingGrid";
import { FaqList, ContactForm } from "@/components/Support";
import { StadiumHero } from "@/components/arena/StadiumHero";
import { StadiumSteps } from "@/components/arena/StadiumSteps";
import { TiltCard } from "@/components/arena/TiltCard";
import { SectionHead, SportsTicker } from "@/components/arena/Bits";
import { Tilt3D } from "@/components/arena/Scene3D";
import { hasWebGL } from "@/components/three/webgl";

const HomeWorld = lazy(() => import("@/components/three/HomeWorld"));

// Each section opens with a clear "window" onto the 3D stadium, then a solid panel for content.
const Section = ({ id, children, ...head }) => (
  <section id={id} className="relative">
    <div className="container-x min-h-[58vh] flex items-end pb-10 pt-24">
      <div className="rounded-2xl bg-[#06080D]/55 px-5 py-4 -mx-5"><SectionHead {...head} /></div>
    </div>
    <div className="container-x">
      <div className="rounded-3xl bg-[#090C12]/90 border border-white/10 p-5 sm:p-10 shadow-[0_40px_120px_-40px_rgba(0,0,0,.9)]">{children}</div>
    </div>
  </section>
);

const Templates = () => {
  const { templates, sports } = useAppData();
  return (
    <div className="flex gap-8 overflow-x-auto pt-6 pb-6 -mx-2 px-2 snap-x [scrollbar-width:thin]" data-testid="featured-templates">
      {templates.map((t, i) => {
        const demo = sports.length ? demoFor(i, sports) : null;
        return (
          <Link key={t.id} to={`/create?template=${t.id}`} data-testid={`featured-template-${t.id}`} className="snap-start shrink-0 group">
            <div style={{ transform: `rotate(${((i % 3) - 1) * 2.5}deg)` }} className="transition-transform duration-300 group-hover:!rotate-0">
              {demo && <TiltCard width={200} flip={false} template={t} sport={demo.sport} data={demo.data} photo={demo.photo} />}
            </div>
            <div className="mt-4 flex items-center justify-between w-[200px]">
              <span className="font-poster font-black uppercase text-xl group-hover:text-amber-400 transition-colors">{t.name}</span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded -rotate-2 ${t.collection !== "free" ? "bg-amber-400 text-slate-950" : "bg-white/10 text-slate-300"}`}>{t.collection || t.tier}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
};

const BENEFITS = [
  [Smartphone, "For players", "A pro-looking identity card for your profile, trials and socials — free.", "bg-amber-400"],
  [Users, "For teams & clubs", "Matching cards for the whole squad with a shared team theme (Team Pack).", "bg-cyan-300"],
  [Shirt, "Team details built-in", "Team names, positions and jersey numbers for team sports only — individual athletes skip them.", "bg-rose-400"],
  [Layers, "Tournaments", "Announce line-ups, award MVPs and celebrate rookies with dedicated editions.", "bg-emerald-400"],
  [Lock, "Private by default", "No public profiles, no photo uploads to the cloud. You decide what you share.", "bg-amber-400"],
  [Share2, "Made for sharing", "One tap share on supported phones, with simple steps everywhere else.", "bg-cyan-300"],
];
const TILT = [-1.6, 1.2, -0.6, 1.8, -1.2, 0.7];

const Benefits = () => (
  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
    {BENEFITS.map(([Icon, t, d, c], i) => (
      <Tilt3D key={t} className={i % 3 === 1 ? "lg:mt-8" : ""}>
        <div className="paper relative h-full rounded-lg border border-border p-7 shadow-[0_18px_34px_-18px_rgba(0,0,0,.6)]" style={{ transform: `rotate(${TILT[i]}deg)` }} data-testid={`benefit-${i + 1}`}>
          {i % 2 === 0 && <span className="tape" />}
          <span className={`inline-grid place-items-center w-11 h-11 rounded-full ${c} text-slate-950 shadow`} style={{ transform: "translateZ(40px) rotate(-6deg)" }}><Icon className="w-5 h-5" /></span>
          <p className="font-poster font-black uppercase text-2xl mt-4 leading-none" style={{ transform: "translateZ(25px)" }}>{t}</p>
          <p className="text-sm text-muted-foreground mt-2">{d}</p>
        </div>
      </Tilt3D>
    ))}
  </div>
);

const Cta = () => (
  <section id="cta-section" className="relative">
    <div className="min-h-[55vh]" />
    <div className="container-x">
      <div className="ticket rounded-3xl bg-[#06080D]/85 border border-white/10 px-8 sm:px-14 py-12 sm:py-16 grid md:grid-cols-[1fr_auto] gap-8 items-center overflow-hidden">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-amber-400">Admit one · Gate FC · Row 01</p>
          <h3 className="font-poster font-black uppercase text-5xl sm:text-7xl leading-[0.85] mt-3">Step onto<br />the card.</h3>
          <p className="text-slate-300 mt-3">Free, fast and made for your phone.</p>
        </div>
        <div className="md:border-l-2 md:border-dashed md:border-white/20 md:pl-10">
          <Link to="/create" data-testid="cta-create-card-button" className="press inline-flex items-center h-14 px-8 rounded-full bg-amber-400 text-slate-950 font-poster font-black uppercase text-xl hover:bg-amber-300">Create your card</Link>
          <div className="barcode h-10 w-48 mt-6 text-white/60" />
        </div>
      </div>
    </div>
  </section>
);

export default function Home() {
  const { sports, plans } = useAppData();
  const [gl] = useState(hasWebGL);
  const mobile = typeof window !== "undefined" && window.innerWidth < 640;
  return (
    <div data-testid="home-page" className="dark overflow-x-clip text-foreground pb-10">
      {gl ? <Suspense fallback={<div className="fixed inset-0 -z-10 bg-[#06080D]" />}><HomeWorld mobile={mobile} /></Suspense> : <div className="fixed inset-0 -z-10 bg-[#06080D]" />}
      <StadiumHero />
      <SportsTicker />
      <Section id="sports" n="01" eyebrow="Sports & games directory" title="Every sport. Every game." sub="Choose your sport to load the right stats — runs and wickets for cricket, raid points for kabaddi, ACS for Valorant.">
        <SportsGrid sports={sports} linkMode />
      </Section>
      <Section id="templates" n="02" eyebrow="Featured templates" title="25 original designs" sub="Five collections — Free, Basic, Pro, Premium and Exclusive. Each design shows the plan it needs.">
        <Templates />
      </Section>
      <div className="h-[30vh]" />
      <StadiumSteps />
      <Section id="benefits" n="03" eyebrow="Players · Teams · Tournaments" title="Built for the whole squad">
        <Benefits />
      </Section>
      <Section id="pricing" n="04" eyebrow="Pricing" title="Start free. Upgrade when you want." sub="Prices are in INR and come from our live plan settings. Pay monthly or yearly through Razorpay.">
        <PricingGrid plans={plans} />
      </Section>
      <Section id="faq" n="05" eyebrow="FAQ" title="Questions, answered">
        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-12">
          <FaqList />
          <Tilt3D className="h-fit" max={6}>
            <div id="contact" className="paper relative rounded-lg border border-border p-6 rotate-[0.6deg] shadow-[0_18px_34px_-18px_rgba(0,0,0,.6)]">
              <span className="tape" />
              <p className="font-poster font-black uppercase text-3xl">Contact & support</p>
              <p className="text-sm text-muted-foreground mt-1 mb-5">Questions, plan help or content reports — send us a note.</p>
              <ContactForm />
            </div>
          </Tilt3D>
        </div>
      </Section>
      <Cta />
    </div>
  );
}
