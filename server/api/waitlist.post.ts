import { google } from "googleapis";

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

  const config = useRuntimeConfig();
  const sheetsId = config.googleSheetsId as string | undefined;
  const svcEmail = config.googleServiceAccountEmail as string | undefined;
  const svcKey = (
    config.googleServiceAccountKey as string | undefined
  )?.replace(/\\n/g, "\n");

  // Fallback to memory when config is missing
  if (!sheetsId || !svcEmail || !svcKey) {
    const already = memorySubmissions.some((s) => s.email === email);
    if (already) {
      return { ok: true, message: "You're already on the waitlist." };
    }
    memorySubmissions.push({
      name,
      email,
      variant,
      ts: new Date().toISOString(),
      ip: ip || undefined,
    });
    return { ok: true, message: "Thanks! You're on the waitlist." };
  }

  // Google Sheets: auth
  const jwt = new google.auth.JWT({
    email: svcEmail,
    key: svcKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth: jwt });

  // Check for existing email in first column (assuming header row present)
  // Adjust range as needed, default to 'Sheet1'
  const range = "Sheet1!A:B";
  const getResp = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetsId,
    range,
  });
  const rows = getResp.data.values || [];
  const emailLower = email.toLowerCase();
  const exists = rows.some(
    (r) => (r[1] || "").toString().toLowerCase() === emailLower
  );
  if (exists) {
    return { ok: true, message: "You're already on the waitlist." };
  }

  // Append row: [timestamp, email, name, variant, ip]
  const values = [[new Date().toISOString(), email, name, variant, ip || ""]];
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetsId,
    range,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values },
  });

  return { ok: true, message: "Thanks! You're on the waitlist." };
});
