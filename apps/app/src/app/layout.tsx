import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "~/components/sidebar";
import { Toaster } from "~/components/ui/sonner";
import { Providers } from "./providers";
import { AuthGuard } from "~/components/auth-guard";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Better Bull Board",
  description: "A board to monitor your bullmq jobs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <AuthGuard>
            {children}
          </AuthGuard>
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
