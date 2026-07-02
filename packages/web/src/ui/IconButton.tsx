import "@material/web/iconbutton/icon-button.js";
import "@material/web/icon/icon.js";
import type { MouseEvent } from "react";

interface IconButtonProps {
  /** Material Symbols ligature name, e.g. "edit", "delete". */
  icon: string;
  label: string;
  onClick: (event: MouseEvent) => void;
}

export function IconButton({ icon, label, onClick }: IconButtonProps) {
  return (
    <md-icon-button aria-label={label} onClick={onClick}>
      <md-icon>{icon}</md-icon>
    </md-icon-button>
  );
}
