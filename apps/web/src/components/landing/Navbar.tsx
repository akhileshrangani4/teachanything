"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth-client";
import { Menu, X } from "lucide-react";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { data: session, isPending } = useSession();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const href = e.currentTarget.getAttribute("href");
    if (href && href.startsWith("#")) {
      e.preventDefault();
      const id = href.slice(1);
      const element = document.getElementById(id);
      if (element) {
        const offset = 80; // Account for fixed navbar
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - offset;

        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth",
        });
      }
    }
    setMobileMenuOpen(false);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-3 px-4 md:px-6">
      <div
        className={`w-full max-w-7xl mx-auto transition-all duration-500 ease-out ${
          scrolled || mobileMenuOpen
            ? "bg-white/15 backdrop-blur-xl rounded-2xl md:rounded-full shadow-md border border-white/30"
            : "bg-transparent"
        }`}
      >
        <div className="px-4 md:px-8 lg:px-16">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex-shrink-0">
              <Link
                href="/"
                className="flex items-center gap-2 hover:opacity-80 transition-opacity duration-200"
              >
                <Image
                  src="/logo.svg"
                  alt="Teach anything"
                  width={32}
                  height={32}
                  className="h-8 w-8"
                  priority
                />
                <span className="text-xl font-base font-bold text-foreground">
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
            </div>

            {/* Navigation Links - Center (Desktop) */}
            <div className="hidden md:flex items-center space-x-8 absolute left-1/2 transform -translate-x-1/2">
              <Link
                href="#features"
                onClick={handleAnchorClick}
                className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors duration-200"
              >
                Features
              </Link>
              <Link
                href="#how-it-works"
                onClick={handleAnchorClick}
                className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors duration-200"
              >
                How It Works
              </Link>
              <Link
                href="#support-us"
                onClick={handleAnchorClick}
                className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors duration-200"
              >
                Support Us
              </Link>
              <a
                href={
                  process.env.NEXT_PUBLIC_GITHUB_URL ||
                  "https://github.com/akhileshrangani4/teachanything"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors duration-200"
              >
                GitHub
              </a>
            </div>

            {/* Sign In and Sign Up / Dashboard - Upper Right (Desktop) */}
            <div className="hidden md:flex items-center gap-4">
              {isPending ? (
                <div className="h-9 w-24 bg-white/50 rounded-lg animate-pulse border border-foreground/10" />
              ) : session ? (
                <Button
                  asChild
                  className="bg-white hover:bg-white/90 text-foreground px-5 py-2 text-sm rounded-lg font-medium border border-foreground/20 transition-all duration-200"
                >
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors duration-200"
                  >
                    Sign In
                  </Link>
                  <Button
                    asChild
                    className="bg-white hover:bg-white/90 text-foreground px-5 py-2 text-sm rounded-lg font-medium border border-foreground/20 transition-all duration-200"
                  >
                    <Link href="/register">Sign Up</Link>
                  </Button>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-white/10 transition-colors duration-200"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6 text-foreground" />
              ) : (
                <Menu className="h-6 w-6 text-foreground" />
              )}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden pb-4 border-t border-white/10 mt-2 pt-4">
              <div className="flex flex-col space-y-3">
                <Link
                  href="#features"
                  onClick={handleAnchorClick}
                  className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors duration-200 px-2 py-2"
                >
                  Features
                </Link>
                <Link
                  href="#how-it-works"
                  onClick={handleAnchorClick}
                  className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors duration-200 px-2 py-2"
                >
                  How It Works
                </Link>
                <Link
                  href="#support-us"
                  onClick={handleAnchorClick}
                  className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors duration-200 px-2 py-2"
                >
                  Support Us
                </Link>
                <a
                  href={
                    process.env.NEXT_PUBLIC_GITHUB_URL ||
                    "https://github.com/akhileshrangani4/teachanything"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors duration-200 px-2 py-2"
                >
                  GitHub
                </a>

                {/* Mobile Auth Buttons */}
                <div className="flex flex-col gap-2 pt-3 border-t border-white/10">
                  {isPending ? (
                    <div className="h-9 w-full bg-white/50 rounded-lg animate-pulse border border-foreground/10" />
                  ) : session ? (
                    <Button
                      asChild
                      className="bg-white hover:bg-white/90 text-foreground px-5 py-2 text-sm rounded-lg font-medium border border-foreground/20 transition-all duration-200 w-full"
                    >
                      <Link href="/dashboard">Dashboard</Link>
                    </Button>
                  ) : (
                    <>
                      <Button
                        asChild
                        variant="outline"
                        className="w-full text-sm font-medium border-foreground/20"
                      >
                        <Link href="/login">Sign In</Link>
                      </Button>
                      <Button
                        asChild
                        className="bg-white hover:bg-white/90 text-foreground px-5 py-2 text-sm rounded-lg font-medium border border-foreground/20 transition-all duration-200 w-full"
                      >
                        <Link href="/register">Sign Up</Link>
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
