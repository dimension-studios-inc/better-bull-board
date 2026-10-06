import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "@better-bull-board/ui/globals.css"
import { Toaster } from "@better-bull-board/ui/components/sonner"
import { cn } from "cn"
import { headers } from "next/headers"
import { ThemeProvider } from "next-themes"
import { NuqsAdapter } from "nuqs/adapters/next/app"
import { AuthGuard } from "~/components/auth-guard"
import { env } from "~/lib/env"
import { Providers } from "./providers"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Better Bull Board",
  description: "A board to monitor your bullmq jobs",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const pathname = (await headers()).get("x-pathname") as string

  return (
    <html lang="en" className={cn("font-sans", geistSans.variable, geistMono.variable)} suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <NuqsAdapter>
            <Providers WEBSOCKET_URL={env.WEBSOCKET_URL}>
              <AuthGuard pathname={pathname}>{children}</AuthGuard>
            </Providers>
            <Toaster />
          </NuqsAdapter>
        </ThemeProvider>
      </body>
    </html>
  )
}
