import { UserRound, Star, Crown, ShieldCheck } from "lucide-react";
import { fitSize, toNum, photoFilter } from "@/lib/cardUtils";

const H = "'Barlow Condensed', 'DM Sans', sans-serif";
const M = "'JetBrains Mono', ui-monospace, monospace";
const abs = (s) => ({ position: "absolute", ...s });

const PhotoBg = ({ bg }) => {
  if (!bg || bg.type === "none" || !bg.value) return null;
  if (bg.type === "image") return <img src={bg.value} alt="" draggable={false} crossOrigin="anonymous" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />;
  return <div style={{ position: "absolute", inset: 0, background: bg.value }} />;
};

export const Photo = ({ photo, style, tint = "#94A3B8" }) => {
  const cut = photo?.useCutout && photo?.cutout;
  return (
  <div style={abs({ overflow: "hidden", ...style })}>
    {photo?.src && <PhotoBg bg={photo.bg} />}
    {photo?.src ? (
      <img src={cut ? photo.cutout : photo.src} alt="" draggable={false} crossOrigin="anonymous"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transformOrigin: "center", filter: photoFilter(photo),
          transform: `translate(${photo.x}%, ${photo.y}%) rotate(${photo.rotate || 0}deg) scale(${photo.zoom})`, userSelect: "none", pointerEvents: "none" }} />
    ) : (
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: tint, opacity: 0.35 }}>
        <UserRound style={{ width: "62%", height: "62%" }} strokeWidth={1.1} />
      </div>
    )}
  </div>
  );
};

export const statsOf = (sport, d) =>
  (sport?.stats || []).filter((s) => d.statKeys?.includes(s.key)).slice(0, 6)
    .map((s) => ({ ...s, value: (d.stats?.[s.key] ?? "").toString().slice(0, 9) || "—" }));

const clip1 = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

export const metaLine = (d, sport) =>
  [d.show.position && d.position, d.show.team && d.team, d.show.country && d.country].filter(Boolean).join(" · ") || sport?.name || "";

const Watermark = ({ on, color = "rgba(255,255,255,.55)" }) =>
  on ? <div style={abs({ bottom: 6, left: 0, right: 0, textAlign: "center", fontFamily: M, fontSize: 7, letterSpacing: 2, color })}>MADE WITH RIVALCARD</div> : null;

const Name = ({ d, base, max, style }) => (
  <div style={{ fontFamily: H, fontWeight: 900, textTransform: "uppercase", lineHeight: 0.92, letterSpacing: -0.5, fontSize: fitSize(d.name || "Your Name", base, max), ...clip1, ...style }}>
    {d.name || "Your Name"}
  </div>
);

/* 1. Classic Athlete */
const Classic = ({ d, sport, photo, a, stats, wm }) => (
  <div style={abs({ inset: 0, background: "linear-gradient(135deg,#0F172A 0%,#1E293B 60%,#334155 100%)", border: "3px solid #E2E8F0", borderRadius: 18, overflow: "hidden", color: "#F8FAFC" })}>
    <Photo photo={photo} style={{ left: 12, right: 12, top: 12, height: 300, borderRadius: 10, background: "#0B1220" }} />
    <div style={abs({ left: 12, right: 12, top: 12, height: 300, borderRadius: 10, background: "linear-gradient(180deg,transparent 55%,rgba(15,23,42,.85))" })} />
    {d.show.rating && d.rating && <div style={abs({ left: 22, top: 22, background: a, color: "#fff", borderRadius: 8, padding: "6px 10px", textAlign: "center", boxShadow: "0 6px 18px rgba(0,0,0,.4)" })}>
      <div style={{ fontFamily: H, fontWeight: 900, fontSize: 30, lineHeight: 1 }}>{d.rating.slice(0, 5)}</div><div style={{ fontFamily: M, fontSize: 8, letterSpacing: 2 }}>OVR</div></div>}
    {d.show.jersey && d.jersey && <div style={abs({ right: 24, top: 18, fontFamily: H, fontWeight: 900, fontSize: 54, color: "rgba(255,255,255,.9)", textShadow: "0 4px 16px rgba(0,0,0,.6)" })}>{d.jersey.slice(0, 3)}</div>}
    <div style={abs({ left: -10, right: -10, top: 272, height: 74, transform: "skewY(-5deg)", background: `linear-gradient(90deg,${a} 0%,#1E3A8A 100%)`, boxShadow: "0 8px 20px rgba(0,0,0,.35)" })} />
    <div style={abs({ left: 24, right: 24, top: 282 })}>
      <Name d={d} base={34} max={14} />
      <div style={{ fontFamily: M, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 4, opacity: 0.9, ...clip1 }}>{metaLine(d, sport)}</div>
    </div>
    {d.show.stats && <div style={abs({ left: 16, right: 16, top: 366, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 })}>
      {stats.map((s) => <div key={s.key} style={{ background: "rgba(255,255,255,.07)", borderLeft: `3px solid ${a}`, borderRadius: 6, padding: "6px 8px" }}>
        <div style={{ fontFamily: M, fontWeight: 700, fontSize: 15, ...clip1 }}>{s.value}</div><div style={{ fontSize: 8, letterSpacing: 1, textTransform: "uppercase", opacity: 0.7, ...clip1 }}>{s.label}</div></div>)}
    </div>}
    <div style={abs({ left: 18, right: 18, bottom: 16, display: "flex", justifyContent: "space-between", fontFamily: M, fontSize: 9, letterSpacing: 2, opacity: 0.7, textTransform: "uppercase" })}>
      <span>{sport?.name}</span><span>{d.show.season && d.season}</span></div>
    <Watermark on={wm} />
  </div>
);

