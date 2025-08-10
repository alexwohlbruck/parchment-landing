export default defineEventHandler((event) => {
  const existing = getCookie(event, "ab_variant");
  if (!existing) {
    const roll = Math.random() < 0.5 ? "A" : "B";
    setCookie(event, "ab_variant", roll, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
});
