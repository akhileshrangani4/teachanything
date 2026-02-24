import type { Metadata } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Providers } from "@/lib/providers";

const inter = Inter({ subsets: ["latin"] });
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-instrument-serif",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ),
  title: {
    default: "Teach Anything — Open Source LLMs for Open Access Education",
    template: "%s | Teach Anything",
  },
  description:
    "Build open-access, course-specific, multilingual AI chatbots using open-source LLMs for your students—all for free. This platform is designed by educators for educators. Professors are designers, not consumers.",
  keywords: [
    "open source LLM",
    "open access education",
    "AI chatbot",
    "education technology",
    "multilingual AI",
    "course-specific chatbot",
    "RAG",
    "retrieval-augmented generation",
    "course materials",
    "educational AI",
    "chatbot platform",
    "Llama 3.3",
    "Mistral Large",
    "Qwen 2.5",
  ],
  authors: [{ name: "Teach Anything Team" }],
  creator: "Teach Anything",
  publisher: "Teach Anything",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Teach Anything",
    title: "Teach Anything — Open Source LLMs for Open Access Education",
    description:
      "Build open-access, course-specific, multilingual AI chatbots using open-source LLMs for your students—all for free. Designed by educators for educators.",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "Teach Anything — Open Source LLMs for Open Access Education",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Teach Anything — Open Source LLMs for Open Access Education",
    description:
      "Build open-access, course-specific, multilingual AI chatbots using open-source LLMs for your students—all for free. Designed by educators for educators.",
    images: ["/logo.png"],
    creator: "@teachanything",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [{ url: "/logo.svg", type: "image/svg+xml" }],
    apple: [{ url: "/logo.png", type: "image/png", sizes: "180x180" }],
    shortcut: "/logo.svg",
  },
  category: "education",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${instrumentSerif.variable}`}>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
