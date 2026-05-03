import type { PropsWithChildren } from "react";

export function Modal({ children }: PropsWithChildren) {
  return <div role="dialog">{children}</div>;
}
