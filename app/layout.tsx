import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TAGLINE =
  "Your product ranks #1 on Google. Where does it rank with an agent?";

export const metadata: Metadata = {
  title: {
    default: "AgentRank — agent readiness for product content",
    template: "%s · AgentRank",
  },
  description: TAGLINE,
  applicationName: "AgentRank",
  openGraph: {
    title: "AgentRank",
    description: TAGLINE,
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "AgentRank", description: TAGLINE },
};

export const viewport: Viewport = {
  themeColor: "#06070a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bench min-h-full flex flex-col">
        <div className="relative z-10 flex min-h-full flex-1 flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
