import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import { ASSETS_DIR, registerAssetRoutes } from "./routes/assets.js";
import { registerBattleRoutes } from "./routes/battles.js";
import { registerCampaignRoutes } from "./routes/campaigns.js";
import { registerCampaignTransferRoutes } from "./routes/campaign-transfer.js";
import { registerClueRoutes } from "./routes/clues.js";
import { registerEntityLinkRoutes } from "./routes/entity-links.js";
import { registerLocationRoutes } from "./routes/locations.js";
import { registerMonsterRoutes } from "./routes/monsters.js";
import { registerMysteryRoutes } from "./routes/mysteries.js";
import { registerNpcRoutes } from "./routes/npcs.js";
import { registerPcRoutes } from "./routes/pcs.js";
import { registerPublicDisplayRoutes } from "./routes/public-display.js";
import { registerSessionRoutes } from "./routes/sessions.js";

export async function buildApp(options: { logger?: boolean } = {}) {
  const app = Fastify({ logger: options.logger ?? true }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(cors, { origin: true });
  // 10MB default, matching a single asset upload. The campaign-import route
  // (routes/campaign-transfer.ts) overrides this per-request to 50MB for its
  // zip uploads instead of raising it here, so this default doesn't also
  // silently loosen the unrelated single-image asset-upload route's limit.
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  await app.register(fastifyStatic, { root: ASSETS_DIR, prefix: "/assets/", decorateReply: false });

  registerCampaignRoutes(app);
  registerCampaignTransferRoutes(app);
  registerAssetRoutes(app);
  registerPcRoutes(app);
  registerNpcRoutes(app);
  registerMonsterRoutes(app);
  registerLocationRoutes(app);
  registerMysteryRoutes(app);
  registerClueRoutes(app);
  registerSessionRoutes(app);
  registerBattleRoutes(app);
  registerEntityLinkRoutes(app);
  registerPublicDisplayRoutes(app);

  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    app.log.error(error);
    const statusCode = error.statusCode ?? 500;
    reply.code(statusCode).send({ message: statusCode < 500 ? error.message : "Internal server error" });
  });

  return app;
}
