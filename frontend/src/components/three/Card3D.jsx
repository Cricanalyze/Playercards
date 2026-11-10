import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { toJpeg } from "html-to-image";
import { PlayerCard } from "@/components/card/PlayerCard";
import { useAppData } from "@/context/AppData";
import { demoFor } from "@/lib/cardUtils";

export { hasWebGL } from "./webgl";

const idle = () => new Promise((r) => (window.requestIdleCallback ? window.requestIdleCallback(r, { timeout: 1500 }) : setTimeout(r, 300)));
const cacheKey = (it) => `fc3d:${it.template.id}:${it.i}`;
const readCache = (it) => { try { return sessionStorage.getItem(cacheKey(it)); } catch { return null; } };

// Renders real FlexoCards cards off-screen and snapshots them (cached per session) for use as 3D textures.
export function useCardImages(indices, extra = []) {
  const { sports, templates } = useAppData();
  const refs = useRef([]);
  const [urls, setUrls] = useState({});
  const key = indices.join(",") + extra.map((x) => x.i).join(",");
  const items = useMemo(() => (sports.length && templates.length ? [...indices.map((i) => {
    const demo = demoFor(i, sports);
    return { i, demo, template: templates.find((t) => t.id === demo.templateId) };
  }), ...extra].filter((x) => x.template) : []), [sports, templates, key]); // eslint-disable-line react-hooks/exhaustive-deps
  const todo = items.filter((it) => !readCache(it));
  useEffect(() => {
    if (!items.length) return;
    const cached = Object.fromEntries(items.map((it) => [it.i, readCache(it)]).filter(([, u]) => u));
    if (Object.keys(cached).length) setUrls((m) => ({ ...m, ...cached }));
    let off = false;
    (async () => {
      await document.fonts.ready;
      for (const it of items) {
        if (cached[it.i]) continue;
        await idle();
        try {
          const el = refs.current[it.i];
          if (!el || off) continue;
          const u = await toJpeg(el, { pixelRatio: 1, quality: 0.85, backgroundColor: "#0B0F17" });
          try { sessionStorage.setItem(cacheKey(it), u); } catch { /* storage full */ }
          if (!off) setUrls((m) => ({ ...m, [it.i]: u }));
        } catch { /* keeps placeholder face */ }
      }
    })();
    return () => { off = true; };
  }, [items]);
  const node = todo.length ? createPortal(
    <div aria-hidden style={{ position: "fixed", left: -10000, top: 0, pointerEvents: "none" }}>
      {todo.map((it) => <PlayerCard key={it.i} ref={(el) => { refs.current[it.i] = el; }} template={it.template} sport={it.demo.sport} data={it.demo.data} photo={it.demo.photo} />)}
    </div>, document.body) : null;
  return { cards: items.map((it) => ({ ...it, url: urls[it.i] })), node };
}

export function useCardImage(i) {
  const { cards, node } = useCardImages([i]);
  return { url: cards[0]?.url, demo: cards[0]?.demo, node };
}

function useTex(url) {
  const [t, setT] = useState(null);
  useEffect(() => {
    if (!url) return;
    new THREE.TextureLoader().load(url, (tx) => { tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 8; setT(tx); });
  }, [url]);
  return t;
}

function backTexture(demo) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 717;
  const g = c.getContext("2d");
  g.fillStyle = "#06080D"; g.fillRect(0, 0, 512, 717);
  g.strokeStyle = "#F59E0B"; g.lineWidth = 6; g.strokeRect(18, 18, 476, 681);
  g.fillStyle = "#F59E0B"; g.font = "bold 18px monospace"; g.fillText("FLEXOCARDS · CERTIFIED", 44, 70);
  g.fillStyle = "#F8FAFC"; g.font = "900 64px 'Big Shoulders Display', sans-serif";
  g.fillText((demo.data.name || "Player").toUpperCase(), 44, 150, 424);
  g.fillStyle = "#A8B3C4"; g.font = "22px sans-serif"; g.fillText((demo.sport?.name || "").toUpperCase(), 44, 186);
  (demo.sport?.stats || []).slice(0, 6).forEach((s, k) => {
    const y = 250 + k * 56;
    g.fillStyle = "rgba(255,255,255,.12)"; g.fillRect(44, y + 16, 424, 2);
    g.fillStyle = "#A8B3C4"; g.font = "20px sans-serif"; g.fillText(s.label.toUpperCase(), 44, y);
    g.fillStyle = "#F8FAFC"; g.font = "bold 24px monospace"; g.textAlign = "right"; g.fillText(String(demo.data.stats?.[s.key] || "—"), 468, y); g.textAlign = "left";
  });
  g.fillStyle = "#F8FAFC";
  for (let x = 44; x < 330; x += 7) g.fillRect(x, 610, (x * 13) % 4 + 1, 56);
  if (demo.data.rating) { g.fillStyle = "#F59E0B"; g.font = "900 72px 'Big Shoulders Display', sans-serif"; g.fillText(String(demo.data.rating), 370, 666); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function Card3D({ url, demo, spin = 0.35 }) {
  const front = useTex(url);
  const back = useMemo(() => (demo ? backTexture(demo) : null), [demo]);
  const g = useRef();
  useFrame((_, dt) => { if (spin && g.current) g.current.rotation.y += dt * spin; });
  return (
    <group ref={g}>
      <RoundedBox args={[2.5, 3.5, 0.09]} radius={0.06} smoothness={4}>
        <meshStandardMaterial color="#C9A227" metalness={1} roughness={0.22} />
      </RoundedBox>
      <mesh position={[0, 0, 0.047]}>
        <planeGeometry args={[2.36, 3.36]} />
        <meshStandardMaterial key={front ? "tex" : "plain"} map={front || back} roughness={0.32} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0, -0.047]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[2.36, 3.36]} />
        <meshStandardMaterial map={back} roughness={0.4} />
      </mesh>
    </group>
  );
}
