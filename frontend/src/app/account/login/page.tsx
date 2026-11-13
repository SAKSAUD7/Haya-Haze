import type { Metadata } from "next";
import { Suspense } from "react";

import { RibbonLoader } from "@/components/brand/RibbonLoader";

import { LoginForm } from "@/components/account/AuthForms";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function Page() {
  return (
    <Suspense fallback={<RibbonLoader />}>
      <LoginForm />
    </Suspense>
  );
}