/* 2. Black & Gold Elite */
const Elite = ({ d, sport, photo, a, stats, wm }) => (
  <div style={abs({ inset: 0, background: "radial-gradient(circle at 50% 30%,#1C1C1C 0%,#0A0A0A 80%)", border: `2px solid ${a}`, borderRadius: 16, overflow: "hidden", color: "#F5E7B8", boxShadow: `inset 0 0 18px ${a}33` })}>
    <div style={abs({ inset: 10, border: `1px solid ${a}88`, borderRadius: 10 })} />
    <div style={abs({ top: 22, right: 26, fontFamily: M, fontSize: 9, letterSpacing: 4, color: a })}>ELITE</div>
    <Photo photo={photo} tint={a} style={{ left: 60, right: 60, top: 42, height: 250, borderRadius: "130px 130px 10px 10px", border: `2px solid ${a}`, background: "#111" }} />
    {d.show.rating && d.rating && <div style={abs({ left: 22, top: 30, width: 64, height: 64, borderRadius: 999, background: `linear-gradient(135deg,#BF953F,#FCF6BA 45%,#B38728)`, color: "#111", display: "grid", placeItems: "center", textAlign: "center", boxShadow: `0 0 18px ${a}66` })}>
      <div><div style={{ fontFamily: H, fontWeight: 900, fontSize: 26, lineHeight: 1 }}>{d.rating.slice(0, 4)}</div>{d.show.position && d.position && <div style={{ fontFamily: M, fontSize: 7, letterSpacing: 1, maxWidth: 54, ...clip1 }}>{d.position.toUpperCase()}</div>}</div></div>}
    {d.show.jersey && d.jersey && <div style={abs({ right: 24, top: 250, fontFamily: H, fontWeight: 800, fontSize: 26, color: a })}>#{d.jersey.slice(0, 3)}</div>}
    <div style={abs({ left: 24, right: 24, top: 304, textAlign: "center" })}>
      <Name d={d} base={36} max={13} style={{ color: "#F3D27A", textShadow: `0 0 14px ${a}55` }} />
      <div style={{ fontFamily: M, fontSize: 9, letterSpacing: 2, textTransform: "uppercase", marginTop: 6, color: "#CBB57A", ...clip1 }}>{metaLine(d, sport)}</div>
    </div>
    <div style={abs({ left: 40, right: 40, top: 362, height: 1, background: `linear-gradient(90deg,transparent,${a},transparent)` })} />
    {d.show.stats && <div style={abs({ left: 26, right: 26, top: 372, display: "grid", gridTemplateColumns: "repeat(3,1fr)", rowGap: 8 })}>
      {stats.map((s) => <div key={s.key} style={{ textAlign: "center" }}>
        <div style={{ fontFamily: H, fontWeight: 800, fontSize: 22, color: "#FFE58A", lineHeight: 1, ...clip1 }}>{s.value}</div>
        <div style={{ fontFamily: M, fontSize: 7, letterSpacing: 1.5, textTransform: "uppercase", color: "#A89462", marginTop: 2, ...clip1 }}>{s.label}</div></div>)}
    </div>}
    <div style={abs({ left: 0, right: 0, bottom: 18, textAlign: "center", fontFamily: M, fontSize: 8, letterSpacing: 3, color: "#8F7B4A", textTransform: "uppercase" })}>{sport?.name} {d.show.season && d.season ? `· ${d.season}` : ""}</div>
    <Watermark on={wm} color="rgba(212,175,55,.6)" />
  </div>
);

/* 3. Legendary Edition */
const Legendary = ({ d, sport, photo, a, stats, wm }) => (
  <div style={abs({ inset: 0, background: "radial-gradient(circle at center,#881337 0%,#4C0519 60%,#0F172A 100%)", border: "3px solid #E11D48", borderRadius: 18, overflow: "hidden", color: "#FFF1F2" })}>
    <div style={abs({ inset: 0, background: `radial-gradient(circle at 50% 36%,${a}59 0%,transparent 58%)` })} />
    <Photo photo={photo} tint="#FDA4AF" style={{ left: 0, right: 0, top: 0, height: 360 }} />
    <div style={abs({ left: 0, right: 0, top: 200, height: 170, background: "linear-gradient(180deg,transparent,#4C0519 85%)" })} />
    <div style={abs({ top: 14, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 3 })}>{[0, 1, 2, 3, 4].map((i) => <Star key={i} fill={a} color={a} style={{ width: 14, height: 14 }} />)}</div>
    <div style={abs({ left: -66, top: 170, transform: "rotate(-90deg)", fontFamily: H, fontWeight: 900, fontSize: 22, letterSpacing: 8, color: a, opacity: 0.9 })}>LEGENDARY</div>
    {d.show.rating && d.rating && <div style={abs({ right: 18, top: 36, width: 60, height: 60, borderRadius: 999, background: "#E11D48", border: `2px solid ${a}`, display: "grid", placeItems: "center", fontFamily: H, fontWeight: 900, fontSize: 24, color: "#FEF08A" })}>{d.rating.slice(0, 4)}</div>}
    <div style={abs({ left: 22, right: 22, top: 318 })}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        {d.show.jersey && d.jersey && <span style={{ fontFamily: H, fontWeight: 900, fontSize: 26, color: a }}>{d.jersey.slice(0, 3)}</span>}
        <Name d={d} base={38} max={13} style={{ flex: 1 }} /></div>
      <div style={{ fontFamily: M, fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 4, color: "#FECDD3", ...clip1 }}>{metaLine(d, sport)}</div>
      {d.show.achievements && d.achievements?.[0] && <div style={{ fontSize: 10, marginTop: 4, color: a, ...clip1 }}>★ {d.achievements[0]}</div>}
    </div>
    {d.show.stats && <div style={abs({ left: 16, right: 16, top: 404, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 })}>
      {stats.map((s) => <div key={s.key} style={{ background: "rgba(244,63,94,.14)", border: "1px solid rgba(251,191,36,.25)", borderRadius: 999, padding: "4px 8px", display: "flex", justifyContent: "space-between", gap: 4 }}>
        <span style={{ fontSize: 7, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.8, alignSelf: "center", ...clip1 }}>{s.label}</span><span style={{ fontFamily: M, fontWeight: 700, fontSize: 11, color: "#FDE68A" }}>{s.value}</span></div>)}
    </div>}
    <Watermark on={wm} />
  </div>
);

/* 4. Neon Energy */
const Neon = ({ d, sport, photo, a, stats, wm }) => {
  const max = Math.max(1, ...stats.map((s) => toNum(s.value)));
  return (
    <div style={abs({ inset: 0, background: "linear-gradient(180deg,#050515 0%,#0D1127 100%)", border: `2px solid ${a}`, borderRadius: 14, overflow: "hidden", color: "#E0FBFF", boxShadow: `inset 0 0 24px ${a}40` })}>
      <div style={abs({ inset: 0, backgroundImage: `repeating-linear-gradient(90deg,${a}0D 0 1px,transparent 1px 20px),repeating-linear-gradient(0deg,${a}0D 0 1px,transparent 1px 20px)` })} />
      <Photo photo={photo} tint={a} style={{ left: 0, top: 0, width: 238, height: 350, clipPath: "polygon(0 0,100% 0,82% 100%,0 100%)", background: "#0A0F24" }} />
      <div style={abs({ left: 0, top: 0, width: 238, height: 350, clipPath: "polygon(0 0,100% 0,82% 100%,0 100%)", background: `linear-gradient(180deg,transparent 60%,#050515)` })} />
      <div style={abs({ left: 204, top: 0, width: 4, height: 350, background: "#FF007F", transform: "skewX(-9deg)", boxShadow: "0 0 14px #FF007F" })} />
      {d.show.rating && d.rating && <div style={abs({ left: 14, top: 14, background: a, color: "#000", fontFamily: H, fontWeight: 900, fontSize: 24, padding: "2px 10px", boxShadow: `0 0 15px ${a}` })}>{d.rating.slice(0, 5)}</div>}
      {d.show.stats && <div style={abs({ left: 226, right: 12, top: 16, display: "flex", flexDirection: "column", gap: 9 })}>
        {stats.map((s) => <div key={s.key}>
          <div style={{ fontFamily: M, fontWeight: 700, fontSize: 15, color: "#fff", textShadow: `0 0 8px ${a}`, ...clip1 }}>{s.value}</div>
          <div style={{ height: 3, background: "rgba(255,255,255,.08)", margin: "2px 0" }}><div style={{ height: 3, width: `${Math.max(12, (toNum(s.value) / max) * 100)}%`, background: a, boxShadow: `0 0 6px ${a}` }} /></div>
          <div style={{ fontSize: 7, letterSpacing: 1, textTransform: "uppercase", opacity: 0.7, ...clip1 }}>{s.label}</div></div>)}
      </div>}
      <div style={abs({ left: 18, right: 18, top: 362 })}>
        {d.show.nickname && d.nickname && <div style={{ fontFamily: M, fontSize: 10, letterSpacing: 3, color: "#FF4FA3", textTransform: "uppercase", ...clip1 }}>// {d.nickname}</div>}
        <Name d={d} base={44} max={12} style={{ fontStyle: "italic", color: "#fff", textShadow: `0 0 18px ${a}AA` }} />
        <div style={{ fontFamily: M, fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 6, color: a, ...clip1 }}>{metaLine(d, sport)}</div>
      </div>
      <div style={abs({ left: 18, right: 18, bottom: 18, display: "flex", justifyContent: "space-between", fontFamily: M, fontSize: 9, letterSpacing: 2, color: "#7DD3FC", textTransform: "uppercase" })}>
        <span>{sport?.name}</span><span>{d.show.jersey && d.jersey ? `#${d.jersey.slice(0, 3)}` : d.show.season && d.season}</span></div>
      <Watermark on={wm} />
    </div>
  );
};

/* 5. Rookie Card */
const Rookie = ({ d, sport, photo, a, stats, wm }) => (
  <div style={abs({ inset: 0, background: "linear-gradient(135deg,#1E293B 0%,#0F172A 100%)", border: "5px double #CBD5E1", borderRadius: 12, overflow: "hidden", color: "#F1F5F9" })}>
    <div style={abs({ left: 16, right: 16, top: 16, height: 286, background: "#F1F5F9", padding: 7, borderRadius: 4, boxShadow: "0 10px 24px rgba(0,0,0,.45)" })}>
      <Photo photo={photo} style={{ inset: 7, background: "#CBD5E1" }} tint="#475569" />
    </div>
    <div style={abs({ right: 10, top: 8, width: 56, height: 64, background: `linear-gradient(160deg,#FDE68A,${a})`, clipPath: "polygon(50% 0,100% 18%,100% 70%,50% 100%,0 70%,0 18%)", display: "grid", placeItems: "center", color: "#1F2937", fontFamily: H, fontWeight: 900, fontSize: 24 })}>RC</div>
    <div style={abs({ left: 30, top: 284, background: a, color: "#0F172A", fontFamily: H, fontWeight: 800, fontSize: 13, letterSpacing: 2, padding: "3px 12px", transform: "rotate(-2deg)", boxShadow: "0 4px 10px rgba(0,0,0,.4)" })}>
      ROOKIE {d.show.season && d.season ? `· ${d.season}` : ""}</div>
    <div style={abs({ left: 22, right: 22, top: 318 })}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Name d={d} base={32} max={15} style={{ flex: 1 }} />
        {d.show.rating && d.rating && <span style={{ fontFamily: H, fontWeight: 900, fontSize: 20, background: a, color: "#0F172A", borderRadius: 4, padding: "0 7px" }}>{d.rating.slice(0, 4)}</span>}
      </div>
      <div style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "#94A3B8", marginTop: 3, ...clip1 }}>
        {[d.show.jersey && d.jersey && `#${d.jersey.slice(0, 3)}`, metaLine(d, sport)].filter(Boolean).join("  ")}</div>
    </div>
    {d.show.stats && <div style={abs({ left: 22, right: 22, top: 372, display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 16 })}>
      {stats.map((s) => <div key={s.key} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dashed rgba(203,213,225,.25)", padding: "4px 0", gap: 6 }}>
        <span style={{ fontSize: 9, textTransform: "uppercase", color: "#94A3B8", ...clip1 }}>{s.label}</span><span style={{ fontFamily: M, fontWeight: 700, fontSize: 12, color: a }}>{s.value}</span></div>)}
    </div>}
    <div style={abs({ left: 22, right: 22, bottom: 14, fontFamily: M, fontSize: 8, letterSpacing: 2, color: "#64748B", textTransform: "uppercase" })}>{sport?.name} · first edition</div>
    <Watermark on={wm} />
  </div>
);

