"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion, type TargetAndTransition } from "framer-motion";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { FABRIC_EASE } from "./Reveal";

type Side = "right" | "left" | "bottom" | "center";

const PANEL: Record<Side, string> = {
  right: "right-0 top-0 h-dvh w-full max-w-[440px] rounded-l-[24px]",
  left: "left-0 top-0 h-dvh w-[88vw] max-w-[380px] rounded-r-[24px]",
  bottom: "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[26px]",
  center: "left-1/2 top-1/2 w-[94vw] max-w-[940px] max-h-[92dvh] rounded-[24px]",
};

const MOTION: Record<Side, { initial: TargetAndTransition; animate: TargetAndTransition }> = {
  right: { initial: { x: "100%" }, animate: { x: 0 } },
  left: { initial: { x: "-100%" }, animate: { x: 0 } },
  bottom: { initial: { y: "100%" }, animate: { y: 0 } },
  center: { initial: { opacity: 0, scale: 0.96, x: "-50%", y: "-46%" }, animate: { opacity: 1, scale: 1, x: "-50%", y: "-50%" } },
};

/** Accessible drawer / modal (focus trap, Escape, scroll lock) with fabric-soft motion. */
export function Sheet({
  open, onClose, side = "right", title, hideTitle = false, children, className, dim = true,
}: {
  open: boolean; onClose: () => void; side?: Side; title: string; hideTitle?: boolean; children: ReactNode;
  className?: string; dim?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className={cn("fixed inset-0 z-[70]", dim ? "bg-espresso/45 backdrop-blur-[3px]" : "bg-transparent")}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.45 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                data-lenis-prevent
                className={cn(
                  "fixed z-[71] flex flex-col overflow-hidden bg-ivory shadow-lift outline-none", PANEL[side], className,
                )}
                initial={MOTION[side].initial}
                animate={MOTION[side].animate}
                exit={MOTION[side].initial}
                transition={{ duration: 0.7, ease: FABRIC_EASE }}
              >
                <div className={cn("flex items-center justify-between px-6 pt-5 pb-3", hideTitle && "absolute right-0 top-0 z-10 !p-3")}>
                  <Dialog.Title className={cn("font-serif text-2xl text-deep", hideTitle && "sr-only")}>{title}</Dialog.Title>
                  <Dialog.Close
                    className="grid h-10 w-10 place-items-center rounded-full bg-ivory/80 text-deep transition hover:bg-cream"
                    aria-label="Close"
                  >
                    <X size={20} strokeWidth={1.5} />
                  </Dialog.Close>
                </div>
                {children}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
