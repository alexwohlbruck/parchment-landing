const submissions: Array<{
  email: string;
  variant: "A" | "B";
  ts: string;
  ip?: string;
}> = [];

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: string; variant?: "A" | "B" }>(event);
  const email = body?.email?.trim().toLowerCase();
  const variant = (body?.variant || "A") as "A" | "B";

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid email",
      message: "Invalid email",
    });
  }

  const ip = getRequestIP(event);
  submissions.push({
    email,
    variant,
    ts: new Date().toISOString(),
    ip: ip || undefined,
  });

  return { ok: true, message: "Thanks! We will be in touch soon." };
});
