p='/app/frontend/src/components/card/layouts.jsx'; s=open(p).read()
s=s.replace('import { UserRound, Star, Crown, ShieldCheck } from "lucide-react";','import { UserRound, Star, Crown, ShieldCheck, Trophy } from "lucide-react";',1)
a='''export const LAYOUTS = {'''
layout='''/* 9. Match Day Award (Player of the Match / Man of the Series) */
const MatchAward = ({ d, sport, photo, a, stats, wm, t }) => {
  const series = t?.badge === "MOTS";
  const title = (d.award || (series ? "Man of the Series" : "Player of the Match")).toUpperCase();
  const perf = d.performance || (series ? "412 runs · 3 50s" : "112* (68)");
  const match = [d.match || (series ? "T20 Series 2026" : "vs Opponent XI"), d.venue, d.season].filter(Boolean).join("  ·  ");
  return (
    <div style={abs({ inset: 0, borderRadius: 18, overflow: "hidden", color: "#fff", border: `2px solid ${a}`,
      background: `radial-gradient(circle at 50% 34%, ${a}40 0%, #0b1a3a 46%, #050b1d 100%)` })}>
      <div style={abs({ inset: -120, background: `repeating-conic-gradient(from 0deg at 50% 45%, ${a}1f 0deg 6deg, transparent 6deg 18deg)`, opacity: 0.55 })} />
      <div style={abs({ left: 0, right: 0, top: 14, display: "flex", justifyContent: "center" })}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: `linear-gradient(90deg, ${a}, #fff3c4, ${a})`, color: "#0b1a3a",
          padding: "6px 14px", borderRadius: 999, fontFamily: H, fontWeight: 900, fontSize: title.length > 20 ? 14 : 16, letterSpacing: 1, boxShadow: `0 6px 18px ${a}55`, ...clip1, maxWidth: 320 }}>
          <Trophy style={{ width: 16, height: 16, flexShrink: 0 }} strokeWidth={2.4} />{title}
        </div>
      </div>
      <div style={abs({ left: 0, right: 0, top: 46, textAlign: "center", color: a, fontSize: 10, letterSpacing: 6 })}>★ ★ ★</div>
      <div style={abs({ left: 70, right: 70, top: 64, height: 210, borderRadius: "110px 110px 18px 18px", padding: 3, background: `linear-gradient(180deg, ${a}, transparent)` })}>
        <Photo photo={photo} tint={a} style={{ inset: 3, borderRadius: "107px 107px 16px 16px", background: "#0b1a3a" }} />
      </div>
      <div style={abs({ left: 70, right: 70, top: 214, height: 63, background: "linear-gradient(180deg,transparent,#0b1a3aee)", borderRadius: "0 0 18px 18px" })} />
      {d.show.jersey && d.jersey && <div style={abs({ right: 26, top: 70, fontFamily: H, fontWeight: 900, fontSize: 40, color: a, opacity: 0.9 })}>{d.jersey.slice(0, 3)}</div>}
      <div style={abs({ left: 18, right: 18, top: 282, textAlign: "center" })}>
        <div style={{ fontFamily: H, fontWeight: 900, fontSize: fitSize(perf, 40, 12, 22), lineHeight: 1, color: a, textShadow: `0 4px 22px ${a}66`, ...clip1 }} data-testid="card-performance">{perf}</div>
        <Name d={d} base={30} max={16} style={{ marginTop: 6 }} />
        <div style={{ fontFamily: M, fontSize: 9.5, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 4, opacity: 0.85, ...clip1 }}>{d.show.team && d.team ? d.team : metaLine(d, sport)}</div>
      </div>
      <div style={abs({ left: 22, right: 22, top: 380, padding: "5px 0", borderTop: `1px solid ${a}66`, borderBottom: `1px solid ${a}66`,
        textAlign: "center", fontFamily: M, fontSize: 9, letterSpacing: 1.2, textTransform: "uppercase", color: "#e2e8f0", ...clip1 })}>{match}</div>
      {d.show.stats && <div style={abs({ left: 18, right: 18, top: 414, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 })}>
        {stats.slice(0, 3).map((x) => <div key={x.key} style={{ textAlign: "center", background: "rgba(255,255,255,.06)", borderRadius: 8, padding: "6px 4px" }}>
          <div style={{ fontFamily: M, fontWeight: 700, fontSize: 15, color: "#fff", ...clip1 }}>{x.value}</div>
          <div style={{ fontSize: 7.5, letterSpacing: 1, textTransform: "uppercase", opacity: 0.7, ...clip1 }}>{x.label}</div></div>)}
      </div>}
      <div style={abs({ left: 18, right: 18, bottom: 14, display: "flex", justifyContent: "space-between", fontFamily: M, fontSize: 8, letterSpacing: 2, opacity: 0.65, textTransform: "uppercase" })}>
        <span>{sport?.name}</span><span>{series ? "Series award" : "Match award"}</span></div>
      <Watermark on={wm} />
    </div>
  );
};

'''
assert a in s
s=s.replace(a, layout+a,1)
s=s.replace('  rookie_card: Rookie, mvp_edition: MVP, minimal_professional: Minimal, esports_pro: Esports,\n};','  rookie_card: Rookie, mvp_edition: MVP, minimal_professional: Minimal, esports_pro: Esports, match_award: MatchAward,\n};',1)
s=s.replace('minimal_professional: "#05080F", esports_pro: "radial-gradient(circle at 50% 30%,#3B0764,#020617 70%)",','minimal_professional: "#05080F", esports_pro: "radial-gradient(circle at 50% 30%,#3B0764,#020617 70%)",\n  match_award: "radial-gradient(circle at 50% 35%,#1d3a7a,#050b1d 70%)",',1)
open(p,'w').write(s)

