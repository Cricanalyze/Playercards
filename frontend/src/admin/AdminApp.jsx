import { createContext, useContext, useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, Link } from "react-router-dom";
import { Show, UserButton } from "@clerk/react";
import { BarChart3, Users, CreditCard, Package, Trophy, LayoutTemplate, ShieldCheck, ScrollText, Flag, ArrowLeft } from "lucide-react";
import { useApi, errMsg } from "@/lib/api";
import { Logo } from "@/components/layout/Logo";
import Overview from "./Overview";
import UsersPage from "./Users";
import Subscriptions from "./Subscriptions";
import Plans from "./Plans";
import Sports from "./Sports";
import Templates from "./Templates";
import Team from "./Team";
import Audit from "./Audit";
import Reports from "./Reports";

const MetaCtx = createContext(null);
export const useMeta = () => useContext(MetaCtx);

const NAV = [
  ["", "Overview", BarChart3, "analytics.view", Overview],
  ["users", "Users", Users, "users.view", UsersPage],
  ["subscriptions", "Subscriptions", CreditCard, "subscriptions.view", Subscriptions],
  ["plans", "Plans", Package, "subscriptions.view", Plans],
  ["sports", "Sports", Trophy, "sports.manage", Sports],
  ["templates", "Templates", LayoutTemplate, "templates.manage", Templates],
  ["team", "Admins & Invites", ShieldCheck, "admins.manage", Team],
  ["audit", "Audit log", ScrollText, "audit.view", Audit],
  ["reports", "Reports", Flag, "moderation.manage", Reports],
];

export const PageHead = ({ title, sub, children }) => (
  <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
    <div><h1 className="font-display font-black uppercase text-3xl sm:text-4xl">{title}</h1>{sub && <p className="text-sm text-muted-foreground mt-1">{sub}</p>}</div>
    <div className="flex flex-wrap gap-2">{children}</div>
  </div>
);

function Shell() {
  const api = useApi();
  const [meta, setMeta] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { api("get", "/admin/meta").then(setMeta).catch((e) => setErr(errMsg(e))); }, [api]);
  if (err) return (
    <div className="min-h-screen grid place-items-center p-6 text-center" data-testid="admin-access-denied">
      <div><ShieldCheck className="w-10 h-10 mx-auto text-destructive" /><h1 className="font-display font-black uppercase text-3xl mt-3">Access denied</h1>
        <p className="text-muted-foreground mt-2">{err}</p><Link to="/" className="text-amber-500 hover:underline mt-4 inline-block">Back to home</Link></div>
    </div>
  );
  if (!meta) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading admin…</div>;
  const items = NAV.filter((n) => meta.my_perms.includes(n[3]));
  return (
    <MetaCtx.Provider value={meta}>
      <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]" data-testid="admin-shell">
        <aside className="border-b lg:border-b-0 lg:border-r border-border lg:min-h-screen lg:sticky lg:top-0 lg:h-screen bg-card/40">
          <div className="p-4 flex items-center justify-between lg:block">
            <Logo />
            <p className="hidden lg:block text-[10px] uppercase tracking-widest text-amber-500 mt-2" data-testid="admin-my-role">{meta.my_role.replace("_", " ")}</p>
            <div className="lg:hidden"><UserButton /></div>
          </div>
          <nav className="flex lg:flex-col gap-1 overflow-x-auto px-2 pb-2 lg:pb-0 [scrollbar-width:none]">
            {items.map(([path, label, Icon]) => (
              <NavLink key={path} end to={`/admin/${path}`} data-testid={`admin-nav-${path || "overview"}`}
                className={({ isActive }) => `shrink-0 flex items-center gap-2 px-3 h-10 rounded-lg text-sm font-semibold transition-colors ${isActive ? "bg-amber-500 text-slate-950" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>
                <Icon className="w-4 h-4" />{label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden lg:flex items-center justify-between p-4 absolute bottom-0 w-[240px]">
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1" data-testid="admin-back-to-site"><ArrowLeft className="w-3 h-3" />Back to site</Link>
            <UserButton />
          </div>
        </aside>
        <main className="p-4 sm:p-8 min-w-0">
          <Routes>
            {items.map(([path, , , , Comp]) => <Route key={path} path={path || undefined} index={!path} element={<Comp />} />)}
            <Route path="*" element={items.length ? <Navigate to={`/admin/${items[0][0]}`} replace /> : <p>No admin permissions.</p>} />
          </Routes>
        </main>
      </div>
    </MetaCtx.Provider>
  );
}

export default function AdminApp() {
  return (<><Show when="signed-in"><Shell /></Show><Show when="signed-out"><Navigate to="/sign-in" replace /></Show></>);
}
