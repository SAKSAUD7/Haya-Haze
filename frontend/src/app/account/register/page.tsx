import type { Metadata } from "next";
import { Suspense } from "react";

import { RibbonLoader } from "@/components/brand/RibbonLoader";

import { RegisterForm } from "@/components/account/AuthForms";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default function Page() {
  return (
    <Suspense fallback={<RibbonLoader />}>
      <RegisterForm />
    </Suspense>
  );
}