p='/app/frontend/src/components/card/PlayerCard.jsx'; s=open(p).read()
a='<Layout d={data} sport={sport} photo={photo} a={a} stats={statsOf(sport, data)} wm={watermark} />'
assert a in s; s=s.replace(a,'<Layout d={data} sport={sport} photo={photo} a={a} stats={statsOf(sport, data)} wm={watermark} t={template} />'); open(p,'w').write(s)

p='/app/frontend/src/components/editor/Panels.jsx'; s=open(p).read()
a='''    ["tagline", "Tagline", 60, true], ["social", "Social handle", 30, true],
  ];'''
assert a in s
s=s.replace(a,'''    ["tagline", "Tagline", 60, true], ["social", "Social handle", 30, true],
    ["award", "Award title (e.g. Woman of the Series)", 28, matchDay], ["performance", "Match figures (e.g. 112* (68) · 3/24)", 26, matchDay],
    ["match", "Match or series (e.g. vs Mumbai Strikers)", 34, matchDay], ["venue", "Venue", 26, matchDay],
  ];''',1)
s=s.replace('  const esports = sport?.kind === "esports";\n  const fields = [','  const esports = sport?.kind === "esports";\n  const matchDay = template?.layout === "match_award";\n  const fields = [',1)
open(p,'w').write(s)

p='/app/frontend/src/pages/Create.jsx'; s=open(p).read()
a='<DetailsPanel sport={sport} d={state.data} setData={setData} />'
assert a in s; s=s.replace(a,'<DetailsPanel sport={sport} template={template} d={state.data} setData={setData} />'); open(p,'w').write(s)

p='/app/backend/seed_catalog.py'; s=open(p).read()
s=s.replace('''           "mvp_edition", "minimal_professional", "esports_pro"]''','''           "mvp_edition", "minimal_professional", "esports_pro", "match_award"]''',1)
a='''    ("esports_legend", "Esports Legend", "LEGEND", "esports_pro", "exclusive", "#FBBF24", "Gold HUD for championship rosters.", ["esports"]),
]'''
assert a in s
s=s.replace(a,'''    ("esports_legend", "Esports Legend", "LEGEND", "esports_pro", "exclusive", "#FBBF24", "Gold HUD for championship rosters.", ["esports"]),
    ("potm_gold", "Player of the Match", "POTM", "match_award", "free", "#F5B400", "Trophy ribbon, stadium rays and your match figures up front.", ["team"]),
    ("potm_royal", "Player of the Match Royal", "POTM", "match_award", "basic", "#3B82F6", "Match-day award card in royal blue.", ["team"]),
    ("mots_gold", "Man of the Series", "MOTS", "match_award", "pro", "#D4AF37", "Series award card with gold rays for top performers.", ["team"]),
    ("mots_platinum", "Man of the Series Platinum", "MOTS", "match_award", "premium", "#E2E8F0", "Platinum series award for the season's best.", ["team"]),
]
CRICKET_ONLY = {"potm_gold", "potm_royal", "mots_gold", "mots_platinum"}''',1)
a='''              "active": True, "order": k} for k, (i, n, b, lay, c, a, d, rec) in enumerate(_T)]'''
assert a in s
s=s.replace(a,'''              "active": True, "order": k} for k, (i, n, b, lay, c, a, d, rec) in enumerate(_T)]
for _t in TEMPLATES:
    if _t["id"] in CRICKET_ONLY:
        _t["sports"] = ["cricket"]''',1)
open(p,'w').write(s)
print('ok')
