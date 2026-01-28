import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { headers } from "next/headers";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { AuthGuard } from "~/components/auth-guard";
import { Toaster } from "~/components/ui/sonner";
import { env } from "~/lib/env";
import { Providers } from "./providers";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = (await headers()).get("x-pathname") as string;

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <NuqsAdapter>
          <Providers WEBSOCKET_URL={env.WEBSOCKET_URL}>
            <AuthGuard pathname={pathname}>{children}</AuthGuard>
          </Providers>
          <Toaster />
        </NuqsAdapter>
      </body>
    </html>
  );
}
