import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { Logo } from "./Logo";
import { SocialIcons } from "./Social";
import { API } from "@/lib/api";

export const COMPANY = "Buddy Innovations and Technologies Private Limited";

const cols = [
  { title: "Product", links: [["Create Card", "/create"], ["Explore Designs", "/explore"], ["Pricing", "/pricing"], ["Blog", "/blog"]] },
  { title: "Support", links: [["Help & FAQ", "/help"], ["Contact", "/help#contact"], ["My Cards", "/dashboard"]] },
  { title: "Legal", links: [["Privacy Policy", "/privacy"], ["Terms of Use", "/terms"]] },
];

export default function Footer() {
  const [social, setSocial] = useState({});
  useEffect(() => { axios.get(`${API}/site/social`).then((r) => setSocial(r.data)).catch(() => {}); }, []);
  return (
    <footer className="border-t border-border mt-24 overflow-hidden">
      <p className="extrude font-poster font-black uppercase text-[21vw] lg:text-[230px] leading-[0.8] text-center select-none pt-10 -mb-4" aria-hidden data-testid="footer-wordmark">FlexoCards</p>
      <div className="container-x py-14 grid gap-10 grid-cols-2 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-3 max-w-xs col-span-2 md:col-span-1">
          <Logo />
          <p className="text-sm text-muted-foreground">Your Game. Your Identity. Your Card. Original player cards for every sport and game.</p>
          <SocialIcons links={social} className="pt-1" />
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
        <span data-testid="footer-company">© {new Date().getFullYear()} FlexoCards, a product of {COMPANY}. All card artwork is original. Not affiliated with any league, team or game publisher.</span>
        <span>Stats on cards are user-submitted and not verified.</span>
      </div>
    </footer>
  );
}
