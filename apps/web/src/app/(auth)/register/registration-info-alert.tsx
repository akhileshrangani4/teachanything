"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Trans } from "react-i18next";

/**
 * Admin-approval notice shown above the registration form. Surfaces the
 * approval contact address (and an optional support email) so new users
 * know what to expect and where to reach out.
 */
export function RegistrationInfoAlert() {
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return (
    <Alert className="mb-4">
      <AlertDescription>
        <Trans
          i18nKey="auth.register.infoAlert"
          values={{ adminEmail: "admin@teachanything.ai" }}
          components={{
            a: (
              <a
                href="mailto:admin@teachanything.ai"
                className="text-primary hover:underline"
              />
            ),
          }}
        />
        {contactEmail && (
          <>
            {" "}
            <Trans
              i18nKey="auth.register.infoContact"
              values={{ email: contactEmail }}
              components={{
                a: (
                  <a
                    href={`mailto:${contactEmail}`}
                    className="text-primary hover:underline"
                  />
                ),
              }}
            />
          </>
        )}
      </AlertDescription>
    </Alert>
  );
}
