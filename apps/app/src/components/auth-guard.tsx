"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sidebar } from "~/components/sidebar";
import { useAuth } from "~/lib/auth/context";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user && pathname !== "/login") {
      router.push("/login");
    }
  }, [user, loading, router, pathname]);

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // If not authenticated and not on login page, don't render children
  if (!user && pathname !== "/login") {
    return null;
  }

  // If authenticated and on login page, redirect to home
  if (user && pathname === "/login") {
    router.push("/");
    return null;
  }

  // If on login page, render without sidebar
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // For authenticated users on other pages, render with full layout
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
