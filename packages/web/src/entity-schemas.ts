import { z } from "zod";
import {
  clueCreateSchema,
  locationCreateSchema,
  monsterCreateSchema,
  mysteryCreateSchema,
  npcCreateSchema,
  pcCreateSchema,
  type EntityType,
} from "@ttrpg/shared";

/**
 * Forms always validate against the full create schema, even when editing —
 * the update endpoint accepts a superset (its schema is `.partial()`), so
 * submitting a fully-populated object works for both create and edit.
 */
export const createSchemaByType: Record<EntityType, z.ZodType<Record<string, unknown>>> = {
  pcs: pcCreateSchema,
  npcs: npcCreateSchema,
  monsters: monsterCreateSchema,
  locations: locationCreateSchema,
  mysteries: mysteryCreateSchema,
  clues: clueCreateSchema,
};

export type FieldKind = "text" | "longtext" | "number" | "image" | "select";

export interface FieldConfig {
  key: string;
  label: string;
  kind: FieldKind;
  options?: string[];
}

export const fieldConfigsByType: Record<EntityType, FieldConfig[]> = {
  pcs: [
    { key: "name", label: "Name", kind: "text" },
    { key: "portraitImageUrl", label: "Portrait", kind: "image" },
    { key: "roleOrClass", label: "Role / Class", kind: "text" },
    { key: "level", label: "Level", kind: "number" },
    { key: "background", label: "Background", kind: "longtext" },
    { key: "inventory", label: "Inventory", kind: "longtext" },
    { key: "notes", label: "Notes", kind: "longtext" },
    // No "xp" field here — it's exposed only through XpAwardSection's
    // dedicated Award XP action in EntityForm, which logs the change to the
    // session history (when one is active) instead of silently editing it.
  ],
  npcs: [
    { key: "name", label: "Name", kind: "text" },
    { key: "portraitImageUrl", label: "Portrait", kind: "image" },
    { key: "role", label: "Role", kind: "text" },
    { key: "description", label: "Description", kind: "longtext" },
    { key: "notes", label: "Notes", kind: "longtext" },
  ],
  monsters: [
    { key: "name", label: "Name", kind: "text" },
    { key: "portraitImageUrl", label: "Portrait", kind: "image" },
    { key: "description", label: "Description", kind: "longtext" },
    { key: "behaviors", label: "Behaviors", kind: "longtext" },
    { key: "notes", label: "Notes", kind: "longtext" },
  ],
  locations: [
    { key: "name", label: "Name", kind: "text" },
    { key: "imageUrl", label: "Image", kind: "image" },
    { key: "description", label: "Description", kind: "longtext" },
    { key: "notes", label: "Notes", kind: "longtext" },
  ],
  mysteries: [
    { key: "name", label: "Name", kind: "text" },
    { key: "description", label: "Description", kind: "longtext" },
    { key: "status", label: "Status", kind: "select", options: ["active", "resolved", "abandoned"] },
    { key: "notes", label: "GM Notes", kind: "longtext" },
  ],
  clues: [
    { key: "title", label: "Title", kind: "text" },
    { key: "content", label: "Content (what players learn)", kind: "longtext" },
    { key: "gmNotes", label: "GM Notes", kind: "longtext" },
    // No "visibility" field here — it's exposed only through ClueRevealSection's
    // dedicated Reveal/Hide actions in EntityForm, which log the change to the
    // session history instead of silently editing it.
  ],
};
