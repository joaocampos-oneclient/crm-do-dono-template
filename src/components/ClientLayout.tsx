"use client";
import { ToastProvider } from "@/design-system-2027/components/overlay";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
