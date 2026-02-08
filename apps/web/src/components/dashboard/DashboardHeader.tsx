"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession, signOut, type ExtendedUser } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  LayoutDashboard,
  Bot,
  FileText,
  Settings,
  LogOut,
  Shield,
  Menu,
} from "lucide-react";
import { toast } from "sonner";
import { useSidebar } from "@/components/dashboard/sidebar-context";

export function DashboardHeader() {
  const { data: session } = useSession();
  const router = useRouter();
  const { setIsOpen } = useSidebar();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out successfully");
    router.push("/login");
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Check if user is admin
  const user = session?.user as ExtendedUser | undefined;
  const isAdmin = user?.role === "admin";

  return (
    <header className="h-16 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 flex items-center justify-between px-4 md:px-6 shadow-sm">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsOpen(true)}
          className="lg:hidden p-2 -ml-2 rounded-md hover:bg-muted transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5 text-foreground" />
        </button>
        <Link
          href="/"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <Image
            src="/logo.svg"
            alt="Teach anything"
            width={28}
            height={28}
            className="h-7 w-7"
          />
          <span className="text-xl font-bold text-foreground">
            Teach{" "}
            <i
              style={{
                fontFamily: "var(--font-instrument-serif), serif",
                fontWeight: 400,
              }}
            >
              anything.
            </i>
          </span>
        </Link>
        <Link
          href={`mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL || ""}`}
          className="ml-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium hidden md:inline-block"
        >
          Support
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-full">
              <Avatar className="h-9 w-9 ring-2 ring-border hover:ring-primary/50 transition-all">
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-sm font-semibold">
                  {getInitials(session?.user.name)}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem asChild>
              <Link
                href="/dashboard"
                className="flex items-center gap-2 cursor-pointer"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href="/dashboard/chatbots"
                className="flex items-center gap-2 cursor-pointer"
              >
                <Bot className="h-4 w-4" />
                Chatbots
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href="/dashboard/files"
                className="flex items-center gap-2 cursor-pointer"
              >
                <FileText className="h-4 w-4" />
                Files
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href="/dashboard/settings"
                className="flex items-center gap-2 cursor-pointer"
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link
                    href="/admin"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Shield className="h-4 w-4" />
                    Admin
                  </Link>
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
