import { usePlayers } from "../api/players.js";

interface PcPlayerFieldProps {
  value: string | null;
  onChange: (value: string | null) => void;
  readOnly?: boolean;
}

export function PcPlayerField({ value, onChange, readOnly }: PcPlayerFieldProps) {
  const { data: players } = usePlayers();

  if (readOnly) {
    const playerName = value ? (players?.find((player) => player.id === value)?.name ?? "Unknown") : "None";
    return (
      <div>
        <div style={{ fontSize: 12, color: "var(--md-sys-color-on-surface-variant)" }}>Player</div>
        <div style={{ fontSize: 16 }}>{playerName}</div>
      </div>
    );
  }

  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 12, color: "var(--md-sys-color-on-surface-variant)" }}>Player</span>
      <select value={value ?? ""} onChange={(event) => onChange(event.target.value || null)}>
        <option value="">None</option>
        {(players ?? []).map((player) => (
          <option key={player.id} value={player.id}>
            {player.name}
          </option>
        ))}
      </select>
    </label>
  );
}
