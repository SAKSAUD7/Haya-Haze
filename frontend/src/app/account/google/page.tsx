import type { Metadata } from "next";
import { Suspense } from "react";

import { RibbonLoader } from "@/components/brand/RibbonLoader";

import { GoogleCallback } from "@/components/account/AuthForms";

export const metadata: Metadata = { title: "Signing in", robots: { index: false } };

export default function Page() {
  return (
    <Suspense fallback={<RibbonLoader />}>
      <GoogleCallback />
    </Suspense>
  );
}
