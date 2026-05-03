import type { FormHTMLAttributes } from "react";

export function Form(props: FormHTMLAttributes<HTMLFormElement>) {
  return <form {...props} />;
}
