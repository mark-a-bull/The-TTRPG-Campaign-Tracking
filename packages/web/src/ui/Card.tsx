import "@material/web/labs/card/elevated-card.js";
import type { CSSProperties, MouseEvent, ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  onClick?: (event: MouseEvent) => void;
  style?: CSSProperties;
}

export function Card({ children, onClick, style }: CardProps) {
  const themeStyle = {
    display: "block",
    cursor: onClick ? "pointer" : undefined,
    "--md-elevated-card-container-color": "var(--md-sys-color-surface)",
    "--md-elevated-card-container-shape": "12px",
    ...style,
  } as CSSProperties;

  return (
    <md-elevated-card onClick={onClick} style={themeStyle}>
      {children}
    </md-elevated-card>
  );
}
