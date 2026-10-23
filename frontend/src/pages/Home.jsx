import { Link } from "react-router-dom";
import { ArrowRight, Upload, Palette, Download, Share2, Users, Trophy, Smartphone, Lock, Layers, Shirt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/context/AppData";
import { ScaledCard } from "@/components/card/PlayerCard";
import { demoFor } from "@/lib/cardUtils";
import { SportsGrid } from "@/components/SportsGrid";
import { PricingGrid } from "@/components/PricingGrid";
import { FaqList, ContactForm } from "@/components/Support";

const Section = ({ id, eyebrow, title, sub, children }) => (
  <section id={id} className="container-x pt-24">
    <p className="eyebrow">{eyebrow}</p>
    <h2 className="font-display font-black uppercase text-3xl sm:text-4xl lg:text-5xl tracking-tight mt-2">{title}</h2>
    {sub && <p className="text-muted-foreground mt-3 max-w-2xl text-sm sm:text-base">{sub}</p>}
    <div className="mt-10">{children}</div>
  </section>
);

const DemoCard = ({ i, width, style, className }) => {
  const { sports, templates } = useAppData();
  if (!sports.length || !templates.length) return <div style={{ width, height: width * 1.4 }} className="rounded-2xl bg-muted animate-pulse" />;
  const demo = demoFor(i, sports);
  return (
    <div className={className} style={style}>
      <ScaledCard width={width} template={templates.find((t) => t.id === demo.templateId)} sport={demo.sport} data={demo.data} photo={demo.photo} />
    </div>
  );
};

const Hero = () => (
  <section className="relative overflow-hidden noise">
    <div className="absolute inset-0 stage-grid" />
    <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-amber-500/10 blur-3xl" />
    <div className="absolute top-40 -left-40 w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-3xl" />
    <div className="container-x relative grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center py-16 lg:py-24">
      <div className="rise">
        <p className="eyebrow">All sports · Esports · Free to start</p>
        <h1 className="font-display font-black uppercase text-5xl sm:text-6xl lg:text-7xl leading-[0.9] tracking-tight mt-4">
          Your Game.<br />Your Identity.<br /><span className="text-amber-500">Your Card.</span>
        </h1>
        <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-lg">Turn any photo into a premium collectible player card in under a minute — for cricket, kabaddi, football, chess, BGMI and 55+ more. Download in HD and share to your Status or Story.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg" className="rounded-full h-12 px-7 font-bold uppercase tracking-wide hover:bg-amber-400 hover:text-slate-950" data-testid="hero-create-card-button">
            <Link to="/create">Create Your Player Card <ArrowRight className="w-4 h-4 ml-1" /></Link></Button>
          <Button asChild size="lg" variant="outline" className="rounded-full h-12 px-7 font-bold uppercase tracking-wide hover:bg-accent hover:text-foreground" data-testid="hero-explore-designs-button">
            <Link to="/explore">Explore Designs</Link></Button>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">No sign-up needed · Photos stay on your device · No official logos</p>
      </div>
      <div className="relative h-[460px] sm:h-[520px]" data-testid="hero-demo-cards">
        <DemoCard i={1} width={230} className="absolute left-0 sm:left-4 top-16 floaty" style={{ "--r": "-8deg", animationDelay: "-2s" }} />
        <DemoCard i={2} width={230} className="absolute right-0 sm:right-4 top-24 floaty" style={{ "--r": "7deg", animationDelay: "-4s" }} />
        <DemoCard i={0} width={260} className="absolute left-1/2 -translate-x-1/2 top-0 z-10 card-tilt" />
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest text-muted-foreground">Fictional demo players</span>
      </div>
    </div>
  </section>
);

const Templates = () => {
  const { templates, sports } = useAppData();
  return (
    <div className="flex gap-5 overflow-x-auto pb-4 -mx-4 px-4 snap-x [scrollbar-width:thin]" data-testid="featured-templates">
      {templates.map((t, i) => {
        const demo = sports.length ? demoFor(i, sports) : null;
        return (
          <Link key={t.id} to={`/create?template=${t.id}`} data-testid={`featured-template-${t.id}`} className="snap-start shrink-0 group">
            <div className="card-tilt">{demo && <ScaledCard width={210} template={t} sport={demo.sport} data={demo.data} photo={demo.photo} />}</div>
            <div className="mt-3 flex items-center justify-between w-[210px]">
              <span className="font-display font-bold uppercase text-lg group-hover:text-amber-500 transition-colors">{t.name}</span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${t.tier === "premium" ? "bg-amber-500 text-slate-950" : "bg-muted text-muted-foreground"}`}>{t.tier}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
};

const STEPS = [
  [Trophy, "Pick your sport", "60+ sports & games, each with its own stats."],
  [Upload, "Upload a photo", "Crop, zoom and position it. It never leaves your phone."],
  [Palette, "Style it", "8 original templates, accent colours, ratings and achievements."],
  [Download, "Download & share", "HD card and 9:16 story PNG, ready for Status or Stories."],
];

const BENEFITS = [
  [Smartphone, "For players", "A pro-looking identity card for your profile, trials and socials — free."],
  [Users, "For teams & clubs", "Matching cards for the whole squad with a shared team theme (Team Pack)."],
  [Shirt, "Team details built-in", "Team names, positions and jersey numbers for team sports only — individual athletes skip them."],
  [Layers, "Tournaments", "Announce line-ups, award MVPs and celebrate rookies with dedicated editions."],
  [Lock, "Private by default", "No public profiles, no photo uploads to the cloud. You decide what you share."],
  [Share2, "Made for sharing", "One tap share on supported phones, with simple steps everywhere else."],
];

export default function Home() {
  const { sports, plans } = useAppData();
  return (
    <div data-testid="home-page">
      <Hero />
      <Section id="sports" eyebrow="Sports & games directory" title="Every sport. Every game." sub="Choose your sport to load the right stats — runs and wickets for cricket, raid points for kabaddi, ACS for Valorant.">
        <SportsGrid sports={sports} linkMode />
      </Section>
      <Section id="templates" eyebrow="Featured templates" title="Eight original designs" sub="Each template has its own composition, typography and finish. Premium designs are marked.">
        <Templates />
      </Section>
      <Section id="how" eyebrow="How it works" title="Card ready in under a minute">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STEPS.map(([Icon, t, d], i) => (
            <div key={t} className="relative rounded-2xl border border-border bg-card p-6 overflow-hidden" data-testid={`how-step-${i + 1}`}>
              <span className="absolute -right-2 -top-6 font-display font-black text-8xl text-foreground/5">{i + 1}</span>
              <Icon className="w-6 h-6 text-amber-500" />
              <p className="font-display font-bold uppercase text-xl mt-4">{t}</p>
              <p className="text-sm text-muted-foreground mt-1">{d}</p>
            </div>
          ))}
        </div>
      </Section>
      <Section id="benefits" eyebrow="Players · Teams · Tournaments" title="Built for the whole squad">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-2xl overflow-hidden border border-border">
          {BENEFITS.map(([Icon, t, d]) => (
            <div key={t} className="bg-background p-7 hover:bg-accent/50 transition-colors">
              <Icon className="w-5 h-5 text-cyan-500" /><p className="font-semibold mt-3">{t}</p><p className="text-sm text-muted-foreground mt-1">{d}</p>
            </div>
          ))}
        </div>
      </Section>
      <Section id="pricing" eyebrow="Pricing" title="Start free. Upgrade when you want." sub="Prices are in INR and come from our live plan settings. Online payments are not enabled yet.">
        <PricingGrid plans={plans} />
      </Section>
      <Section id="faq" eyebrow="FAQ" title="Questions, answered">
        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-12">
          <FaqList />
          <div id="contact" className="rounded-2xl border border-border bg-card p-6">
            <p className="font-display font-bold uppercase text-2xl">Contact & support</p>
            <p className="text-sm text-muted-foreground mt-1 mb-5">Questions, plan help or content reports — send us a note.</p>
            <ContactForm />
          </div>
        </div>
      </Section>
      <section className="container-x pt-24">
        <div className="relative rounded-3xl overflow-hidden border border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-transparent to-cyan-500/10 p-10 sm:p-14">
          <h3 className="font-display font-black uppercase text-4xl sm:text-5xl">Step onto the card.</h3>
          <p className="text-muted-foreground mt-2">Free, fast and made for your phone.</p>
          <Button asChild size="lg" className="mt-6 rounded-full h-12 px-7 font-bold uppercase hover:bg-amber-400 hover:text-slate-950" data-testid="cta-create-card-button"><Link to="/create">Create your card</Link></Button>
        </div>
      </section>
    </div>
  );
}
