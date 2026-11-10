import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Stars, Sparkles, PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import { Card3D, useCardImages } from "./Card3D";
import { Ground, Stands, Floodlights, towerLevel } from "./StadiumScene";
import { CricketBall, Football, Basketball, Shuttle, Pawn, Stumps, Trophy } from "./SportsObjects";

const v = (x, y, z) => new THREE.Vector3(x, y, z);
// Camera stop per section: [element id, fraction through a tall section, camera position, look-at]
const KEYS = [
  ["top", 0, v(-16, 30, 60), v(-6, 5, 0)],
  ["sports", 0, v(34, 7, 26), v(0, 9, -38)],
  ["templates", 0, v(0, 3.4, 12), v(0, 2.2, 0)],
  ["how", 0, v(30, 18, 34), v(0, 0, 0)],
  ["how", 0.5, v(24, 4, 4), v(0, 1, 0)],
  ["how", 1, v(0, 2.2, -5.8), v(0, 1.95, 0)],
  ["benefits", 0, v(6, 3.2, -8), v(0, 2.2, -17)],
  ["pricing", 0, v(-3, 3, -20), v(-6, 6.5, -46)],
  ["faq", 0, v(-24, 11, 14), v(0, 3, 0)],
  ["cta-section", 0, v(4.5, 1.8, 14.5), v(0, 1, 9.5)],
];

function Rig() {
  const tops = useRef([]);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(0, 5, 0), []);
  const tgt = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    const calc = () => {
      tops.current = KEYS.map(([id, f]) => {
        const el = document.getElementById(id);
        if (!el) return 0;
        const top = el.getBoundingClientRect().top + window.scrollY;
        return f ? top + f * Math.max(0, el.offsetHeight - window.innerHeight) : top - window.innerHeight * 0.35;
      });
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(document.body);
    return () => ro.disconnect();
  }, []);
  useFrame(({ camera }) => {
    const ts = tops.current;
    if (!ts.length) return;
    const y = window.scrollY;
    let i = 0;
    while (i < ts.length - 2 && y >= ts[i + 1]) i++;
    const f = THREE.MathUtils.smoothstep(y, ts[i], ts[i + 1] || ts[i] + 1);
    pos.lerpVectors(KEYS[i][2], KEYS[i + 1][2], f);
    tgt.lerpVectors(KEYS[i][3], KEYS[i + 1][3], f);
    camera.position.lerp(pos, 0.07);
    look.lerp(tgt, 0.07);
    camera.lookAt(look);
  });
  return null;
}

const SKY_OBJECTS = [[CricketBall, [-9, 12, 4]], [Football, [8, 15, -4]], [Basketball, [12, 10, 6]], [Shuttle, [-12, 16, -8]], [Pawn, [3, 18, 8]]];

function SkyObjects({ mobile }) {
  return (mobile ? SKY_OBJECTS.slice(0, 3) : SKY_OBJECTS).map(([C, p], i) => (
    <Float key={i} speed={1 + i * 0.2} rotationIntensity={1.2} floatIntensity={2}>
      <group position={p} scale={3.2}><C /></group>
    </Float>
  ));
}

function scoreboardTexture() {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 400;
  const g = c.getContext("2d");
  g.fillStyle = "#05070B"; g.fillRect(0, 0, 1024, 400);
  g.strokeStyle = "#F59E0B"; g.lineWidth = 10; g.strokeRect(10, 10, 1004, 380);
  g.fillStyle = "#F59E0B"; g.font = "900 110px 'Big Shoulders Display', sans-serif"; g.textAlign = "center";
  g.fillText("FLEXOCARDS", 512, 160);
  g.fillStyle = "#5CF2FF"; g.font = "bold 54px monospace";
  g.fillText("FREE · BASIC · PRO · TEAM", 512, 260);
  g.fillStyle = "#F8FAFC"; g.font = "bold 34px monospace";
  g.fillText("SEASON PASSES · PRICES IN INR", 512, 330);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Scoreboard() {
  const tex = useMemo(scoreboardTexture, []);
  return (
    <group position={[0, 15, -47]}>
      <mesh><boxGeometry args={[22, 8.6, 0.6]} /><meshStandardMaterial color="#0b0f17" /></mesh>
      <mesh position={[0, 0, 0.31]}><planeGeometry args={[21, 8.2]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
      {[-9, 9].map((x) => <mesh key={x} position={[x, -9, -0.5]}><boxGeometry args={[0.8, 10, 0.8]} /><meshStandardMaterial color="#1b2333" /></mesh>)}
    </group>
  );
}

function BouncingBall() {
  const ball = useRef();
  useFrame((s) => {
    if (!ball.current) return;
    const t = s.clock.elapsedTime;
    ball.current.position.set(Math.sin(t * 0.8) * 1.2, 0.5 + Math.abs(Math.sin(t * 1.6)) * 1.1, 9.2 + Math.cos(t * 0.8) * 0.4);
    ball.current.rotation.x += 0.06;
  });
  return <group ref={ball} scale={0.7}><CricketBall /></group>;
}

function ledTexture() {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "#05070B"; g.fillRect(0, 0, 1024, 64);
  g.font = "900 44px 'Big Shoulders Display', sans-serif"; g.textBaseline = "middle";
  ["FLEXOCARDS", "CREATE", "CUSTOMIZE", "SHARE"].forEach((w, k) => { g.fillStyle = k % 2 ? "#5CF2FF" : "#F59E0B"; g.fillText(`${w}  ★`, 20 + k * 250, 34); });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(-10, 1);
  return t;
}

// Scrolling LED advertising boards around the boundary.
function LedBoards() {
  const tex = useMemo(ledTexture, []);
  useFrame((_, dt) => { tex.offset.x -= dt * 0.04; });
  return (
    <mesh position={[0, 0.6, 0]}>
      <cylinderGeometry args={[34.5, 34.5, 1.2, 96, 1, true]} />
      <meshBasicMaterial map={tex} side={THREE.BackSide} toneMapped={false} />
    </mesh>
  );
}

const SPOTS = [[0, 1.95, 0, 0.35], [-3.4, 1.95, 1.6, -0.25], [3.4, 1.95, 1.6, 0.25]];

// Main stadium lights ramp up as the towers switch on.
function IntroLights() {
  const a = useRef();
  const b = useRef();
  const h = useRef();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const k = Math.min(1, Math.max(0, (t - 0.6) / 2.6));
    if (a.current) a.current.intensity = 2500 * towerLevel(t, 0) * k;
    if (b.current) b.current.intensity = 1800 * towerLevel(t, 2) * k;
    if (h.current) h.current.intensity = 0.15 + 0.45 * k;
  });
  return (
    <>
      <hemisphereLight ref={h} args={["#cfe0ff", "#0b2a14", 0.15]} />
      <spotLight ref={a} position={[40, 45, 40]} angle={0.6} penumbra={0.7} intensity={0} color="#FFF2D6" />
      <spotLight ref={b} position={[-40, 45, -40]} angle={0.6} penumbra={0.7} intensity={0} color="#FFF2D6" />
    </>
  );
}