/* 6. MVP Edition */
const MVP = ({ d, sport, photo, a, stats, wm }) => (
  <div style={abs({ inset: 0, background: "linear-gradient(160deg,#27272A 0%,#18181B 50%,#09090B 100%)", border: `3px solid ${a}`, borderRadius: 16, overflow: "hidden", color: "#FAFAFA", boxShadow: `inset 0 0 0 6px #18181B, inset 0 0 0 7px #A1A1AA55` })}>
    <div style={abs({ left: 0, right: 0, top: 6, textAlign: "center", fontFamily: H, fontWeight: 900, fontSize: 150, lineHeight: 1, color: "transparent", WebkitTextStroke: `1.5px ${a}55`, letterSpacing: -4 })}>MVP</div>
    <div style={abs({ left: "50%", top: -60, width: 420, height: 420, marginLeft: -210, background: `radial-gradient(circle,${a}38 0%,transparent 60%)` })} />
    <Photo photo={photo} tint={a} style={{ left: 22, right: 22, top: 40, height: 290 }} />
    <div style={abs({ left: 22, right: 22, top: 230, height: 100, background: "linear-gradient(180deg,transparent,#18181B)" })} />
    <Crown style={abs({ right: 18, top: 16, width: 34, height: 34, color: a })} strokeWidth={1.6} />
    {d.show.rating && d.rating && <div style={abs({ left: 0, top: 40, background: `linear-gradient(90deg,#FACC15,${a})`, color: "#111", padding: "6px 14px 6px 18px", clipPath: "polygon(0 0,100% 0,88% 100%,0 100%)", fontFamily: H, fontWeight: 900, fontSize: 24 })}>{d.rating.slice(0, 5)}</div>}
    <div style={abs({ left: 22, right: 22, top: 322, textAlign: "center" })}>
      <div style={{ fontFamily: M, fontSize: 9, letterSpacing: 4, color: a }}>MOST VALUABLE PLAYER</div>
      <Name d={d} base={38} max={13} style={{ marginTop: 4 }} />
      <div style={{ fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: "#A1A1AA", marginTop: 4, ...clip1 }}>
        {[d.show.jersey && d.jersey && `#${d.jersey.slice(0, 3)}`, metaLine(d, sport)].filter(Boolean).join(" · ")}</div>
    </div>
    {d.show.stats && <div style={abs({ left: 22, right: 22, top: 404, display: "grid", gridTemplateColumns: "repeat(3,1fr)" })}>
      {stats.map((s, i) => <div key={s.key} style={{ textAlign: "center", padding: "4px 2px", borderLeft: i % 3 ? `1px solid ${a}44` : "none" }}>
        <div style={{ fontFamily: M, fontWeight: 700, fontSize: 14, color: "#FDE68A", ...clip1 }}>{s.value}</div>
        <div style={{ fontSize: 7, letterSpacing: 1, textTransform: "uppercase", color: "#A1A1AA", ...clip1 }}>{s.label}</div></div>)}
    </div>}
    <Watermark on={wm} />
  </div>
);

