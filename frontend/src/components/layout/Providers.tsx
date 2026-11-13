"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";

import { useReducedMotion } from "@/lib/hooks";
import type { SiteConfig } from "@/lib/types";

/** Smooth, weighty scrolling on pointer devices. Touch keeps native momentum. */
function SmoothScroll() {
  const reduce = useReducedMotion();
  const pathname = usePathname();
  useEffect(() => {
    if (reduce || window.matchMedia("(pointer: coarse)").matches) return;
    const lenis = new Lenis({ duration: 1.15, easing: (t) => 1 - Math.pow(1 - t, 4), smoothWheel: true });
    let frame = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, [reduce]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function Providers({ children, site }: { children: ReactNode; site: SiteConfig }) {
  const [client] = useState(() => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
    });
    queryClient.setQueryData(["site"], site);
    return queryClient;
  });
  return (
    <QueryClientProvider client={client}>
      <SmoothScroll />
      {children}
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: "#4A2C2A", color: "#FFF8F6", border: "none", borderRadius: "999px", padding: "12px 22px",
            fontFamily: "var(--font-lato), Arial, sans-serif", fontSize: "14px", boxShadow: "0 18px 50px -20px rgb(74 44 42 / .6)",
          },
        }}
      />
    </QueryClientProvider>
  );
}
