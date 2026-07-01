import type { ReactNode } from "react";

interface TopAppBarProps {
  title: string;
  leading?: ReactNode;
  trailing?: ReactNode;
}

/**
 * @material/web doesn't ship a top app bar component (M3's app-bar/navigation
 * components were never migrated from the legacy MWC library), so this is a
 * hand-built layout piece using the same M3 color tokens as the MWC components.
 */
export function TopAppBar({ title, leading, trailing }: TopAppBarProps) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: 64,
        padding: "0 16px",
        background: "var(--md-sys-color-surface)",
        color: "var(--md-sys-color-on-surface)",
        borderBottom: "1px solid var(--md-sys-color-outline-variant)",
      }}
    >
      {leading}
      <span style={{ fontSize: 22, fontWeight: 400, flex: 1 }}>{title}</span>
      {trailing}
    </header>
  );
}
