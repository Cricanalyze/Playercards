import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { toPng } from "html-to-image";
import { PlayerCard } from "@/components/card/PlayerCard";
import { useAppData } from "@/context/AppData";
import { demoFor } from "@/lib/cardUtils";

export { hasWebGL } from "./webgl";

// Renders a real FlexoCards card off-screen and snapshots it for use as a 3D texture.
export function useCardImage(i) {
  const { sports, templates } = useAppData();
  const ref = useRef(null);
  const [url, setUrl] = useState(null);
  const demo = useMemo(() => (sports.length ? demoFor(i, sports) : null), [sports, i]);
  const template = demo && templates.find((t) => t.id === demo.templateId);
  useEffect(() => {
    if (!demo || !template) return;
    let off = false;
    (async () => {
      await document.fonts.ready;
      await new Promise((r) => setTimeout(r, 400));
      try { const u = ref.current && (await toPng(ref.current, { pixelRatio: 1.5 })); if (!off && u) setUrl(u); } catch { /* keeps plain card face */ }
    })();
    return () => { off = true; };
  }, [demo, template]);
  const node = demo && template ? createPortal(
    <div aria-hidden style={{ position: "fixed", left: -10000, top: 0, pointerEvents: "none" }}>
      <PlayerCard ref={ref} template={template} sport={demo.sport} data={demo.data} photo={demo.photo} />
    </div>, document.body) : null;
  return { url, node, demo };
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
        <meshPhysicalMaterial color="#C9A227" metalness={1} roughness={0.22} clearcoat={1} />
      </RoundedBox>
      <mesh position={[0, 0, 0.047]}>
        <planeGeometry args={[2.36, 3.36]} />
        {front ? <meshPhysicalMaterial map={front} transparent alphaTest={0.05} roughness={0.35} clearcoat={1} clearcoatRoughness={0.12} iridescence={0.7} iridescenceIOR={1.4} />
          : <meshStandardMaterial color="#111827" metalness={0.4} roughness={0.5} />}
      </mesh>
      <mesh position={[0, 0, -0.047]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[2.36, 3.36]} />
        <meshPhysicalMaterial map={back} roughness={0.4} clearcoat={1} />
      </mesh>
    </group>
  );
}
