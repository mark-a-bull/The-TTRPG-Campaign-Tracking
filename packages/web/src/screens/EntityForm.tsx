import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { EntityType } from "@ttrpg/shared";
import { useUploadAsset } from "../api/assets.js";
import { createSchemaByType, fieldConfigsByType, type FieldConfig } from "../entity-schemas.js";
import { Button } from "../ui/Button.js";
import { TextField } from "../ui/TextField.js";

interface EntityFormProps {
  entityType: EntityType;
  initialValues?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  submitting?: boolean;
  /** Renders every field as plain text with just a Close action, no Save. */
  readOnly?: boolean;
}

function ReadOnlyField({ field, value }: { field: FieldConfig; value: unknown }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--md-sys-color-on-surface-variant)" }}>{field.label}</div>
      {field.kind === "image" ? (
        typeof value === "string" && value ? (
          <img src={value} alt="" style={{ maxWidth: 160, display: "block", marginTop: 8, borderRadius: 8 }} />
        ) : (
          <div style={{ fontSize: 16, color: "var(--md-sys-color-on-surface-variant)" }}>No image</div>
        )
      ) : (
        <div style={{ fontSize: 16, whiteSpace: "pre-wrap" }}>{(value as string) || "—"}</div>
      )}
    </div>
  );
}

export function EntityForm({
  entityType,
  initialValues,
  onSubmit,
  onCancel,
  submitting,
  readOnly,
}: EntityFormProps) {
  const fields = fieldConfigsByType[entityType];
  const {
    watch,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(createSchemaByType[entityType]),
    defaultValues: initialValues,
  });
  const uploadAsset = useUploadAsset();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 320 }}>
      {fields.map((field) => {
        const value = watch(field.key);

        if (readOnly) {
          return <ReadOnlyField key={field.key} field={field} value={value} />;
        }

        if (field.kind === "image") {
          return (
            <div key={field.key}>
              <div style={{ fontSize: 12, color: "var(--md-sys-color-on-surface-variant)" }}>
                {field.label}
              </div>
              {typeof value === "string" && value ? (
                <img src={value} alt="" style={{ maxWidth: 120, display: "block", margin: "8px 0" }} />
              ) : null}
              <input
                type="file"
                accept="image/*"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const result = await uploadAsset.mutateAsync(file);
                  setValue(field.key, result.url, { shouldDirty: true });
                }}
              />
            </div>
          );
        }

        if (field.kind === "select") {
          return (
            <label key={field.key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, color: "var(--md-sys-color-on-surface-variant)" }}>
                {field.label}
              </span>
              <select
                value={(value as string) ?? field.options![0]}
                onChange={(event) => setValue(field.key, event.target.value, { shouldDirty: true })}
              >
                {field.options!.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          );
        }

        return (
          <TextField
            key={field.key}
            label={field.label}
            value={(value as string) ?? ""}
            onChange={(next) => setValue(field.key, next, { shouldDirty: true })}
            multiline={field.kind === "longtext"}
            errorText={errors[field.key]?.message as string | undefined}
          />
        );
      })}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        {readOnly ? (
          <Button variant="text" onClick={onCancel}>
            Close
          </Button>
        ) : (
          <>
            <Button variant="text" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={handleSubmit((data) => onSubmit(data))} disabled={submitting}>
              Save
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
