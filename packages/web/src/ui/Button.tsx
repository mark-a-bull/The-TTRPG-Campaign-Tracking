import "@material/web/button/filled-button.js";
import "@material/web/button/outlined-button.js";
import "@material/web/button/text-button.js";
import type { MouseEvent, ReactNode } from "react";

type ButtonVariant = "filled" | "outlined" | "text";

interface ButtonProps {
  variant?: ButtonVariant;
  children: ReactNode;
  onClick?: (event: MouseEvent) => void;
  disabled?: boolean;
  type?: "button" | "submit";
}

export function Button({ variant = "filled", children, onClick, disabled, type = "button" }: ButtonProps) {
  const commonProps = { onClick, disabled: disabled || undefined, type };
  if (variant === "outlined") {
    return <md-outlined-button {...commonProps}>{children}</md-outlined-button>;
  }
  if (variant === "text") {
    return <md-text-button {...commonProps}>{children}</md-text-button>;
  }
  return <md-filled-button {...commonProps}>{children}</md-filled-button>;
}
