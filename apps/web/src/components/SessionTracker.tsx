"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { QueryClient } from "@tanstack/react-query";

export function SessionTracker({ queryClient }: { queryClient: QueryClient }) {
  const { data: session, isPending } = useSession();
  // undefined until the session is first known, so a page load is not a new user.
  const previousUserIdRef = useRef<string | null | undefined>(undefined);
  const router = useRouter();

  useEffect(() => {
    if (isPending) return;

    const currentUserId = session?.user?.id || null;
    const previousUserId = previousUserIdRef.current;

    // If user changed (logged in, logged out, or switched accounts)
    if (previousUserId !== undefined && previousUserId !== currentUserId) {
      // Clear all cached queries
      queryClient.clear();
      // Server layouts chose their language for the previous user
      router.refresh();
    }

    // Update the ref to track the current user
    previousUserIdRef.current = currentUserId;
  }, [session?.user?.id, isPending, queryClient, router]);

  return null;
}
