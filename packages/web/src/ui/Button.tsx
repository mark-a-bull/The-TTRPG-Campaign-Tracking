import "@material/web/button/filled-button.js";
import "@material/web/button/outlined-button.js";
import "@material/web/button/text-button.js";
import type { CSSProperties, MouseEvent, ReactNode } from "react";

type ButtonVariant = "filled" | "outlined" | "text";

interface ButtonProps {
  variant?: ButtonVariant;
  children: ReactNode;
  onClick?: (event: MouseEvent) => void;
  disabled?: boolean;
  type?: "button" | "submit";
}

const themeStyle: CSSProperties = {
  "--md-filled-button-container-color": "var(--md-sys-color-primary)",
  "--md-filled-button-label-text-color": "var(--md-sys-color-on-primary)",
  "--md-outlined-button-container-color": "transparent",
  "--md-outlined-button-label-text-color": "var(--md-sys-color-primary)",
  "--md-outlined-button-outline-color": "var(--md-sys-color-outline)",
  "--md-text-button-label-text-color": "var(--md-sys-color-primary)",
} as CSSProperties;

export function Button({ variant = "filled", children, onClick, disabled, type = "button" }: ButtonProps) {
  const commonProps = { onClick, disabled: disabled || undefined, type };

  if (variant === "outlined") {
    return <md-outlined-button style={themeStyle} {...commonProps}>{children}</md-outlined-button>;
  }
  if (variant === "text") {
    return <md-text-button style={themeStyle} {...commonProps}>{children}</md-text-button>;
  }
  return <md-filled-button style={themeStyle} {...commonProps}>{children}</md-filled-button>;
}
