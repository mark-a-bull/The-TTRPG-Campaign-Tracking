import "@material/web/labs/card/elevated-card.js";
import type { CSSProperties, MouseEvent, ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  onClick?: (event: MouseEvent) => void;
  style?: CSSProperties;
}

export function Card({ children, onClick, style }: CardProps) {
  return (
    <md-elevated-card
      onClick={onClick}
      style={{ display: "block", cursor: onClick ? "pointer" : undefined, ...style }}
    >
      {children}
    </md-elevated-card>
  );
}
