import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";

export const CricketBall = () => (
  <group rotation={[0.5, 0, 0.7]}>
    <mesh><sphereGeometry args={[0.36, 32, 32]} /><meshStandardMaterial color="#9F1020" roughness={0.42} /></mesh>
    <mesh><torusGeometry args={[0.362, 0.02, 8, 64]} /><meshStandardMaterial color="#F5E6C8" /></mesh>
  </group>
);

export const Football = () => (
  <group>
    <mesh><icosahedronGeometry args={[0.42, 1]} /><meshStandardMaterial color="#F8FAFC" flatShading roughness={0.5} /></mesh>
    <mesh scale={1.004}><icosahedronGeometry args={[0.42, 1]} /><meshBasicMaterial color="#111" wireframe /></mesh>
  </group>
);

export const Basketball = () => (
  <group rotation={[0.3, 0.4, 0]}>
    <mesh><sphereGeometry args={[0.4, 32, 32]} /><meshStandardMaterial color="#E8731A" roughness={0.7} /></mesh>
    <mesh><torusGeometry args={[0.402, 0.012, 6, 64]} /><meshStandardMaterial color="#1a1a1a" /></mesh>
    <mesh rotation={[0, Math.PI / 2, 0]}><torusGeometry args={[0.402, 0.012, 6, 64]} /><meshStandardMaterial color="#1a1a1a" /></mesh>
    <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.402, 0.012, 6, 64]} /><meshStandardMaterial color="#1a1a1a" /></mesh>
  </group>
);

export const Stumps = () => (
  <group rotation={[0.15, 0.4, 0.12]}>
    {[-0.16, 0, 0.16].map((x) => (
      <mesh key={x} position={[x, 0, 0]}><cylinderGeometry args={[0.035, 0.035, 1.1, 12]} /><meshStandardMaterial color="#F1E3C4" roughness={0.6} /></mesh>
    ))}
    {[-0.08, 0.08].map((x) => (
      <mesh key={x} position={[x, 0.57, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.018, 0.018, 0.16, 8]} /><meshStandardMaterial color="#C9A227" metalness={0.6} roughness={0.3} /></mesh>
    ))}
  </group>
);

export const Pawn = () => {
  const geo = useMemo(() => new THREE.LatheGeometry(
    [[0, 0], [0.3, 0], [0.3, 0.07], [0.22, 0.12], [0.13, 0.22], [0.1, 0.5], [0.18, 0.56], [0.1, 0.6], [0.16, 0.72], [0.15, 0.82], [0.08, 0.9], [0, 0.92]].map(([x, y]) => new THREE.Vector2(x, y)), 32), []);
  return <mesh geometry={geo} position={[0, -0.45, 0]}><meshStandardMaterial color="#D4AF37" metalness={0.9} roughness={0.25} /></mesh>;
};

export const Shuttle = () => (
  <group rotation={[0.5, 0, -0.4]}>
    <mesh rotation={[Math.PI, 0, 0]}><coneGeometry args={[0.24, 0.42, 16, 1, true]} /><meshStandardMaterial color="#F8FAFC" side={THREE.DoubleSide} transparent opacity={0.92} /></mesh>
    <mesh position={[0, -0.24, 0]}><sphereGeometry args={[0.08, 16, 16]} /><meshStandardMaterial color="#F1E3C4" /></mesh>
  </group>
);

export function Trophy() {
  const cup = useMemo(() => new THREE.LatheGeometry(
    [[0, 0], [0.55, 0.02], [0.62, 0.35], [0.6, 0.75], [0.45, 1.05], [0.14, 1.25], [0.1, 1.6], [0.32, 1.72], [0.36, 1.82], [0, 1.82]].map(([x, y]) => new THREE.Vector2(x, y)), 48), []);
  const g = useRef();
  useFrame((_, dt) => { if (g.current) g.current.rotation.y += dt * 0.5; });
  const gold = <meshStandardMaterial color="#E6B325" metalness={1} roughness={0.18} />;
  return (
    <group ref={g}>
      <mesh geometry={cup} rotation={[Math.PI, 0, 0]} position={[0, 2.6, 0]}>{gold}</mesh>
      {[-1, 1].map((s) => <mesh key={s} position={[s * 0.62, 2.05, 0]} rotation={[0, 0, s * 0.2]}><torusGeometry args={[0.26, 0.05, 12, 32, Math.PI * 1.3]} />{gold}</mesh>)}
      <mesh position={[0, 0.25, 0]}><boxGeometry args={[1.1, 0.5, 1.1]} /><meshStandardMaterial color="#141A26" metalness={0.5} roughness={0.4} /></mesh>
      <mesh position={[0, 0.53, 0]}><boxGeometry args={[0.8, 0.08, 0.8]} />{gold}</mesh>
    </group>
  );
}

const ITEMS = [
  [CricketBall, [-2.7, 1.7, -0.4]], [Football, [2.8, 1.4, -0.8]], [Basketball, [2.5, -1.8, 0.2]],
  [Stumps, [-2.6, -1.6, -0.6]], [Pawn, [-3.6, 0.1, -2]], [Shuttle, [3.7, 0, -2]],
];

// Floating sports objects; the whole group leans toward the mouse / finger.
export function SportsObjects({ mobile }) {
  const g = useRef();
  useFrame((s) => {
    if (!g.current) return;
    g.current.rotation.y = THREE.MathUtils.lerp(g.current.rotation.y, s.pointer.x * 0.35, 0.05);
    g.current.rotation.x = THREE.MathUtils.lerp(g.current.rotation.x, -s.pointer.y * 0.2, 0.05);
  });
  const list = mobile ? ITEMS.slice(0, 4) : ITEMS;
  return (
    <group ref={g}>
      {list.map(([C, [x, y, z]], i) => (
        <Float key={i} speed={1.4 + i * 0.25} rotationIntensity={1.3} floatIntensity={1.5}>
          <group position={mobile ? [x * 0.6, y * 1.25, z] : [x * 0.82, y, z]} scale={mobile ? 0.8 : 1}><C /></group>
        </Float>
      ))}
    </group>
  );
}