/* 7. Minimal Professional */
const Minimal = ({ d, sport, photo, a, stats, wm }) => (
  <div style={abs({ inset: 0, background: "#090D16", border: "1px solid rgba(255,255,255,.15)", borderRadius: 10, overflow: "hidden", color: "#E2E8F0" })}>
    <div style={abs({ inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px)", backgroundSize: "30px 30px" })} />
    <Photo photo={photo} style={{ right: 16, top: 16, width: 196, height: 252, borderRadius: 4, background: "#111827" }} />
    <div style={abs({ left: 18, top: 18, width: 116 })}>
      <div style={{ fontFamily: M, fontSize: 8, letterSpacing: 2, color: "#64748B" }}>{(sport?.name || "").toUpperCase()}</div>
      {d.show.rating && d.rating && <div style={{ fontFamily: M, fontWeight: 700, fontSize: 40, lineHeight: 1.1, marginTop: 10, color: "#fff", ...clip1 }}>{d.rating.slice(0, 5)}</div>}
      {d.show.position && d.position && <div style={{ fontSize: 11, marginTop: 8, color: a, ...clip1 }}>{d.position}</div>}
      {d.show.jersey && d.jersey && <div style={{ fontFamily: M, fontSize: 22, marginTop: 10, color: "#CBD5E1" }}>#{d.jersey.slice(0, 3)}</div>}
      {d.show.season && d.season && <div style={{ fontFamily: M, fontSize: 9, marginTop: 14, color: "#64748B" }}>SEASON {d.season.slice(0, 10)}</div>}
      {d.show.country && d.country && <div style={{ fontFamily: M, fontSize: 9, marginTop: 4, color: "#64748B", ...clip1 }}>{d.country.toUpperCase()}</div>}
    </div>
    <div style={abs({ left: 18, right: 18, top: 282 })}>
      <Name d={d} base={34} max={16} style={{ fontWeight: 800, color: "#fff" }} />
      <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 4, ...clip1 }}>{[d.show.team && d.team, d.show.tagline && d.tagline].filter(Boolean).join(" — ") || " "}</div>
    </div>
    <div style={abs({ left: 18, right: 18, top: 336, height: 1, background: "rgba(255,255,255,.15)" })} />
    {d.show.stats && <div style={abs({ left: 18, right: 18, top: 344 })}>
      {stats.map((s) => <div key={s.key} style={{ display: "flex", alignItems: "baseline", gap: 6, padding: "3px 0", fontFamily: M }}>
        <span style={{ fontSize: 9, letterSpacing: 1, textTransform: "uppercase", color: "#94A3B8", whiteSpace: "nowrap" }}>{s.label}</span>
        <span style={{ flex: 1, borderBottom: "1px dotted rgba(255,255,255,.18)" }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{s.value}</span></div>)}
    </div>}
    <Watermark on={wm} />
  </div>
);

/* 8. Esports Pro */
const HEX = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cg fill='none' stroke='%23A855F7' stroke-opacity='.18'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9z'/%3E%3C/g%3E%3C/svg%3E\")";
const Bracket = ({ s }) => <div style={abs({ width: 18, height: 18, borderColor: "#C084FC", borderStyle: "solid", borderWidth: 0, ...s })} />;
const Esports = ({ d, sport, photo, a, stats, wm }) => {
  const max = Math.max(1, ...stats.map((s) => toNum(s.value)));
  const tag = d.nickname || d.name || "GAMERTAG";
  return (
    <div style={abs({ inset: 0, background: "radial-gradient(circle at 50% 20%,#2E1065 0%,#0F172A 70%,#020617 100%)", border: "2px solid #A855F7", borderRadius: 14, overflow: "hidden", color: "#F5F3FF", boxShadow: "inset 0 0 26px rgba(168,85,247,.35)" })}>
      <div style={abs({ inset: 0, backgroundImage: HEX })} />
      <Bracket s={{ left: 10, top: 10, borderLeftWidth: 2, borderTopWidth: 2 }} /><Bracket s={{ right: 10, top: 10, borderRightWidth: 2, borderTopWidth: 2 }} />
      <Bracket s={{ left: 10, bottom: 10, borderLeftWidth: 2, borderBottomWidth: 2 }} /><Bracket s={{ right: 10, bottom: 10, borderRightWidth: 2, borderBottomWidth: 2 }} />
      <div style={abs({ left: 50, right: 50, top: 28, height: 226, clipPath: "polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)", background: a })} />
      <Photo photo={photo} tint="#C084FC" style={{ left: 53, right: 53, top: 31, height: 220, clipPath: "polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)", background: "#1E1B4B" }} />
      <div style={abs({ left: 22, top: 24, fontFamily: M, fontSize: 8, letterSpacing: 2, color: "#C4B5FD" })}>{(sport?.name || "").toUpperCase()}</div>
      {d.show.rating && d.rating && <div style={abs({ right: 22, top: 22, background: "#7C3AED", border: "1px solid #C084FC", boxShadow: "0 0 12px #A855F7", fontFamily: M, fontWeight: 700, fontSize: 10, padding: "3px 8px", letterSpacing: 1 })}>{d.rating.slice(0, 8)}</div>}
      <div style={abs({ left: 22, right: 22, top: 262, textAlign: "center" })}>
        <div style={{ fontFamily: H, fontWeight: 900, fontSize: fitSize(tag, 42, 11), lineHeight: 1, textTransform: "uppercase", letterSpacing: 1, color: "#fff", textShadow: `0 0 16px ${a}`, ...clip1 }}>{tag}</div>
        <div style={{ fontFamily: M, fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "#C4B5FD", marginTop: 4, ...clip1 }}>
          {[d.nickname && d.name, d.show.position && d.position, d.show.team && d.team].filter(Boolean).join(" · ") || sport?.name}</div>
      </div>
      {d.show.stats && <div style={abs({ left: 22, right: 22, top: 330, display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 14, rowGap: 8 })}>
        {stats.map((s) => <div key={s.key}>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: M, gap: 4 }}>
            <span style={{ fontSize: 8, color: "#A78BFA", textTransform: "uppercase", ...clip1 }}>{s.label}</span><span style={{ fontSize: 12, fontWeight: 700 }}>{s.value}</span></div>
          <div style={{ height: 4, background: "rgba(168,85,247,.15)", marginTop: 3, clipPath: "polygon(0 0,100% 0,97% 100%,0 100%)" }}>
            <div style={{ height: 4, width: `${Math.max(14, (toNum(s.value) / max) * 100)}%`, background: `linear-gradient(90deg,#7C3AED,${a})` }} /></div></div>)}
      </div>}
      {d.show.tagline && d.tagline && <div style={abs({ left: 22, right: 22, bottom: 24, textAlign: "center", fontSize: 10, fontStyle: "italic", color: "#DDD6FE", ...clip1 })}>"{d.tagline}"</div>}
      <Watermark on={wm} />
    </div>
  );
};

export const LAYOUTS = {
  classic_athlete: Classic, black_gold_elite: Elite, legendary_edition: Legendary, neon_energy: Neon,
  rookie_card: Rookie, mvp_edition: MVP, minimal_professional: Minimal, esports_pro: Esports,
};

export const STORY_BG = {
  classic_athlete: "linear-gradient(180deg,#1E3A8A,#0F172A 60%)", black_gold_elite: "radial-gradient(circle at 50% 40%,#2A2416,#050505 70%)",
  legendary_edition: "radial-gradient(circle at 50% 45%,#9F1239,#2A0410 70%)", neon_energy: "linear-gradient(180deg,#0D1127,#050515)",
  rookie_card: "linear-gradient(180deg,#334155,#0F172A)", mvp_edition: "radial-gradient(circle at 50% 30%,#3F3F46,#09090B 70%)",
  minimal_professional: "#05080F", esports_pro: "radial-gradient(circle at 50% 30%,#3B0764,#020617 70%)",
};

export const VerifiedNote = () => (
  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><ShieldCheck className="w-3 h-3" /> Self-reported stats</span>
);
