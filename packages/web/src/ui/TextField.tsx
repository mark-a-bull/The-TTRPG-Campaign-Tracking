import "@material/web/textfield/outlined-text-field.js";
import { useEffect, useRef } from "react";

interface TextFieldElement extends HTMLElement {
  value: string;
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "url";
  required?: boolean;
  multiline?: boolean;
  rows?: number;
  errorText?: string;
}

export function TextField({
  label,
  value,
  onChange,
  type = "text",
  required,
  multiline,
  rows,
  errorText,
}: TextFieldProps) {
  const ref = useRef<TextFieldElement>(null);

  // MWC's `value` is a JS property, not a reflected attribute, so it must be
  // synced imperatively rather than passed as a JSX prop.
  useEffect(() => {
    const el = ref.current;
    if (el && el.value !== value) {
      el.value = value;
    }
  }, [value]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleInput = (event: Event) => {
      onChange((event.target as TextFieldElement).value);
    };
    el.addEventListener("input", handleInput);
    return () => el.removeEventListener("input", handleInput);
  }, [onChange]);

  return (
    <md-outlined-text-field
      ref={ref}
      label={label}
      type={multiline ? "textarea" : type}
      rows={multiline ? rows ?? 4 : undefined}
      required={required || undefined}
      error={Boolean(errorText) || undefined}
      error-text={errorText}
      style={{ width: "100%" }}
    />
  );
}
