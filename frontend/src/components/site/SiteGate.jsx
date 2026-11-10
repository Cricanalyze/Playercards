import { useEffect, useState } from "react";
import axios from "axios";
import { Link, useLocation } from "react-router-dom";
import { Rocket, Wrench, Eye, CalendarClock } from "lucide-react";
import { API } from "@/lib/api";
import { useAppData } from "@/context/AppData";
import { useSiteStatus } from "@/context/SiteStatus";
import { SocialIcons } from "@/components/layout/Social";
import { Countdown } from "./Countdown";
import { SiteSkeleton } from "@/components/Skeletons";

const OPEN_PATHS = ["/sign-in", "/sign-up", "/admin"];
const fmt = (s) => new Date(s).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const dur = (m) => (m % 60 === 0 ? `${m / 60} hour${m === 60 ? "" : "s"}` : m > 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} minutes`);

function GatePage({ kind, status, onDone }) {
  const [social, setSocial] = useState({});
  useEffect(() => { axios.get(`${API}/site/social`).then((r) => setSocial(r.data)).catch(() => {}); }, []);
  const cs = kind === "coming_soon";
  const info = cs ? status.coming_soon : status.maintenance;
  const target = cs ? info.launch_at : info.end_at;
  const Icon = cs ? Rocket : Wrench;
  return (
    <div className="dark fixed inset-0 z-[100] overflow-y-auto bg-[#060b1a] text-white" data-testid={cs ? "coming-soon-page" : "maintenance-page"}>
      <div className="absolute inset-0 stage-grid opacity-40 pointer-events-none" />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
      <div className="relative min-h-full flex flex-col items-center justify-center px-6 py-16 text-center">
        <img src="/logo-wordmark.png" alt="FlexoCards" className="h-12 sm:h-14 w-auto rounded-xl bg-white px-3 py-1.5" data-testid="gate-logo" />
        <span className="mt-10 inline-flex items-center gap-2 px-4 h-8 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-400 text-xs font-bold uppercase tracking-[0.2em]">
          <Icon className="w-4 h-4" />{cs ? "Coming soon" : "Scheduled maintenance"}
        </span>
        <h1 className="mt-6 font-display font-black uppercase text-4xl sm:text-6xl lg:text-7xl leading-[0.95] tracking-tight max-w-4xl" data-testid="gate-title">
          {cs ? info.title || "Something big is coming" : "We'll be right back"}
        </h1>
        <p className="mt-5 text-slate-300 max-w-xl text-sm sm:text-base" data-testid="gate-message">{info.message}</p>
        {target && (
          <div className="mt-10">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400 mb-4">{cs ? "Launching in" : "Back in about"}</p>
            <Countdown target={target} onDone={onDone} compact={!cs} />
            <p className="mt-5 text-xs text-slate-500" data-testid="gate-target-time">{cs ? "Launch" : "Expected back"}: {fmt(target)}</p>
          </div>
        )}
        {!cs && <p className="mt-3 text-xs text-slate-500">Planned downtime: {dur(info.duration_min)}</p>}
        <SocialIcons links={social} className="mt-10 justify-center" />
        <p className="mt-12 text-[11px] text-slate-500">© {new Date().getFullYear()} FlexoCards · Buddy Innovations and Technologies Private Limited</p>
        <Link to="/sign-in" className="mt-2 text-[11px] text-slate-600 hover:text-amber-400" data-testid="gate-admin-sign-in">Team sign in</Link>
      </div>
    </div>
  );
}

const Bar = ({ children, tone = "amber", testId }) => (
  <div data-testid={testId} className={`relative z-50 text-xs sm:text-sm px-4 py-2 text-center flex flex-wrap items-center justify-center gap-x-3 gap-y-1 ${tone === "amber" ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-100"}`}>{children}</div>
);

export default function SiteGate({ children }) {
  const { status, refresh } = useSiteStatus();
  const { me, isSignedIn } = useAppData();
  const { pathname, search } = useLocation();
  const preview = new URLSearchParams(search).get("preview");
  const staff = !!me?.member?.role && me.member.role !== "user";
  const done = () => { refresh(); setTimeout(() => window.location.reload(), 1500); };
  if (!status) return <SiteSkeleton />;
  const open = OPEN_PATHS.some((p) => pathname.startsWith(p));
  if (staff && (preview === "coming_soon" || preview === "maintenance")) return <GatePage kind={preview} status={status} onDone={() => {}} />;
  if (status.blocked && !open && !staff) {
    if (isSignedIn && !me) return <SiteSkeleton />;
    return <GatePage kind={status.state} status={status} onDone={done} />;
  }
  return (
    <>
      {status.blocked && staff && (
        <Bar tone="slate" testId="gate-staff-banner">
          <Eye className="w-4 h-4" />Visitors see the {status.state === "coming_soon" ? "Coming soon" : "Maintenance"} page. You can see the site because you're an admin.
          <Link to={`/?preview=${status.state}`} className="underline font-semibold" data-testid="gate-staff-preview-link">Preview it</Link>
          <Link to="/admin/settings" className="underline font-semibold">Change</Link>
        </Bar>
      )}
      {status.state === "maintenance_scheduled" && (
        <Bar testId="maintenance-scheduled-banner">
          <CalendarClock className="w-4 h-4" />Scheduled maintenance on {fmt(status.maintenance.start_at)} for about {dur(status.maintenance.duration_min)}. The site will be unavailable during this time.
        </Bar>
      )}
      {children}
    </>
  );
}
