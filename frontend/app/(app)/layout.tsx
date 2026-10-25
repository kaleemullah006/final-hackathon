import { Suspense } from "react";
import "./app-shell.css";
import AppShell from "@/components/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // The shell reads the current URL, so Next.js needs a Suspense boundary above it
  return (
    <Suspense
      fallback={
        <div className="hx-root">
          <div className="hx-content">
            <p className="hx-loading">Loading...</p>
          </div>
        </div>
      }
    >
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
