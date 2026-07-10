import { z } from "zod";

export const idSchema = z.string().uuid();

export const timestampFields = {
  id: idSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
};

// Not `.url()`: the upload endpoint returns a root-relative path (e.g.
// `/assets/<uuid>.png`), not a fully-qualified URL, so `.url()` rejected every
// successfully uploaded image and silently blocked saving.
export const nullableImageUrl = z.string().min(1).nullable().default(null);
