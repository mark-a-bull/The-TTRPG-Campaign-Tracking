import { z } from "zod";
import { timestampFields } from "./common.js";

export const playerCreateSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(50).default(""),
  email: z.string().max(200).default(""),
});

export const playerUpdateSchema = playerCreateSchema.partial();

export const playerSchema = playerCreateSchema.extend(timestampFields);

export type PlayerCreate = z.input<typeof playerCreateSchema>;
export type PlayerUpdate = z.input<typeof playerUpdateSchema>;
export type Player = z.infer<typeof playerSchema>;
