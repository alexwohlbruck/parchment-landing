const memorySubmissions: Array<{
  name: string;
  email: string;
  variant: "A" | "B";
  ts: string;
  ip?: string;
}> = [];

// Simple in-memory rate limiter per IP
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 5; // max submissions per IP per window
const ipToTimestamps: Map<string, number[]> = new Map();

// Backstop store used when the waitlist endpoint isn't configured or the
// request to it fails, so a signup is never lost to an unhandled error.
function recordInMemory(entry: {
  name: string;
  email: string;
  variant: "A" | "B";
  ip?: string;
}) {
  const already = memorySubmissions.some((s) => s.email === entry.email);
  if (!already) {
    memorySubmissions.push({ ...entry, ts: new Date().toISOString() });
  }
  return {
    ok: true as const,
    message: already
      ? "You're already on the waitlist."
      : "Thanks! You're on the waitlist.",
  };
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    name?: string;
    email?: string;
    variant?: "A" | "B";
  }>(event);
  const name = (body?.name || "").trim();
  const email = body?.email?.trim().toLowerCase() || "";
  const variant = (body?.variant || "A") as "A" | "B";

  // Backend validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
  if (!name || name.length > 100) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid name",
      message: "Invalid name",
    });
  }
  if (!email || !emailRegex.test(email)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid email",
      message: "Invalid email",
    });
  }

  const ip = getRequestIP(event);
  // Rate limit by IP
  const ipKey = ip || "unknown";
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = ipToTimestamps.get(ipKey) || [];
  const recent = timestamps.filter((t) => t > windowStart);
  if (recent.length >= RATE_LIMIT_MAX) {
    throw createError({
      statusCode: 429,
      statusMessage: "Too Many Requests",
      message: "Please try again later.",
    });
  }
  recent.push(now);
  ipToTimestamps.set(ipKey, recent);

  const scriptUrl = useRuntimeConfig().waitlistScriptUrl as string | undefined;

  // No endpoint configured (e.g. local dev) — use the in-memory backstop.
  if (!scriptUrl) {
    return recordInMemory({ name, email, variant, ip: ip || undefined });
  }

  // Forward to the Google Apps Script web app. It expects a JSON body and
  // responds with { ok: boolean, duplicate?: boolean }. If the call fails for
  // any reason, log it and fall back to memory rather than losing the signup.
  // We send an explicit `timestamp` so the recorded time doesn't depend on the
  // Apps Script generating its own.
  try {
    const result = await $fetch<{ ok?: boolean; duplicate?: boolean }>(
      scriptUrl,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: { name, email, variant, timestamp: new Date().toISOString() },
      }
    );
    if (!result?.ok) {
      throw new Error("Waitlist endpoint returned a non-ok response");
    }
    return {
      ok: true,
      message: result.duplicate
        ? "You're already on the waitlist."
        : "Thanks! You're on the waitlist.",
    };
  } catch (err) {
    console.error(
      "[waitlist] Apps Script submission failed; falling back to in-memory store:",
      err
    );
    return recordInMemory({ name, email, variant, ip: ip || undefined });
  }
});
