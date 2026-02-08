"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CountryCombobox } from "@/components/ui/country-combobox";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { TITLE_OPTIONS } from "@/lib/constants/title-options";

/**
 * Resolves a stored title to dropdown selection + custom value.
 * If the title matches a predefined option, returns its value.
 * Otherwise, treats it as a custom "other" title.
 */
function parseTitleForForm(title: string | null): {
  selection: string;
  custom: string;
} {
  if (!title) return { selection: "", custom: "" };
  const match = TITLE_OPTIONS.find((opt) => opt.label === title);
  return match
    ? { selection: match.value, custom: "" }
    : { selection: "other", custom: title };
}

/**
 * Converts form selection back to the stored title string.
 */
function resolveTitleFromForm(selection: string, custom: string): string {
  if (selection === "other") return custom.trim();
  return TITLE_OPTIONS.find((opt) => opt.value === selection)?.label ?? "";
}

/**
 * Parent component: fetches profile data and renders form once loaded.
 * This pattern ensures the form initializes with correct values.
 */
export function InstitutionalSection() {
  const { data: profile, isLoading } = trpc.auth.getProfile.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  if (!profile) {
    return <p className="text-sm text-destructive">Failed to load profile</p>;
  }

  const titleData = parseTitleForForm(profile.title);

  return (
    <InstitutionalForm
      key={profile.id}
      initial={{
        titleSelection: titleData.selection,
        customTitle: titleData.custom,
        institution: profile.institutionalAffiliation ?? "",
        department: profile.department ?? "",
        country: profile.country ?? "",
        webpage: profile.facultyWebpage ?? "",
      }}
      saved={{
        title: profile.title ?? "",
        institution: profile.institutionalAffiliation ?? "",
        department: profile.department ?? "",
        country: profile.country ?? "",
        webpage: profile.facultyWebpage ?? "",
      }}
    />
  );
}

interface FormValues {
  titleSelection: string;
  customTitle: string;
  institution: string;
  department: string;
  country: string;
  webpage: string;
}

interface SavedValues {
  title: string;
  institution: string;
  department: string;
  country: string;
  webpage: string;
}

/**
 * Form component that manages local state for editing.
 * Receives initial values as props to avoid async state initialization issues.
 */
function InstitutionalForm({
  initial,
  saved,
}: {
  initial: FormValues;
  saved: SavedValues;
}) {
  const [form, setForm] = useState<FormValues>(initial);
  const utils = trpc.useUtils();

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Information updated");
      utils.auth.getProfile.invalidate();
    },
    onError: (error) =>
      toast.error("Failed to update", { description: error.message }),
  });

  // Derive current title and check for changes
  const currentTitle = resolveTitleFromForm(form.titleSelection, form.customTitle);
  const hasChanges =
    currentTitle !== saved.title ||
    form.institution !== saved.institution ||
    form.department !== saved.department ||
    form.country !== saved.country ||
    form.webpage !== saved.webpage;

  const updateField = <K extends keyof FormValues>(
    field: K,
    value: FormValues[K]
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!form.titleSelection) {
      return toast.error("Title is required");
    }
    if (form.titleSelection === "other" && !form.customTitle.trim()) {
      return toast.error("Please enter your title");
    }
    if (!form.institution.trim()) {
      return toast.error("Institution is required");
    }
    if (!form.department.trim()) {
      return toast.error("Department is required");
    }
    if (!form.country.trim()) {
      return toast.error("Country is required");
    }
    if (!form.webpage.trim()) {
      return toast.error("University webpage is required");
    }

    // URL validation
    try {
      new URL(form.webpage.trim());
    } catch {
      return toast.error("Please enter a valid URL");
    }

    updateProfile.mutate({
      title: currentTitle,
      institutionalAffiliation: form.institution.trim(),
      department: form.department.trim(),
      country: form.country.trim(),
      facultyWebpage: form.webpage.trim(),
    });
  };

  const isPending = updateProfile.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Title */}
        <div className="space-y-2">
          <Label>Title</Label>
          <Select
            value={form.titleSelection}
            onValueChange={(value) => {
              updateField("titleSelection", value);
              if (value !== "other") updateField("customTitle", "");
            }}
            disabled={isPending}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select title" />
            </SelectTrigger>
            <SelectContent>
              {TITLE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.titleSelection === "other" && (
            <Input
              placeholder="Enter title"
              value={form.customTitle}
              onChange={(e) => updateField("customTitle", e.target.value)}
              disabled={isPending}
            />
          )}
        </div>

        {/* Institution */}
        <div className="space-y-2">
          <Label>Institution</Label>
          <Input
            placeholder="University of Example"
            value={form.institution}
            onChange={(e) => updateField("institution", e.target.value)}
            disabled={isPending}
          />
        </div>

        {/* Department */}
        <div className="space-y-2">
          <Label>Department</Label>
          <Input
            placeholder="Computer Science"
            value={form.department}
            onChange={(e) => updateField("department", e.target.value)}
            disabled={isPending}
          />
        </div>

        {/* Country */}
        <div className="space-y-2">
          <Label>Country</Label>
          <CountryCombobox
            value={form.country}
            onValueChange={(value) => updateField("country", value)}
            disabled={isPending}
          />
        </div>

        {/* University Webpage */}
        <div className="space-y-2">
          <Label>University webpage about you</Label>
          <Input
            type="url"
            placeholder="university.edu/your-name"
            value={form.webpage}
            onChange={(e) => updateField("webpage", e.target.value)}
            onBlur={(e) => {
              const val = e.target.value.trim();
              if (val && !/^https?:\/\//i.test(val)) {
                updateField("webpage", `https://${val}`);
              }
            }}
            disabled={isPending}
          />
        </div>
      </div>

      <Button type="submit" disabled={isPending || !hasChanges} size="sm">
        {isPending ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            Saving...
          </>
        ) : (
          <>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </>
        )}
      </Button>
    </form>
  );
}
