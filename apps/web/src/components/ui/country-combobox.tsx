"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { COUNTRY_OPTIONS } from "@/lib/constants/country-options";
import { useTranslation } from "react-i18next";
import { DEFAULT_LOCALE } from "@/i18n/config";

interface CountryComboboxProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export function CountryCombobox({
  value,
  onValueChange,
  disabled,
}: CountryComboboxProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  // The stored value stays the English name; only the display is translated.
  const options = useMemo(() => {
    const language = i18n.language;
    const displayNames = new Intl.DisplayNames(language, { type: "region" });
    return COUNTRY_OPTIONS.map((option) => ({
      ...option,
      name:
        language === DEFAULT_LOCALE
          ? option.label
          : (displayNames.of(option.code) ?? option.label),
    })).sort((a, b) => a.name.localeCompare(b.name, language));
  }, [i18n.language]);
  const selected = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
          type="button"
        >
          {selected?.name ?? (value || t("common.country.placeholder"))}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder={t("common.country.search")} />
          <CommandList>
            <CommandEmpty>{t("common.country.empty")}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  keywords={[option.name]}
                  onSelect={(val) => {
                    onValueChange(val);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {option.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
