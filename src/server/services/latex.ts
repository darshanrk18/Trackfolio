import { put } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { env, features } from "@/env";
import type { Database } from "@/server/db";
import { compilations, type TexEngine } from "@/server/db/schema";
import { logger } from "@/server/lib/logger";
import { sha256 } from "@/lib/utils";

/**
 * LaTeX compilation against the texlive.net CGI service.
 *
 * Results are cached by `(user, content hash, engine)`, so recompiling an
 * unchanged document never leaves the database. That matters because the
 * upstream service is shared infrastructure we do not control and every miss
 * costs a user-visible second or two.
 */

const COMPILE_TIMEOUT_MS = 45_000;

/** LaTeX logs run to megabytes; only the head is ever useful for diagnosis. */
const MAX_LOG_CHARS = 12_000;

export interface LatexError {
  /** Line in the submitted source, when the log reports one. */
  line?: number;
  message: string;
}

export interface CompileLatexOptions {
  userId: string;
  source: string;
  engine?: TexEngine;
  db: Database;
  /** Bypass the cache and re-run the compiler. */
  force?: boolean;
}

export interface CompileLatexResult {
  status: "success" | "error";
  pdfUrl?: string;
  bytes?: number;
  log?: string;
  errors?: LatexError[];
  contentHash: string;
  engine: TexEngine;
  cached: boolean;
  durationMs: number;
}

/**
 * Pulls the human-meaningful failures out of a LaTeX log.
 *
 * TeX reports errors as a line starting with `!`, with the offending source
 * line following a few lines later as `l.<number>`. Everything between is
 * internal macro trace that only confuses the author.
 */
export function extractLatexErrors(log: string): LatexError[] {
  const lines = log.split(/\r?\n/);
  const errors: LatexError[] = [];

  for (let i = 0; i < lines.length && errors.length < 20; i++) {
    const line = lines[i] ?? "";
    if (!line.startsWith("!")) continue;

    const message = line.replace(/^!\s*/, "").trim();
    if (!message) continue;

    let sourceLine: number | undefined;
    let context = "";
    for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
      const match = /^l\.(\d+)\s?(.*)$/.exec(lines[j] ?? "");
      if (!match) continue;
      sourceLine = Number(match[1]);
      context = (match[2] ?? "").trim();
      break;
    }

    errors.push({
      line: sourceLine,
      message: context ? `${message} — near: ${context}` : message,
    });
  }

  if (errors.length === 0) {
    const fatal = lines.find((l) =>
      /Emergency stop|Fatal error|No pages of output|LaTeX Error/i.test(l),
    );
    if (fatal) errors.push({ message: fatal.trim() });
  }

  return errors;
}

/** Cached successes are keyed on the exact bytes, so identity is enough. */
async function findCached(
  db: Database,
  userId: string,
  contentHash: string,
  engine: TexEngine,
) {
  return db.query.compilations.findFirst({
    where: and(
      eq(compilations.userId, userId),
      eq(compilations.contentHash, contentHash),
      eq(compilations.engine, engine),
    ),
  });
}

async function storePdf(
  userId: string,
  contentHash: string,
  pdf: ArrayBuffer,
): Promise<string> {
  if (features.blobStorage) {
    // The pathname is content-addressed, so overwriting is a no-op in content
    // terms and keeps the URL stable across recompiles of identical source.
    const blob = await put(`resumes/${userId}/${contentHash}.pdf`, pdf, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/pdf",
      token: env.BLOB_READ_WRITE_TOKEN,
    });
    return blob.url;
  }

  // Without blob storage configured (local development) the PDF is returned
  // inline as a data URL so the previewer still works unchanged.
  return `data:application/pdf;base64,${Buffer.from(pdf).toString("base64")}`;
}

async function upsertCompilation(
  db: Database,
  values: {
    userId: string;
    contentHash: string;
    engine: TexEngine;
    status: "success" | "error";
    pdfUrl: string | null;
    bytes: number | null;
    durationMs: number;
    log: string | null;
  },
): Promise<void> {
  await db
    .insert(compilations)
    .values(values)
    .onConflictDoUpdate({
      target: [
        compilations.userId,
        compilations.contentHash,
        compilations.engine,
      ],
      set: {
        status: values.status,
        pdfUrl: values.pdfUrl,
        bytes: values.bytes,
        durationMs: values.durationMs,
        log: values.log,
        createdAt: new Date(),
      },
    });
}

