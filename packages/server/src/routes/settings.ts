import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { settingsSchema, settingsUpdateSchema } from "@ttrpg/shared";
import { prisma } from "../prisma.js";

const SETTINGS_ID = "singleton";

async function getOrCreateSettings() {
  return prisma.settings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
  });
}

function serializeSettings(record: Awaited<ReturnType<typeof getOrCreateSettings>>) {
  return {
    darkMode: record.darkMode,
    colorScheme: {
      primary: record.primary,
      surface: record.surface,
      onSurface: record.onSurface,
      background: record.background,
      onBackground: record.onBackground,
      surfaceVariant: record.surfaceVariant,
      onSurfaceVariant: record.onSurfaceVariant,
    },
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function registerSettingsRoutes(app: FastifyInstance) {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/api/settings",
    { schema: { response: { 200: settingsSchema } } },
    async () => {
      const settings = await getOrCreateSettings();
      return serializeSettings(settings);
    },
  );

  typed.put(
    "/api/settings",
    { schema: { body: settingsUpdateSchema, response: { 200: settingsSchema } } },
    async (request) => {
      await getOrCreateSettings();
      const { darkMode, colorScheme } = request.body;
      const updated = await prisma.settings.update({
        where: { id: SETTINGS_ID },
        data: {
          ...(darkMode !== undefined ? { darkMode } : {}),
          ...(colorScheme ?? {}),
        },
      });
      return serializeSettings(updated);
    },
  );
}
