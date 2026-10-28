import { forwardRef, useEffect, useRef, useState } from "react";
import { LAYOUTS, STORY_BG, statsOf } from "./layouts";
import { CARD_W, CARD_H, STORY_H } from "@/lib/cardUtils";

const H = "'Barlow Condensed', 'DM Sans', sans-serif";
const M = "'JetBrains Mono', ui-monospace, monospace";

export const PlayerCard = forwardRef(({ template, sport, data, photo, watermark = false }, ref) => {
  const Layout = LAYOUTS[template?.layout] || LAYOUTS.classic_athlete;
  const a = data.accent || template?.accent || "#D4AF37";
  return (
    <div ref={ref} style={{ position: "relative", width: CARD_W, height: CARD_H, fontFamily: "'DM Sans', sans-serif" }}>
      <Layout d={data} sport={sport} photo={photo} a={a} stats={statsOf(sport, data)} wm={watermark} />
      {template?.frame_image && <img src={template.frame_image} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />}
    </div>
  );
});

export const StoryCard = forwardRef(({ template, sport, data, photo, watermark = false }, ref) => {
  const a = data.accent || template?.accent || "#D4AF37";
  const scale = 0.84;
  return (
    <div ref={ref} style={{ position: "relative", width: CARD_W, height: STORY_H, overflow: "hidden", background: STORY_BG[template?.layout] || "#0B0F17", color: "#fff", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% 52%,${a}30,transparent 60%)` }} />
      <div style={{ position: "absolute", top: 30, left: 24, right: 24, textAlign: "center" }}>
        <div style={{ fontFamily: M, fontSize: 9, letterSpacing: 4, color: a, textTransform: "uppercase" }}>{sport?.name}{data.show.season && data.season ? ` · ${data.season}` : ""}</div>
        <div style={{ fontFamily: H, fontWeight: 900, fontSize: 22, textTransform: "uppercase", marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {(data.show.tagline && data.tagline) || "My game. My identity."}</div>
      </div>
      <div style={{ position: "absolute", left: (CARD_W - CARD_W * scale) / 2, top: 92, width: CARD_W * scale, height: CARD_H * scale, filter: `drop-shadow(0 18px 30px rgba(0,0,0,.55))` }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <PlayerCard template={template} sport={sport} data={data} photo={photo} watermark={false} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 24, right: 24, bottom: 28, textAlign: "center" }}>
        {data.show.achievements && data.achievements?.length > 0 && (
          <div style={{ fontSize: 11, color: "#E2E8F0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>★ {data.achievements.slice(0, 2).join("  ★ ")}</div>
        )}
        {data.show.social && data.social && <div style={{ fontFamily: M, fontSize: 11, marginTop: 6, color: a }}>{data.social.slice(0, 30)}</div>}
        {watermark && <div style={{ fontFamily: M, fontSize: 8, letterSpacing: 3, marginTop: 8, color: "rgba(255,255,255,.55)" }}>MADE WITH RIVALCARD</div>}
      </div>
    </div>
  );
});

export function ScaledCard({ width, format = "card", className = "", ...props }) {
  const h = format === "story" ? STORY_H : CARD_H;
  const s = width / CARD_W;
  const Comp = format === "story" ? StoryCard : PlayerCard;
  return (
    <div className={className} style={{ width, height: h * s, position: "relative" }}>
      <div style={{ transform: `scale(${s})`, transformOrigin: "top left", width: CARD_W, height: h }}>
        <Comp {...props} />
      </div>
    </div>
  );
}

export function useWidth(max = 360) {
  const ref = useRef(null);
  const [w, setW] = useState(Math.min(max, 300));
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.min(max, Math.floor(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [max]);
  return [ref, w];
}
