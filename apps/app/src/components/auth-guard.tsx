import { Sidebar } from "~/components/sidebar";
import { getAuthenticatedUser } from "~/lib/auth/server";

interface AuthGuardProps {
  children: React.ReactNode;
  pathname: string;
}

export async function AuthGuard({ children, pathname }: AuthGuardProps) {
  const user = await getAuthenticatedUser();

  if (!user && pathname !== "/login") {
    return null;
  }

  if (pathname === "/login") {
    // If on login page, render without sidebar
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
