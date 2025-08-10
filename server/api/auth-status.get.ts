export default defineEventHandler((event) => {
  const session = getCookie(event, "session");
  return {
    authenticated: Boolean(session),
    user: session ? { id: "user_123" } : null,
  };
});
