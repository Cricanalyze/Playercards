import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

// Mouse-follow 3D tilt for any block (cards, pricing tickets, forms).
export function Tilt3D({ children, max = 9, className = "" }) {
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const cfg = { stiffness: 200, damping: 20 };
  const rotateX = useSpring(useTransform(py, [0, 1], [max, -max]), cfg);
  const rotateY = useSpring(useTransform(px, [0, 1], [-max, max]), cfg);
  const move = (e) => { if (e.pointerType === "touch") return; const r = e.currentTarget.getBoundingClientRect(); px.set((e.clientX - r.left) / r.width); py.set((e.clientY - r.top) / r.height); };
  const leave = () => { px.set(0.5); py.set(0.5); };
  return (
    <div style={{ perspective: 1000 }} className={className}>
      <motion.div onPointerMove={move} onPointerLeave={leave} style={{ rotateX, rotateY, transformStyle: "preserve-3d" }} className="h-full">
        {children}
      </motion.div>
    </div>
  );
}
