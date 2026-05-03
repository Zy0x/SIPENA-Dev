import type { PropsWithChildren } from "react";

// Theme runtime masih dikelola oleh CSS dan preference existing.
export function ThemeProvider({ children }: PropsWithChildren) {
  return <>{children}</>;
}
