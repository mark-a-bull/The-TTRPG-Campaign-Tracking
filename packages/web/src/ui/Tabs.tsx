import "@material/web/tabs/tabs.js";
import "@material/web/tabs/primary-tab.js";
import { useEffect, useRef } from "react";

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

  return (
    <md-tabs ref={ref}>
      {labels.map((label) => (
        <md-primary-tab key={label}>{label}</md-primary-tab>
      ))}
    </md-tabs>
  );
}
