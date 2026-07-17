import type { Location } from "@ttrpg/shared";
import { locationHooks } from "../api/entities.js";

interface LocationParentFieldProps {
  campaignId: string;
  /** undefined on create -- a brand-new location has no descendants yet, so
   * nothing needs excluding from the picker in that case. */
  currentId: string | undefined;
  value: string | null;
  onChange: (value: string | null) => void;
  readOnly?: boolean;
}

function collectDescendantIds(locations: Location[], rootId: string): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  for (const location of locations) {
    if (location.parentLocationId) {
      const siblings = childrenByParent.get(location.parentLocationId) ?? [];
      siblings.push(location.id);
      childrenByParent.set(location.parentLocationId, siblings);
    }
  }
  const descendants = new Set<string>();
  const stack = [...(childrenByParent.get(rootId) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (descendants.has(id)) continue;
    descendants.add(id);
    stack.push(...(childrenByParent.get(id) ?? []));
  }
  return descendants;
}

export function LocationParentField({ campaignId, currentId, value, onChange, readOnly }: LocationParentFieldProps) {
  const { data: locations } = locationHooks.useList(campaignId);

  if (readOnly) {
    const parentName = locations?.find((location) => location.id === value)?.name;
    return (
      <div>
        <div style={{ fontSize: 12, color: "var(--md-sys-color-on-surface-variant)" }}>Parent Location</div>
        <div style={{ fontSize: 16 }}>{parentName ?? "None"}</div>
      </div>
    );
  }

  const excludedIds = currentId && locations ? collectDescendantIds(locations, currentId) : new Set<string>();
  const options = (locations ?? []).filter((location) => location.id !== currentId && !excludedIds.has(location.id));

  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 12, color: "var(--md-sys-color-on-surface-variant)" }}>Parent Location</span>
      <select value={value ?? ""} onChange={(event) => onChange(event.target.value || null)}>
        <option value="">None</option>
        {options.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name}
          </option>
        ))}
      </select>
    </label>
  );
}
