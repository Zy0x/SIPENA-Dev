import type { PropsWithChildren } from "react";

export function Toast({ children }: PropsWithChildren) {
  return <div role="status">{children}</div>;
}
