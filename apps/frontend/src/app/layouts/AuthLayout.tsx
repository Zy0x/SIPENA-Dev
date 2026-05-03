import type { PropsWithChildren } from "react";

export function AuthLayout({ children }: PropsWithChildren) {
  return <main className="min-h-dvh">{children}</main>;
}
