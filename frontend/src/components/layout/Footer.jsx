import { Link } from "react-router-dom";
import { Logo } from "./Logo";

const cols = [
  { title: "Product", links: [["Create Card", "/create"], ["Explore Designs", "/explore"], ["Pricing", "/pricing"]] },
  { title: "Support", links: [["Help & FAQ", "/help"], ["Contact", "/help#contact"], ["My Cards", "/dashboard"]] },
  { title: "Legal", links: [["Privacy Policy", "/privacy"], ["Terms of Use", "/terms"]] },
];

export default function Footer() {
  return (
    <footer className="border-t border-border mt-24">
      <div className="container-x py-14 grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-3 max-w-xs">
          <Logo />
          <p className="text-sm text-muted-foreground">Your Game. Your Identity. Your Card. Original player cards for every sport and game.</p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <p className="eyebrow mb-4">{c.title}</p>
            <ul className="space-y-2">
              {c.links.map(([l, to]) => (
                <li key={l}><Link to={to} data-testid={`footer-link-${l.toLowerCase().replace(/[^a-z]+/g, "-")}`} className="text-sm text-muted-foreground hover:text-amber-500 transition-colors">{l}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="container-x pb-8 text-xs text-muted-foreground flex flex-col sm:flex-row gap-2 justify-between">
        <span>© {new Date().getFullYear()} RivalCard. All card artwork is original. Not affiliated with any league, team or game publisher.</span>
        <span>Stats on cards are user-submitted and not verified.</span>
      </div>
    </footer>
  );
}
