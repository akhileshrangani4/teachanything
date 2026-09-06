"use client";

import { Badge } from "@/components/ui/badge";

// Read-only list of domains configured via server environment variables.
export function EnvDomainsSection({ domains }: { domains: string[] }) {
  return (
    <div className="space-y-3 pt-6 border-t">
      <div>
        <h3 className="text-sm font-semibold mb-1">Environment Domains</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Read-only domains from server configuration (APPROVED_EMAIL_DOMAINS).
          These are &quot;built-in defaults&quot; that require backend access to
          modify. You can manage your own custom domains using the &quot;Add
          Domain&quot; button above. All domains (both environment and database)
          work together to allow user registrations.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {domains.map((domain, index) => (
          <Badge key={`env-${index}`} variant="outline" className="font-mono">
            {domain}
          </Badge>
        ))}
      </div>
    </div>
  );
}
