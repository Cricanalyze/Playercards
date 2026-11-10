import { useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import { Card3D, useCardImage } from "./Card3D";
import { Stumps } from "./SportsObjects";

const v = (x, y, z) => new THREE.Vector3(x, y, z);
const PATH = new THREE.CatmullRomCurve3([v(0, 34, 62), v(30, 18, 34), v(26, 5, 2), v(8, 2.4, -12), v(0, 2, -5.2)]);

function grassTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 1024;
  const g = c.getContext("2d");
  for (let r = 512; r > 0; r -= 32) { g.fillStyle = (r / 32) % 2 ? "#1d6b34" : "#175a2b"; g.beginPath(); g.arc(512, 512, r, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = "rgba(255,255,255,.8)"; g.lineWidth = 5; g.beginPath(); g.arc(512, 512, 470, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 3; g.beginPath(); g.arc(512, 512, 190, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function Ground() {
  const tex = useMemo(grassTexture, []);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2}><circleGeometry args={[34, 96]} /><meshStandardMaterial map={tex} roughness={0.9} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}><planeGeometry args={[3.2, 20.5]} /><meshStandardMaterial color="#C9AE7C" roughness={1} /></mesh>
      {[-8.8, 8.8].map((z) => (
        <group key={z}>
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, z]}><planeGeometry args={[3.2, 0.06]} /><meshBasicMaterial color="#fff" /></mesh>
          <group position={[0, 0.55, z + Math.sign(z) * 1.2]} rotation={[-0.15, -0.4, -0.12]}><Stumps /></group>
        </group>
      ))}
    </group>
  );
}

export function Stands({ crowd }) {
  const mesh = useRef();
  const tiers = [0, 1, 2, 3, 4, 5];
  useLayoutEffect(() => {
    const m = new THREE.Object3D();
    const pal = ["#2563EB", "#F59E0B", "#F8FAFC", "#EF4444", "#5CF2FF", "#1E293B"].map((c) => new THREE.Color(c));
    for (let i = 0; i < crowd; i++) {
      const k = i % 6;
      const a = Math.random() * Math.PI * 2;
      const r = 37.5 + k * 3 + Math.random() * 1.2;
      m.position.set(Math.cos(a) * r, 2.2 + k * 2.2 + Math.random() * 0.4, Math.sin(a) * r);
      m.lookAt(0, m.position.y, 0);
      m.updateMatrix();
      mesh.current.setMatrixAt(i, m.matrix);
      mesh.current.setColorAt(i, pal[Math.floor(Math.random() * pal.length)]);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  }, [crowd]);
  return (
    <group>
      {tiers.map((k) => (
        <mesh key={k} position={[0, 1.1 + k * 2.2, 0]}>
          <cylinderGeometry args={[39 + k * 3, 36 + k * 3, 2.2, 72, 1, true]} />
          <meshStandardMaterial color={k % 2 ? "#141A26" : "#1B2333"} side={THREE.DoubleSide} roughness={0.9} />
        </mesh>
      ))}
      <instancedMesh ref={mesh} args={[null, null, crowd]}>
        <boxGeometry args={[0.45, 0.7, 0.3]} />
        <meshStandardMaterial roughness={0.8} emissive="#222" />
      </instancedMesh>
      <mesh position={[0, 15, 0]}><torusGeometry args={[55, 1.2, 8, 96]} /><meshStandardMaterial color="#0f141e" /></mesh>
    </group>
  );
}

// Match-night switch-on: each tower flickers then locks on, one after another.
export const towerLevel = (t, i) => {
  const on = 0.6 + i * 0.7;
  if (t < on) return 0.02;
  if (t < on + 0.45) return Math.sin(t * 55 + i) > 0.1 ? 1 : 0.08;
  return 1;
};

function Tower({ i, a, cones, intro }) {
  const head = useRef();
  const cone = useRef();
  useFrame(({ clock }) => {
    const k = intro ? towerLevel(clock.elapsedTime, i) : 1;
    if (head.current) head.current.emissiveIntensity = 3 * k;
    if (cone.current) cone.current.opacity = 0.05 * k;
  });
  return (
    <group position={[Math.cos(a) * 58, 0, Math.sin(a) * 58]} rotation={[0, -a - Math.PI / 2, 0]}>
      <mesh position={[0, 16, 0]}><cylinderGeometry args={[0.35, 0.6, 32, 10]} /><meshStandardMaterial color="#2a3242" /></mesh>
      <mesh position={[0, 33, 0]} rotation={[0.45, 0, 0]}><boxGeometry args={[7, 4, 0.6]} /><meshStandardMaterial ref={head} color="#FFF6DA" emissive="#FFF6DA" emissiveIntensity={3} /></mesh>
      {cones && <mesh position={[0, 22, 14]} rotation={[-1.05, 0, 0]}>
        <coneGeometry args={[9, 34, 24, 1, true]} />
        <meshBasicMaterial ref={cone} color="#FFF2C8" transparent opacity={0.05} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>}
    </group>
  );
}

export function Floodlights({ count, cones = true, intro = false }) {
  return Array.from({ length: count }, (_, i) => <Tower key={i} i={i} a={Math.PI / 4 + (i * Math.PI * 2) / count} cones={cones} intro={intro} />);
}

function Rig({ p }) {
  const look = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    const t = Math.min(1, Math.max(0, p.get()));
    camera.position.lerp(PATH.getPointAt(t), 0.12);
    look.set(0, THREE.MathUtils.lerp(0, 1.9, t), 0);
    camera.lookAt(look);
  });
  return null;
}

export default function StadiumScene({ p, mobile }) {
  const { url, node, demo } = useCardImage(3);
  return (
    <>
      {node}
      <Canvas dpr={[1, mobile ? 1 : 1.5]} camera={{ position: [0, 34, 62], fov: mobile ? 62 : 50, far: 260 }} gl={{ antialias: !mobile }}
        style={{ touchAction: "pan-y" }} data-testid="stadium-3d-canvas">
        <color attach="background" args={["#06080D"]} />
        <fog attach="fog" args={["#06080D", 45, 150]} />
        <hemisphereLight args={["#cfe0ff", "#0b2a14", 0.55]} />
        <spotLight position={[40, 45, 40]} angle={0.6} penumbra={0.7} intensity={2500} color="#FFF2D6" />
        <spotLight position={[-40, 45, -40]} angle={0.6} penumbra={0.7} intensity={1800} color="#FFF2D6" />
        <pointLight position={[0, 6, 0]} intensity={60} color="#F59E0B" />
        <Stars radius={140} depth={30} count={mobile ? 600 : 1500} factor={4} fade />
        <Ground />
        <Stands crowd={mobile ? 900 : 2600} />
        <Floodlights count={4} />
        <group position={[0, 1.95, 0]}><Card3D url={url} demo={demo} spin={0.4} /></group>
        <Rig p={p} />
      </Canvas>
    </>
  );
}
