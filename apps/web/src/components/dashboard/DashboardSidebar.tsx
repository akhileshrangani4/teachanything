"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Trans, useTranslation } from "react-i18next";
import { useSession, type ExtendedUser } from "@/lib/auth-client";
import {
  LayoutDashboard,
  Bot,
  FileText,
  Settings,
  Shield,
  ScrollText,
  Globe,
  BookOpen,
} from "lucide-react";

const navigation = [
  {
    labelKey: "nav.dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    labelKey: "nav.chatbots",
    href: "/dashboard/chatbots",
    icon: Bot,
  },
  {
    labelKey: "nav.files",
    href: "/dashboard/files",
    icon: FileText,
  },
  {
    labelKey: "nav.webSources",
    href: "/dashboard/web-sources",
    icon: Globe,
  },
  {
    labelKey: "nav.settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
] as const;

interface DashboardSidebarProps {
  onNavigate?: () => void;
}

export function DashboardSidebar({ onNavigate }: DashboardSidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { t } = useTranslation();

  // Check if user is admin
  const user = session?.user as ExtendedUser | undefined;
  const isAdmin = user?.role === "admin";
  const isAdminActive = pathname === "/admin" || pathname?.startsWith("/admin");

  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-full overflow-hidden">
      {/* Navigation */}
      <div className="flex-1 flex flex-col pt-8 pb-4 overflow-y-auto">
        <nav className="flex-1 px-3 space-y-1">
          {navigation.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname?.startsWith(item.href)) ||
              (item.href === "/dashboard/chatbots" &&
                pathname?.startsWith("/chatbot"));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "group flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200 relative",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-sidebar-primary rounded-r-full" />
                )}
                <item.icon
                  className={cn(
                    "mr-3 h-5 w-5 flex-shrink-0 transition-colors",
                    isActive
                      ? "text-sidebar-primary"
                      : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground",
                  )}
                />
                <span
                  className={cn(
                    "transition-colors",
                    isActive && "font-semibold",
                  )}
                >
                  {t(item.labelKey)}
                </span>
              </Link>
            );
          })}

          {/* Admin Link - Only visible for admins */}
          {isAdmin && (
            <>
              <div className="my-2 mx-3 border-t border-sidebar-border" />
              <Link
                href="/admin"
                onClick={onNavigate}
                className={cn(
                  "group flex items-center px-3 py-3 text-sm font-medium rounded-lg transition-all duration-200 relative",
                  isAdminActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                )}
              >
                {isAdminActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-sidebar-primary rounded-r-full" />
                )}
                <Shield
                  className={cn(
                    "mr-3 h-5 w-5 flex-shrink-0 transition-colors",
                    isAdminActive
                      ? "text-sidebar-primary"
                      : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground",
                  )}
                />
                <span
                  className={cn(
                    "transition-colors",
                    isAdminActive && "font-semibold",
                  )}
                >
                  {t("nav.admin")}
                </span>
              </Link>
            </>
          )}
        </nav>
      </div>

      {/* Documentation + Privacy Policy links */}
      <div className="px-3 pb-2 flex-shrink-0 space-y-1">
        <a
          href="/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <BookOpen className="mr-3 h-4 w-4 flex-shrink-0 text-sidebar-foreground/40 group-hover:text-sidebar-foreground" />
          {t("nav.documentation")}
        </a>
        <Link
          href="/privacy-policy"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <ScrollText className="mr-3 h-4 w-4 flex-shrink-0 text-sidebar-foreground/40 group-hover:text-sidebar-foreground" />
          {t("nav.privacyPolicy")}
        </Link>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-sidebar-border flex-shrink-0">
        <p className="text-xs text-sidebar-foreground/50 font-medium">
          <Trans
            i18nKey="nav.builtBy"
            values={{ name: "Akhilesh Rangani" }}
            components={{
              a: (
                <a
                  href={
                    process.env.NEXT_PUBLIC_LINKEDIN_URL ||
                    "https://www.linkedin.com/in/akhileshrangani/"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sidebar-primary hover:underline font-medium"
                />
              ),
            }}
          />
        </p>
      </div>
    </aside>
  );
}
