import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Show, UserButton } from "@clerk/react";
import { useTheme } from "next-themes";
import { Menu, Moon, Sun, Shield, LayoutDashboard, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Logo } from "./Logo";
import { useAppData } from "@/context/AppData";

const NAV = [
  { to: "/", label: "Home", id: "home" },
  { to: "/explore", label: "Explore", id: "explore" },
  { to: "/create", label: "Create Card", id: "create" },
  { to: "/pricing", label: "Pricing", id: "pricing" },
  { to: "/blog", label: "Blog", id: "blog" },
  { to: "/help", label: "Help", id: "help" },
];

const ThemeToggle = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const darkMode = resolvedTheme !== "light";
  return (
    <button data-testid="theme-toggle-button" aria-label="Toggle theme" onClick={() => setTheme(darkMode ? "light" : "dark")}
      className="w-10 h-10 grid place-items-center rounded-full border border-border hover:bg-accent hover:text-foreground transition-colors">
      {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
};

const NavItems = ({ onClick, prefix }) =>
  NAV.map((n) => (
    <NavLink key={n.id} to={n.to} end={n.to === "/"} onClick={onClick} data-testid={`${prefix}-nav-${n.id}`}
      className={({ isActive }) => `relative font-poster font-black text-[15px] uppercase tracking-[0.12em] transition-colors hover:text-amber-500 ${isActive ? "text-amber-500 nav-active" : "text-muted-foreground"}`}>
      {n.label}
    </NavLink>
  ));

export default function Header() {
  const [open, setOpen] = useState(false);
  const { me } = useAppData();
  const isStaff = me?.member?.perms?.length > 0;
  return (
    <header className="sticky top-0 z-40 glass border-b border-border">
      <div className="container-x h-16 flex items-center justify-between gap-2 sm:gap-4">
        <Logo />
        <nav className="hidden lg:flex items-center gap-7"><NavItems prefix="desktop" /></nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Show when="signed-in">
            {isStaff && (
              <Link to="/admin" data-testid="header-admin-link" className="hidden sm:inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-3 h-9 rounded-full border border-amber-500/50 text-amber-500 hover:bg-amber-500 hover:text-slate-950 transition-colors">
                <Shield className="w-3.5 h-3.5" /> Admin
              </Link>
            )}
            <Link to="/dashboard" data-testid="header-dashboard-link" aria-label="My cards" className="w-10 h-10 grid place-items-center rounded-full border border-border hover:bg-accent transition-colors">
              <LayoutDashboard className="w-4 h-4" />
            </Link>
            {me?.member?.can_blog && (
              <Link to="/write" data-testid="header-write-link" aria-label="My blog posts" className="hidden sm:grid w-10 h-10 place-items-center rounded-full border border-border hover:bg-accent transition-colors">
                <PenLine className="w-4 h-4" />
              </Link>
            )}
            <UserButton />
          </Show>
          <Show when="signed-out">
            <Link to="/sign-in" data-testid="header-sign-in-link" className="hidden sm:inline-flex text-sm font-semibold px-3 h-9 items-center hover:text-amber-500 transition-colors">Sign in</Link>
          </Show>
          <Link to="/create" data-testid="header-create-card-button" className="press hidden md:inline-flex items-center h-10 px-5 rounded-full bg-amber-400 text-slate-950 font-poster font-black uppercase tracking-wide -rotate-2 hover:bg-amber-300">
            Create Card
          </Link>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button className="lg:hidden w-10 h-10 grid place-items-center rounded-full border border-border" data-testid="mobile-menu-button" aria-label="Open menu"><Menu className="w-5 h-5" /></button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <div className="flex flex-col gap-6 mt-10">
                <NavItems prefix="mobile" onClick={() => setOpen(false)} />
                <Show when="signed-in"><Link to="/dashboard" onClick={() => setOpen(false)} data-testid="mobile-nav-dashboard" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">My Cards</Link></Show>
                <Show when="signed-in"><Link to="/storybook" onClick={() => setOpen(false)} data-testid="mobile-nav-storybook" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">My Storybook</Link></Show>
                {me?.member?.can_blog && <Link to="/write" onClick={() => setOpen(false)} data-testid="mobile-nav-write" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Write a post</Link>}
                {isStaff && <Link to="/admin" onClick={() => setOpen(false)} data-testid="mobile-nav-admin" className="text-sm font-semibold uppercase tracking-wider text-amber-500">Admin Panel</Link>}
                <Link to="/create" onClick={() => setOpen(false)} data-testid="mobile-nav-create-cta" className="inline-flex items-center justify-center h-11 rounded-full bg-amber-500 text-slate-950 font-bold uppercase text-sm">Create Card</Link>
                <Show when="signed-out"><Link to="/sign-in" onClick={() => setOpen(false)} data-testid="mobile-nav-sign-in" className="text-sm font-semibold uppercase tracking-wider">Sign in</Link></Show>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
