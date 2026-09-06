"use client";

import { AuthCardSkeleton } from "@/components/ui/skeletons";
import { Suspense } from "react";
import { ResetPasswordContent } from "./reset-password-content";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthCardSkeleton titleWidth="w-36" />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