function MyCardSpot() {
  const ring = useRef();
  useFrame(({ clock }) => { if (ring.current) ring.current.material.opacity = 0.55 + Math.sin(clock.elapsedTime * 2) * 0.25; });
  return (
    <group position={[0, 0.05, 0]}>
      <mesh ref={ring} rotation-x={-Math.PI / 2}><ringGeometry args={[1.9, 2.2, 64]} /><meshBasicMaterial color="#F59E0B" transparent opacity={0.6} toneMapped={false} /></mesh>
      <pointLight position={[0, 4, 3]} intensity={50} color="#FFE7A3" />
    </group>
  );
}

export default function HomeWorld({ mobile, mine }) {
  const extra = mine && !mine.url ? [{ i: `mine-${mine.id}-${mine.updated_at}`, demo: { sport: mine.sport, data: mine.data, photo: mine.photo }, template: mine.template }] : [];
  const { cards, node } = useCardImages(mobile ? [0] : [0, 1, 2], extra);
  const mineUrl = mine && (mine.url || cards.find((c) => String(c.i).startsWith("mine-"))?.url);
  const mineDemo = useMemo(() => (mine ? { sport: mine.sport, data: mine.data } : null), [mine]);
  const demoCards = cards.filter((c) => !String(c.i).startsWith("mine-"));
  const [dpr, setDpr] = useState(mobile ? 1 : 1.3);
  return (
    <>
      {node}
      <div className="fixed inset-0 -z-10 bg-[#06080D] animate-[fadeIn_.8s_ease]" data-testid="home-3d-world">
        <Canvas dpr={dpr} camera={{ position: [-16, 30, 60], fov: mobile ? 60 : 48, far: 280 }}
          gl={{ antialias: !mobile, powerPreference: "high-performance", stencil: false }} style={{ pointerEvents: "none" }}>
          <PerformanceMonitor onDecline={() => setDpr(mobile ? 0.75 : 1)} onIncline={() => setDpr(mobile ? 1 : 1.3)} />
          <color attach="background" args={["#06080D"]} />
          <fog attach="fog" args={["#06080D", 50, 160]} />
          <IntroLights />
          <pointLight position={[0, 6, 2]} intensity={70} color="#F59E0B" />
          <pointLight position={[0, 5, -15]} intensity={60} color="#FFD43B" />
          <Stars radius={150} depth={30} count={mobile ? 300 : 1200} factor={4} fade />
          <Ground />
          <LedBoards />
          <Stands crowd={mobile ? 600 : 2400} />
          <Floodlights count={4} cones={!mobile} intro />
          <Scoreboard />
          <SkyObjects mobile={mobile} />
          {SPOTS.map(([x, y, z, r], k) => {
            if (k === 0 && mine) return (
              <group key="mine" position={[x, y, z]}><Card3D url={mineUrl} demo={mineDemo} spin={0.35} /></group>
            );
            const c = demoCards[k];
            return c && <group key={k} position={[x, y, z]} rotation={[0, r, 0]} scale={k ? 0.8 : 1}><Card3D url={c.url} demo={c.demo} spin={k ? 0 : 0.35} /></group>;
          })}
          {mine && <MyCardSpot />}
          <group position={[0, 0, -17]}>
            <mesh position={[0, 0.4, 0]}><cylinderGeometry args={[1.6, 1.8, 0.8, 32]} /><meshStandardMaterial color="#141A26" metalness={0.4} roughness={0.4} /></mesh>
            <group position={[0, 1.5, 0]}><Trophy /></group>
            {!mobile && <Sparkles count={45} scale={[5, 5, 4]} position={[0, 3, 0]} size={3} speed={0.4} color="#FFD43B" />}
          </group>
          <group position={[0, 0.55, 10]}><Stumps /></group>
          <BouncingBall />
          <Rig />
        </Canvas>
      </div>
    </>
  );
}
