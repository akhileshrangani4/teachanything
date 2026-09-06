"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";

const DOMAIN_EXAMPLES = [
  { domain: ".edu", label: "US educational institutions" },
  { domain: ".edu.tw", label: "Taiwan educational institutions" },
  { domain: ".ac.uk", label: "UK academic institutions" },
  { domain: ".de", label: "All German domains (broad access)" },
  { domain: "stanford.edu", label: "Only Stanford University" },
  { domain: "uni-bonn.de", label: "Only University of Bonn" },
  { domain: "gmail.com", label: "Gmail addresses only" },
  { domain: "outlook.com", label: "Outlook/Hotmail addresses only" },
] as const;

// Explainer alert listing example allowlist patterns.
export function DomainsInfoAlert() {
  return (
    <Alert className="mb-6">
      <AlertDescription>
        <div className="space-y-2">
          <p>
            Users with email addresses from these domains can register for an
            account. They will still require manual admin approval before
            accessing the platform. You can add your own custom domains below,
            which will work alongside any environment domains shown at the
            bottom. If no domains are configured, all email domains are allowed
            to register.
          </p>
          <div className="pt-2 text-xs">
            <p className="font-semibold mb-1">Examples:</p>
            <ul className="list-disc list-inside space-y-0.5 ml-2 text-xs">
              {DOMAIN_EXAMPLES.map(({ domain, label }) => (
                <li key={domain}>
                  <code className="bg-muted px-1 py-0.5 rounded text-xs">
                    {domain}
                  </code>{" "}
                  - {label}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground mt-3">
              Specific domains are always allowed (gmail.com, akhilesh.tech){" "}
              <b>if you ever need to add them.</b> Only broad patterns (.com,
              .net, .org, .io) are blocked.
            </p>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}
