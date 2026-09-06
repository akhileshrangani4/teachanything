"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * Admin-approval notice shown above the registration form. Surfaces the
 * approval contact address (and an optional support email) so new users
 * know what to expect and where to reach out.
 */
export function RegistrationInfoAlert() {
  return (
    <Alert className="mb-4">
      <AlertDescription>
        All accounts require admin approval before you can log in. You&apos;ll
        receive an email once your account is approved. After signing up, please
        check your inbox and spam folder for approval emails from{" "}
        <a
          href="mailto:admin@teachanything.ai"
          className="text-primary hover:underline"
        >
          admin@teachanything.ai
        </a>
        . To make sure you receive updates, please add this address to your
        contacts.
        {process.env.NEXT_PUBLIC_CONTACT_EMAIL && (
          <>
            {" "}
            If you have any questions, please contact us at{" "}
            <a
              href={`mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL}`}
              className="text-primary hover:underline"
            >
              {process.env.NEXT_PUBLIC_CONTACT_EMAIL}
            </a>
          </>
        )}
      </AlertDescription>
    </Alert>
  );
}
