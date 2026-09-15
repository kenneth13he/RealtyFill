// lib/inputLimits.ts
// Ceilings on what a request is allowed to send.
//
// Every write endpoint took its input on trust: the intake route stored the
// entire JSON body verbatim as the answers blob, `label` had no length cap,
// and /api/extract-listing base64'd every uploaded file into memory with no
// limit on size or count. Rate limiting doesn't help with any of that — it
// caps how *often* someone calls, not how much they send, so sixty allowed
// calls an hour could still be sixty 100 MB uploads.
//
// Three separate things go wrong without these:
//   - cost: an oversized PDF is billed by the token against ANTHROPIC_API_KEY
//   - storage: a multi-megabyte answers blob sits in a 500 MB database
//   - memory: arrayBuffer() on a huge upload happens before anything can
//     reject it
//
// The numbers are deliberately far above real use. A REALM listing export is
// a few hundred KB; the intake schema has 162 fields.

export const LIMITS = {
  /** One uploaded listing document. A long MLS export with photos is well under this. */
  fileBytes: 10 * 1024 * 1024,
  /** All uploads in one extract request combined. */
  totalUploadBytes: 25 * 1024 * 1024,
  /** Main sheet plus schedules and addenda; more than this is not a real deal. */
  fileCount: 10,
  /** Pasted listing text. ~200k characters is far longer than any listing. */
  pastedTextChars: 200_000,
  /** Intake answers: the schema has 162 fields, so this leaves generous room. */
  answerKeys: 500,
  answerKeyChars: 200,
  /** One answer value. The longest real field is a free-text clause. */
  answerValueChars: 20_000,
  /** The whole answers object serialized. */
  answersJsonBytes: 1024 * 1024,
  /** A deal label is a property address, not an essay. */
  labelChars: 200,
} as const;

export class InputTooLargeError extends Error {}

/**
 * Validate an intake answers blob.
 *
 * Also enforces the `Record<string, string>` shape the rest of the app
 * assumes — profileMapper, the schema filter and the fill pipeline all index
 * into it as strings. A nested object or array stored here wouldn't error at
 * write time; it would surface much later as a mangled value in a real PDF.
 *
 * @returns the validated answers, with nothing extra carried through.
 */
export function validateAnswers(body: unknown): Record<string, string> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new InputTooLargeError("Expected a JSON object of intake answers");
  }

  const entries = Object.entries(body as Record<string, unknown>);
  if (entries.length > LIMITS.answerKeys) {
    throw new InputTooLargeError(`Too many answers (max ${LIMITS.answerKeys})`);
  }

  const out: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (key.length > LIMITS.answerKeyChars) {
      throw new InputTooLargeError(`Answer name too long (max ${LIMITS.answerKeyChars} characters)`);
    }
    // null/undefined mean "cleared" in the editor; store them as empty
    // rather than rejecting the whole save.
    if (value === null || value === undefined) {
      out[key] = "";
      continue;
    }
    if (typeof value !== "string") {
      throw new InputTooLargeError(`Answer "${key}" must be text`);
    }
    if (value.length > LIMITS.answerValueChars) {
      throw new InputTooLargeError(`Answer "${key}" is too long (max ${LIMITS.answerValueChars} characters)`);
    }
    out[key] = value;
  }

  // Checked last, on the cleaned object, so the number reflects what would
  // actually be stored.
  const bytes = Buffer.byteLength(JSON.stringify(out), "utf8");
  if (bytes > LIMITS.answersJsonBytes) {
    throw new InputTooLargeError("These answers are too large to save");
  }

  return out;
}
