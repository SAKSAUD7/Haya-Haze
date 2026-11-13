import type { Metadata } from "next";
import { Suspense } from "react";

import { RibbonLoader } from "@/components/brand/RibbonLoader";

import { ResetPasswordForm } from "@/components/account/AuthForms";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default function Page() {
  return (
    <Suspense fallback={<RibbonLoader />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
