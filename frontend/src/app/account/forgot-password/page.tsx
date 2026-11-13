import type { Metadata } from "next";
import { Suspense } from "react";

import { RibbonLoader } from "@/components/brand/RibbonLoader";

import { ForgotPasswordForm } from "@/components/account/AuthForms";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };

export default function Page() {
  return (
    <Suspense fallback={<RibbonLoader />}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