/**
 * Compiles LaTeX source to a PDF.
 *
 * A LaTeX error is an ordinary outcome of authoring a document, not an
 * exception: it resolves to `status: "error"` carrying the log. Only genuine
 * infrastructure failures throw.
 */
export async function compileLatex({
  userId,
  source,
  engine = "pdflatex",
  db,
  force = false,
}: CompileLatexOptions): Promise<CompileLatexResult> {
  const startedAt = performance.now();
  const contentHash = await sha256(source);

  if (!source.trim()) {
    return {
      status: "error",
      log: "The document is empty.",
      errors: [{ message: "The document is empty." }],
      contentHash,
      engine,
      cached: false,
      durationMs: 0,
    };
  }

  if (!force) {
    const cached = await findCached(db, userId, contentHash, engine);
    if (cached?.status === "success" && cached.pdfUrl) {
      return {
        status: "success",
        pdfUrl: cached.pdfUrl,
        bytes: cached.bytes ?? undefined,
        contentHash,
        engine,
        cached: true,
        durationMs: Math.round(performance.now() - startedAt),
      };
    }
  }

  const form = new FormData();
  form.append("engine", engine);
  form.append("return", "pdf");
  form.append("filename[]", "document.tex");
  form.append("filecontents[]", source);

  let response: Response;
  try {
    response = await fetch(env.LATEX_COMPILER_URL, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(COMPILE_TIMEOUT_MS),
    });
  } catch (error) {
    // `AbortSignal.timeout` rejects with a DOMException, which is not reliably
    // an `Error` subclass across runtimes, so match on the name instead.
    const name = (error as { name?: string } | null)?.name;

    if (name === "TimeoutError" || name === "AbortError") {
      logger.warn({ userId, engine, contentHash }, "latex compile timed out");
      // Deliberately not cached: a timeout describes the compiler's state at a
      // moment, not the document, and the same source may compile on retry.
      return {
        status: "error",
        log: `Compilation timed out after ${COMPILE_TIMEOUT_MS / 1_000}s. This usually means a package is downloading or a macro is looping.`,
        errors: [{ message: "Compilation timed out." }],
        contentHash,
        engine,
        cached: false,
        durationMs: Math.round(performance.now() - startedAt),
      };
    }

    logger.error({ err: error, userId, engine }, "latex compiler unreachable");
    throw new Error("The LaTeX compiler is unreachable. Try again shortly.");
  }

  const contentType = response.headers.get("content-type") ?? "";
  const durationMs = Math.round(performance.now() - startedAt);

  // A PDF content-type is the only success signal the CGI gives; anything else
  // is the LaTeX log.
  if (!contentType.includes("pdf")) {
    const body = await response.text().catch(() => "");

    // A 5xx carrying no TeX diagnostics is the service failing, not the
    // document, and must not be cached as the user's mistake.
    if (response.status >= 500 && !body.includes("!")) {
      logger.error(
        { status: response.status, userId, engine },
        "latex compiler returned an error status",
      );
      throw new Error("The LaTeX compiler failed. Try again shortly.");
    }

    const log = body.slice(0, MAX_LOG_CHARS);
    await upsertCompilation(db, {
      userId,
      contentHash,
      engine,
      status: "error",
      pdfUrl: null,
      bytes: null,
      durationMs,
      log,
    });
    return {
      status: "error",
      log,
      errors: extractLatexErrors(log),
      contentHash,
      engine,
      cached: false,
      durationMs,
    };
  }

  const pdf = await response.arrayBuffer();
  const pdfUrl = await storePdf(userId, contentHash, pdf);

  await upsertCompilation(db, {
    userId,
    contentHash,
    engine,
    status: "success",
    // A large inline data URL is not worth a database row; the cache simply
    // misses next time rather than storing megabytes of base64.
    pdfUrl: pdfUrl.length > 2_000_000 ? null : pdfUrl,
    bytes: pdf.byteLength,
    durationMs,
    log: null,
  });

  return {
    status: "success",
    pdfUrl,
    bytes: pdf.byteLength,
    contentHash,
    engine,
    cached: false,
    durationMs,
  };
}
