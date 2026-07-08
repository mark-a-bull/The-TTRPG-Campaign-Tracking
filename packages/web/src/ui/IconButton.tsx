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
    // type="button" is required, not just a default-matching nicety: Dialog
    // wraps its content in a native <form method="dialog">, and md-icon-button
    // defaults to type="submit" like a native button — without this, clicking
    // it inside a Dialog submits the form and silently closes the dialog.
    <md-icon-button type="button" aria-label={label} onClick={onClick}>
      <md-icon>{icon}</md-icon>
    </md-icon-button>
  );
}
