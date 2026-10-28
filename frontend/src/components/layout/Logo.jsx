import { Link } from "react-router-dom";

// Light theme shows the full wordmark; dark theme uses the mark + light text so the navy lettering stays readable.
export const Logo = ({ className = "" }) => (
  <Link to="/" data-testid="brand-logo-link" aria-label="FlexoCards home" className={`flex items-center gap-2 group shrink-0 ${className}`}>
    <img src="/logo-wordmark.png" alt="FlexoCards" className="h-9 sm:h-10 w-auto dark:hidden" data-testid="brand-logo-wordmark" />
    <span className="hidden dark:flex items-center gap-1.5">
      <img src="/logo-mark.png" alt="" className="h-9 w-auto group-hover:-rotate-3 transition-transform duration-300" data-testid="brand-logo-mark" />
      <span className="font-display font-black italic text-xl sm:text-2xl tracking-tight uppercase leading-none">
        Flexo<span className="text-amber-400">Cards</span>
      </span>
    </span>
  </Link>
);
