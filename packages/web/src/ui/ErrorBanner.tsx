interface ErrorBannerProps {
  message: string;
  onDismiss: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 12px",
        borderRadius: 8,
        background: "var(--md-sys-color-error)",
        color: "var(--md-sys-color-on-error)",
        fontSize: 13,
      }}
    >
      <div style={{ flex: 1 }}>{message}</div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss error"
        style={{
          border: "none",
          background: "none",
          color: "inherit",
          cursor: "pointer",
          fontSize: 16,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}

/** Extracts a user-facing message from a TanStack Query mutation error. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}
