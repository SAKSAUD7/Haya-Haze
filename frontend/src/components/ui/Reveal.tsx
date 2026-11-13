"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

export const FABRIC_EASE = [0.22, 1, 0.36, 1] as const;

/** Fades and lifts content into place as it scrolls into view. */
export function Reveal({
  children, delay = 0, y = 28, className, as = "div",
}: { children: ReactNode; delay?: number; y?: number; className?: string; as?: "div" | "section" | "li" | "article" }) {
  const reduce = useReducedMotion();
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 1.1, delay, ease: FABRIC_EASE }}
    >
      {children}
    </Tag>
  );
}

/** Reveals a heading word by word, each rising from behind a mask. */
export function WordReveal({ text, className, delay = 0 }: { text: string; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  const words = text.split(" ");
  return (
    <span className={className} aria-label={text}>
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom pb-[0.12em] -mb-[0.12em]" aria-hidden>
          <motion.span
            className="inline-block"
            initial={reduce ? false : { y: "110%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 1.2, delay: delay + i * 0.07, ease: FABRIC_EASE }}
          >
            {word}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

export function SectionHeading({
  eyebrow, title, text, align = "center", light = false, className,
}: { eyebrow?: string; title: string; text?: string; align?: "center" | "left"; light?: boolean; className?: string }) {
  return (
    <Reveal className={`${align === "center" ? "mx-auto text-center" : ""} max-w-2xl ${className ?? ""}`}>
      {eyebrow && <p className={`eyebrow mb-4 ${light ? "!text-light-gold" : ""}`}>{eyebrow}</p>}
      <h2 className={`text-4xl md:text-5xl lg:text-[3.4rem] ${light ? "!text-ivory" : ""}`}>{title}</h2>
      {text && <p className={`mt-5 text-[1.02rem] ${light ? "text-cream/85" : "text-mocha"}`}>{text}</p>}
    </Reveal>
  );
}
