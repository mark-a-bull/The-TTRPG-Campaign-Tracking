import "@material/web/dialog/dialog.js";
import { useEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";

interface DialogElement extends HTMLElement {
  open: boolean;
}

interface DialogProps {
  open: boolean;
  onClose: () => void;
  headline: string;
  children: ReactNode;
  actions?: ReactNode;
}

export function Dialog({ open, onClose, headline, children, actions }: DialogProps) {
  const ref = useRef<DialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.open = open;
    }
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleClosed = () => onClose();
    el.addEventListener("closed", handleClosed);
    return () => el.removeEventListener("closed", handleClosed);
  }, [onClose]);

  const themeStyle = {
    "--md-dialog-container-color": "var(--md-sys-color-surface)",
    "--md-dialog-headline-color": "var(--md-sys-color-on-surface)",
  } as CSSProperties;

  return (
    <md-dialog ref={ref} style={themeStyle}>
      <div slot="headline">{headline}</div>
      {/* A plain div, not <form method="dialog"> — md-dialog's open/close/ESC/
          backdrop handling is entirely internal and doesn't need a form
          wrapper, and every close in this app goes through explicit onClick
          handlers. A form wrapper here also breaks when a Dialog is nested
          inside another Dialog's content (invalid nested <form> elements). */}
      <div slot="content">{children}</div>
      {actions ? <div slot="actions">{actions}</div> : null}
    </md-dialog>
  );
}
