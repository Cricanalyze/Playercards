import { Link } from "react-router-dom";

export const Logo = ({ className = "" }) => (
  <Link to="/" data-testid="brand-logo-link" className={`flex items-center gap-2 group ${className}`}>
    <span className="relative grid place-items-center w-9 h-11 rounded-md bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 shadow-[0_0_18px_rgba(212,175,55,.35)] rotate-[-6deg] group-hover:rotate-0 transition-transform duration-300">
      <span className="font-display font-black text-slate-950 text-lg leading-none">R</span>
      <span className="absolute inset-[3px] rounded-[4px] border border-slate-950/30" />
    </span>
    <span className="font-display font-black text-xl tracking-tight uppercase">
      Rival<span className="text-amber-500">Card</span>
    </span>
  </Link>
);
