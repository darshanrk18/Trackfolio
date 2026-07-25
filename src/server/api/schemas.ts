import { z } from "zod";

/**
 * Shared input schemas.
 *
 * Length caps are deliberate: they bound memory in the analysis engine and make
 * malicious payloads cheap to reject at the edge.
 */

export const MAX_DOCUMENT_CHARS = 200_000;
export const MAX_JD_CHARS = 60_000;
export const MAX_NOTE_CHARS = 20_000;

export const uuidSchema = z.string().uuid("Expected a valid id.");

export const documentKindSchema = z.enum(["resume", "cover_letter"]);
export const documentFormatSchema = z.enum(["latex", "markdown", "plaintext"]);
export const texEngineSchema = z.enum(["pdflatex", "xelatex", "lualatex"]);

export const roleProfileSchema = z.enum([
  "general",
  "backend",
  "frontend",
  "fullstack",
  "cloud",
  "data",
  "ml",
  "mobile",
  "security",
  "sre",
]);

export const applicationStatusSchema = z.enum([
  "wishlist",
  "applied",
  "screen",
  "assessment",
  "interview",
  "final",
  "offer",
  "accepted",
  "rejected",
  "withdrawn",
  "ghosted",
]);

export const prioritySchema = z.enum(["low", "medium", "high"]);
export const workModeSchema = z.enum(["onsite", "hybrid", "remote", "unknown"]);

/** `YYYY-MM-DD`, the shape produced by `<input type="date">`. */
export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date.");

export const optionalDateSchema = dateStringSchema.nullish().or(z.literal(""));

export const documentContentSchema = z
  .string()
  .max(MAX_DOCUMENT_CHARS, `Documents are limited to ${MAX_DOCUMENT_CHARS.toLocaleString()} characters.`);

export const jobDescriptionSchema = z
  .string()
  .max(MAX_JD_CHARS, `Job descriptions are limited to ${MAX_JD_CHARS.toLocaleString()} characters.`);

export const shortTextSchema = z.string().trim().max(200);
export const mediumTextSchema = z.string().trim().max(2_000);
export const notesSchema = z.string().max(MAX_NOTE_CHARS);

/** Optional URL that also accepts an empty string from a cleared input. */
export const optionalUrlSchema = z
  .union([z.string().url("Enter a valid URL."), z.literal("")])
  .nullish();

export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(200).default(50),
  cursor: z.string().nullish(),
});

/** Normalises `""` and `undefined` to `null` for nullable database columns. */
export function emptyToNull<T extends string>(value: T | null | undefined): T | null {
  if (value === undefined || value === null) return null;
  return (value.trim() === "" ? null : value) as T | null;
}
