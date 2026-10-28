import { Link } from "react-router-dom";

export const Logo = ({ className = "" }) => (
  <Link to="/" data-testid="brand-logo-link" aria-label="FlexoCards home" className={`group shrink-0 inline-flex items-center rounded-xl dark:bg-white dark:px-2 dark:py-1 ${className}`}>
    <img src="/logo-wordmark.png" alt="FlexoCards" className="h-8 sm:h-9 w-auto group-hover:scale-[1.03] transition-transform duration-300" data-testid="brand-logo-wordmark" />
  </Link>
);
