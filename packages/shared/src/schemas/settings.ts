import { z } from "zod";

export const colorSchemeSchema = z.object({
  primary: z.string(),
  surface: z.string(),
  onSurface: z.string(),
  background: z.string(),
  onBackground: z.string(),
  surfaceVariant: z.string(),
  onSurfaceVariant: z.string(),
});

export const settingsUpdateSchema = z.object({
  darkMode: z.boolean().optional(),
  colorScheme: colorSchemeSchema.partial().optional(),
});

export const settingsSchema = z.object({
  darkMode: z.boolean(),
  colorScheme: colorSchemeSchema,
  updatedAt: z.string().datetime(),
});

export type ColorScheme = z.infer<typeof colorSchemeSchema>;
export type SettingsUpdate = z.input<typeof settingsUpdateSchema>;
export type Settings = z.infer<typeof settingsSchema>;
