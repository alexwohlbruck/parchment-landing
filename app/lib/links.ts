// Canonical external URLs for the Parchment product. Keeping these in one
// place avoids the "Launch app" button silently pointing at the wrong host.
//
// These are the *defaults*. nuxt.config reads them into runtimeConfig, where
// a deployment can override any of them by environment variable — so a staging
// build can point at staging without a code change, and there is still exactly
// one place the real address is written down. Read them through
// `useRuntimeConfig().public` in components rather than importing them
// directly, or the override will not reach the page.

// The live map app. This is where "Launch app" should send visitors.
export const APP_URL = "https://map.parchment.app";

// The docs site.
export const DOCS_URL = "https://docs.parchment.app";

// The source repository, and the releases page the nav's "Download" points at.
export const GITHUB_URL = "https://github.com/alexwohlbruck/parchment";
export const RELEASES_URL = `${GITHUB_URL}/releases`;

// The sibling site. Parchment is the map; Barrelman is the API it is drawn
// from, and each site links to the other.
export const BARRELMAN_URL = "https://barrelman.dev";
