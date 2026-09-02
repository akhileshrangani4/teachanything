"use client";

import { AuthCardSkeleton } from "@/components/ui/skeletons";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();

  // Redirect to dashboard if already signed in
  useEffect(() => {
    if (!sessionLoading && session) {
      router.push("/dashboard");
    }
  }, [session, sessionLoading, router]);

  // Don't render registration form if session is loading or user is already authenticated
  if (sessionLoading || session) {
    return (
      <AuthCardSkeleton
        fields={4}
        titleWidth="w-36"
        descWidth="w-64"
        className="px-4 py-8"
      />
    );
  }

  return <RegisterForm />;
}
