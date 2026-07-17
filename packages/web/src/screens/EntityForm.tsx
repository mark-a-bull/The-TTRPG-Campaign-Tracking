import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { EntityType } from "@ttrpg/shared";
import { useUploadAsset } from "../api/assets.js";
import type { Clue } from "@ttrpg/shared";
import { createSchemaByType, fieldConfigsByType, type FieldConfig } from "../entity-schemas.js";
import { Button } from "../ui/Button.js";
import { ErrorBanner, errorMessage } from "../ui/ErrorBanner.js";
import { TextField } from "../ui/TextField.js";
import { ClueRevealSection } from "./ClueRevealSection.js";
import { EntityLinksSection } from "./EntityLinksSection.js";
import { LocationParentField } from "./LocationParentField.js";
import { XpAwardSection } from "./XpAwardSection.js";
import type { PC } from "@ttrpg/shared";

interface EntityFormProps {
  entityType: EntityType;
  /** Only required for entity types with campaign-scoped pickers (currently
   * just "locations", for its parent-location field) -- not read from
   * initialValues since that's undefined on create. */
  campaignId?: string;
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
  campaignId,
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
  const [uploadError, setUploadError] = useState<string | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 320 }}>
      {uploadError ? <ErrorBanner message={uploadError} onDismiss={() => setUploadError(null)} /> : null}
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
                disabled={uploadAsset.isPending}
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setUploadError(null);
                  try {
                    const result = await uploadAsset.mutateAsync(file);
                    setValue(field.key, result.url, { shouldDirty: true, shouldValidate: true });
                  } catch (error) {
                    setUploadError(errorMessage(error));
                  } finally {
                    event.target.value = "";
                  }
                }}
              />
              {errors[field.key] ? (
                <div style={{ fontSize: 12, color: "var(--md-sys-color-error)", marginTop: 4 }}>
                  {errors[field.key]?.message as string}
                </div>
              ) : null}
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

        if (field.kind === "number") {
          return (
            <TextField
              key={field.key}
              label={field.label}
              type="number"
              value={value === undefined || value === null ? "" : String(value)}
              onChange={(next) => setValue(field.key, next === "" ? "" : Number(next), { shouldDirty: true })}
              errorText={errors[field.key]?.message as string | undefined}
            />
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

      {entityType === "locations" && campaignId ? (
        <LocationParentField
          campaignId={campaignId}
          currentId={initialValues?.id as string | undefined}
          value={(watch("parentLocationId") as string | null) ?? null}
          onChange={(value) => setValue("parentLocationId", value, { shouldDirty: true })}
          readOnly={readOnly}
        />
      ) : null}

      {initialValues && entityType === "pcs" ? (
        <XpAwardSection campaignId={initialValues.campaignId as string} pc={initialValues as unknown as PC} readOnly={readOnly} />
      ) : null}

      {initialValues && entityType === "clues" ? (
        <ClueRevealSection
          campaignId={initialValues.campaignId as string}
          clue={initialValues as unknown as Clue}
          readOnly={readOnly}
        />
      ) : null}

      {initialValues ? (
        <EntityLinksSection
          campaignId={initialValues.campaignId as string}
          entityType={entityType}
          entityId={initialValues.id as string}
          readOnly={readOnly}
        />
      ) : null}

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
