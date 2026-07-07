import "@material/web/tabs/tabs.js";
import "@material/web/tabs/primary-tab.js";
import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

interface TabsElement extends HTMLElement {
  activeTabIndex: number;
}

interface TabsProps {
  labels: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
}

export function Tabs({ labels, selectedIndex, onChange }: TabsProps) {
  const ref = useRef<TabsElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el && el.activeTabIndex !== selectedIndex) {
      el.activeTabIndex = selectedIndex;
    }
  }, [selectedIndex]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleChange = (event: Event) => {
      const target = event.target as TabsElement;
      onChange(target.activeTabIndex);
    };
    el.addEventListener("change", handleChange);
    return () => el.removeEventListener("change", handleChange);
  }, [onChange]);

  const themeStyle = {
    "--md-tabs-active-indicator-color": "var(--md-sys-color-primary)",
    "--md-tabs-label-text-color": "var(--md-sys-color-on-surface-variant)",
    "--md-tabs-active-label-text-color": "var(--md-sys-color-primary)",
  } as CSSProperties;

  return (
    <md-tabs ref={ref} style={themeStyle}>
      {labels.map((label) => (
        <md-primary-tab key={label}>{label}</md-primary-tab>
      ))}
    </md-tabs>
  );
}
