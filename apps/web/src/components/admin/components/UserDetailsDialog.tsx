"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  User,
  Mail,
  Building2,
  GraduationCap,
  Globe,
  MapPin,
  Calendar,
  ExternalLink,
} from "lucide-react";
import type { UserDetailsData } from "../types/user-details";

interface UserDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserDetailsData | null;
}

export function UserDetailsDialog({
  open,
  onOpenChange,
  user,
}: UserDetailsDialogProps) {
  if (!user) return null;

  // Title is now stored as the display label (e.g., "Professor", "Dr") or custom value
  const titleLabel = user.title;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            User Verification Details
          </DialogTitle>
          <DialogDescription>
            Review the information below to verify this user&apos;s identity.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title & Name */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <User className="h-3 w-3" />
              Title & Full Name
            </label>
            <p className="text-sm font-medium">
              {titleLabel ? `${titleLabel} ` : ""}
              {user.name || "Not provided"}
            </p>
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Mail className="h-3 w-3" />
              University Email
            </label>
            <p className="text-sm">{user.email}</p>
          </div>

          {/* Institution */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              Institutional Affiliation
            </label>
            <p className="text-sm">
              {user.institutionalAffiliation || (
                <span className="text-muted-foreground italic">
                  Not provided
                </span>
              )}
            </p>
          </div>

          {/* Department */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <GraduationCap className="h-3 w-3" />
              Department
            </label>
            <p className="text-sm">
              {user.department || (
                <span className="text-muted-foreground italic">
                  Not provided
                </span>
              )}
            </p>
          </div>

          {/* Country */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Country
            </label>
            <p className="text-sm">
              {user.country || (
                <span className="text-muted-foreground italic">
                  Not provided
                </span>
              )}
            </p>
          </div>

          {/* University Webpage */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Globe className="h-3 w-3" />
              University Webpage About You
            </label>
            {user.facultyWebpage ? (
              <Button variant="outline" size="sm" className="gap-2 h-8" asChild>
                <a
                  href={user.facultyWebpage}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Visit Webpage
                </a>
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Not provided
              </p>
            )}
          </div>

          {/* Status and Registration Date */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  user.status === "approved"
                    ? "default"
                    : user.status === "rejected"
                      ? "destructive"
                      : "secondary"
                }
              >
                {user.status}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {new Date(user.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
