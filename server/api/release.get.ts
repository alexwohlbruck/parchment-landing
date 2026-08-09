/**
 * The latest Parchment release, for the announcement pill in the hero.
 *
 * Proxied and cached rather than fetched from the browser, which is what
 * parchment/web does in `useGitHubReleases` — right there, where the caller is
 * a signed-in user opening a menu, and wrong here. Unauthenticated GitHub
 * allows 60 requests an hour *per IP*, and this would run on every page view:
 * from the browser that is a request per visitor for a string that changes
 * every few weeks, and server-side without a cache it is the whole site
 * sharing one 60/hour budget and the pill vanishing under any real traffic.
 *
 * Cached for an hour, so upstream sees one call in that window no matter how
 * many people arrive, and the pill is in the server-rendered markup rather
 * than appearing a beat after hydration.
 */

const RELEASES_API =
  "https://api.github.com/repos/alexwohlbruck/parchment/releases/latest";

export interface LatestRelease {
  /** e.g. "v0.5.11" */
  version: string;
  /** e.g. "Indoor maps & places in your language" */
  title: string;
  url: string;
  publishedAt: string;
}

interface GitHubRelease {
  tag_name: string;
  name: string | null;
  html_url: string;
  published_at: string;
}

/**
 * Releases are titled "<tag> - <headline>" by .github/workflows/release.yml,
 * which builds the name from the tag and the RELEASE_TITLE file. The pill
 * shows those two as separate things — a version chip and a sentence — so the
 * tag is taken off the front rather than printed twice.
 *
 * Tolerant of the format changing: anything that does not start with the tag
 * is used whole, and a release with no name at all falls back to the tag.
 */
function splitTitle(release: GitHubRelease): string {
  const name = release.name?.trim();
  if (!name) return release.tag_name;
  const withoutTag = name.startsWith(release.tag_name)
    ? name.slice(release.tag_name.length).replace(/^\s*[-–—:]\s*/, "")
    : name;
  return withoutTag || release.tag_name;
}

export default defineCachedEventHandler(
  async (): Promise<LatestRelease | null> => {
    try {
      const release = await $fetch<GitHubRelease>(RELEASES_API, {
        headers: {
          Accept: "application/vnd.github.v3+json",
          // GitHub rejects unidentified callers on some paths, and an
          // unlabelled one is impossible to find again in their logs.
          "User-Agent": "parchment-landing",
        },
        timeout: 4000,
      });

      return {
        version: release.tag_name,
        title: splitTitle(release),
        url: release.html_url,
        publishedAt: release.published_at,
      };
    } catch {
      // Null rather than an error: the pill is an ornament, and a hero that
      // 500s because GitHub is slow is a worse outcome than a hero with one
      // fewer element in it.
      return null;
    }
  },
  {
    maxAge: 60 * 60,
    name: "latest-release",
    // A single entry — there are no parameters, so without this every request
    // URL would key its own copy.
    getKey: () => "latest",
    // Serve the last good answer while a refresh runs, so the hour boundary
    // does not put one unlucky visitor on the GitHub round trip.
    swr: true,
  }
);
