"use client";

import { motion, useReducedMotion } from "framer-motion";

/**
 * Page transition: a soft sheet of blush chiffon lifts away as each route arrives.
 * (template.tsx re-mounts on every navigation, which is what replays the animation.)
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  if (reduce) return <>{children}</>;
  return (
    <>
      <motion.div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[55] origin-top bg-gradient-to-b from-blush via-blush/95 to-blush/0"
        initial={{ y: "0%", opacity: 0.92, skewY: 0 }}
        animate={{ y: "-105%", opacity: 0.6, skewY: -2.5 }}
        transition={{ duration: 0.95, ease: [0.22, 1, 0.36, 1] }}
      />
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.1 }}>
        {children}
      </motion.div>
    </>
  );
}
