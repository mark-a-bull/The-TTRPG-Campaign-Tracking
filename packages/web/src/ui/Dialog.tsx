import "@material/web/dialog/dialog.js";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

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

  return (
    <md-dialog ref={ref}>
      <div slot="headline">{headline}</div>
      <form slot="content" method="dialog">
        {children}
      </form>
      {actions ? <div slot="actions">{actions}</div> : null}
    </md-dialog>
  );
}
