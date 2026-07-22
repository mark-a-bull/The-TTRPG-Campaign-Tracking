import { z } from "zod";
import { idSchema } from "./common.js";
import { itemOwnerTypeSchema } from "./item.js";

// No create/update schemas -- only ever mutated via the dedicated
// reveal/hide routes (never a generic CRUD form), same "not a silent field
// edit" treatment as Item.hidden and Clue.visibility. A missing DB row means
// visible, so the response is just the resolved status, not a full record --
// callers never need the underlying row's own id/timestamps.
export const inventoryVisibilitySchema = z.object({
  ownerType: itemOwnerTypeSchema,
  ownerId: idSchema,
  hidden: z.boolean(),
});

export const setInventoryVisibilitySchema = z.object({
  ownerType: itemOwnerTypeSchema,
  ownerId: idSchema,
});

export type InventoryVisibility = z.infer<typeof inventoryVisibilitySchema>;
export type SetInventoryVisibility = z.input<typeof setInventoryVisibilitySchema>;
