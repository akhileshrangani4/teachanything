"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProfileSection } from "@/components/dashboard/settings/ProfileSection";
import { InstitutionalSection } from "@/components/dashboard/settings/InstitutionalSection";
import { PasswordSection } from "@/components/dashboard/settings/PasswordSection";
import { DeleteAccountSection } from "@/components/dashboard/settings/DeleteAccountSection";
import { getSupportEmail } from "@/lib/constants/support-email";

export default function SettingsPage() {
  const supportEmail = getSupportEmail();

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8 min-h-0">
      <div className="w-full max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-muted-foreground text-sm">
            Manage your account settings
          </p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Account</CardTitle>
            <CardDescription>Your profile and contact details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ProfileSection />

            <div className="border-t pt-6">
              <h3 className="font-semibold mb-4">Institutional Information</h3>
              <InstitutionalSection />
            </div>

            <div className="border-t pt-6">
              <h3 className="font-semibold mb-4">Change Password</h3>
              <PasswordSection />
            </div>

            <div className="border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Need help?{" "}
                <a
                  href={`mailto:${supportEmail}`}
                  className="text-primary hover:underline"
                >
                  {supportEmail}
                </a>
              </p>
            </div>

            <div className="border-t pt-6">
              <DeleteAccountSection />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
