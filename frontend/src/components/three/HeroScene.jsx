import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer, PresentationControls, Float } from "@react-three/drei";
import { Card3D, useCardImage } from "./Card3D";
import { SportsObjects } from "./SportsObjects";

export const StudioLights = () => (
  <>
    <ambientLight intensity={0.45} />
    <spotLight position={[4, 6, 6]} angle={0.5} penumbra={0.6} intensity={70} color="#FFF2D6" />
    <pointLight position={[-5, -2, 3]} intensity={25} color="#5CF2FF" />
    <Environment resolution={128}>
      <Lightformer intensity={3} position={[0, 4, -4]} scale={[10, 2, 1]} />
      <Lightformer intensity={2.5} color="#F59E0B" position={[-5, 0, 2]} scale={[2, 6, 1]} />
      <Lightformer intensity={2} color="#5CF2FF" position={[5, 0, 2]} scale={[2, 6, 1]} />
    </Environment>
  </>
);

export default function HeroScene({ mobile }) {
  const { url, node, demo } = useCardImage(0);
  return (
    <>
      {node}
      <Canvas dpr={[1, mobile ? 1.25 : 1.75]} camera={{ position: [0, 0, mobile ? 9 : 8], fov: 40 }} gl={{ antialias: true, alpha: true }}
        style={{ touchAction: "pan-y" }} data-testid="hero-3d-canvas">
        <StudioLights />
        <PresentationControls global={false} cursor snap={false} speed={1.8} azimuth={[-Infinity, Infinity]} polar={[-0.35, 0.35]}>
          <Float speed={1.3} rotationIntensity={0.15} floatIntensity={0.5}><Card3D url={url} demo={demo} /></Float>
        </PresentationControls>
        <SportsObjects mobile={mobile} />
      </Canvas>
    </>
  );
}
