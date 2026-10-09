// Resolve a `next` redirect target against the current origin: a path like `/\evil.com` or `//evil.com`
// resolves to another origin and falls back to the home page instead of becoming an open redirect
export const getSameOriginRedirectPath = (target: string | null, origin: string) => {
  if (!target) return "/"

  try {
    const url = new URL(target, origin)
    return url.origin === origin ? `${url.pathname}${url.search}${url.hash}` : "/"
  } catch {
    return "/"
  }
}
