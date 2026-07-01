import type { DetailedHTMLProps, HTMLAttributes } from "react";

type CustomElementProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> &
  Record<string, unknown>;

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "md-filled-button": CustomElementProps;
      "md-outlined-button": CustomElementProps;
      "md-text-button": CustomElementProps;
      "md-outlined-text-field": CustomElementProps;
      "md-elevated-card": CustomElementProps;
      "md-outlined-card": CustomElementProps;
      "md-dialog": CustomElementProps;
      "md-tabs": CustomElementProps;
      "md-primary-tab": CustomElementProps;
      "md-icon-button": CustomElementProps;
      "md-icon": CustomElementProps;
      "md-circular-progress": CustomElementProps;
    }
  }
}
