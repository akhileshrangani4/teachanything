import Image from "next/image";
import Link from "next/link";
import { BrandName } from "@/components/brand/BrandName";

export default function Footer() {
  return (
    <footer className="py-12 px-6 md:px-12 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link
              href="/login"
              className="hover:text-foreground transition-colors"
            >
              Login
            </Link>
            <Link
              href="#features"
              className="hover:text-foreground transition-colors"
            >
              Features
            </Link>
            <Link
              href={`mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL || ""}`}
              className="hover:text-foreground transition-colors"
            >
              Contact Us
            </Link>
            <Link
              href={
                process.env.NEXT_PUBLIC_GITHUB_URL ||
                "https://github.com/akhileshrangani4/teachanything"
              }
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="text-muted-foreground text-sm">GitHub</span>
            </Link>
            <Link
              href="/privacy-policy"
              className="hover:text-foreground transition-colors"
            >
              Privacy Policy
            </Link>
          </div>
          <div className="flex items-center gap-2.5 text-muted-foreground">
            <Image
              src="/assets/logos/dc-flag-bw.svg"
              alt="District of Columbia flag"
              width={40}
              height={30}
              className="opacity-80"
            />
            <p className="text-sm">
              © {new Date().getFullYear()}{" "}
              <BrandName markClassName="text-[0.45em] ml-0" />. All rights
              reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
