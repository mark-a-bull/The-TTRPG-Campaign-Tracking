import { z } from "zod";
import { battleStatusSchema } from "./battle.js";
import { idSchema } from "./common.js";

export const publicDisplaySchema = z.object({
  campaignName: z.string(),
  partyMembers: z.array(
    z.object({ id: idSchema, name: z.string(), portraitImageUrl: z.string().nullable() }),
  ),
  session: z
    .object({
      title: z.string(),
      currentLocation: z.object({ name: z.string(), imageUrl: z.string().nullable() }).nullable(),
      revealedClues: z.array(z.object({ id: idSchema, title: z.string(), content: z.string() })),
      battle: z
        .object({
          status: battleStatusSchema,
          entries: z.array(z.object({ id: idSchema, label: z.string(), isCurrent: z.boolean() })),
        })
        .nullable(),
    })
    .nullable(),
});

export type PublicDisplay = z.infer<typeof publicDisplaySchema>;
