---
name: twitter-x-scraping
description: Scrape Twitter/X timelines, lists, or profiles via Nitter-compatible mirror HTML without the official API. Use for Twitter/X scraping, Nitter or xcancel.com scraping, tweet collection, cursor pagination, anti-bot challenge handling, and scrape-to-summary pipelines.
---

# Twitter/X Scraping

Scrape public Twitter/X timeline HTML through Nitter-compatible mirrors when the task needs public tweets and does not require the official X API.

## Scope

Use this skill for:

- Profile timelines, such as `/swyx`
- Public X list timelines, such as `/i/lists/<listId>`
- Tweet collection, filtering, raw JSON persistence, and downstream summaries
- Debugging Nitter-compatible markup, cursors, timestamps, stats, media, and anti-bot handling

Do not use this as a drop-in replacement for `GET /2/users/:id/following`.

Public Nitter-compatible mirrors are not a reliable source for a user's following or follower graph. Upstream Nitter profile tabs cover timelines such as tweets, replies, media, and search, but not a stable `/<handle>/following` or `/<handle>/followers` account-list route. Some mirrors may expose list members at `/i/lists/<listId>/members`, but that is an X List membership surface, not the accounts a user follows.

If the workflow needs a following graph, prefer one of:

- Official X API following endpoints
- A user-supplied export or maintained account list
- A known X List ID whose members are acceptable as the source set
- A self-hosted/custom fetcher with explicit support for the account graph

## Default Approach

Treat this as mirror-HTML scraping, not direct `x.com` automation.

Preferred stack:

- Fetch pages with HTTP first, using `fetch`, `axios`, `curl`, or equivalent.
- Parse server-rendered HTML with Cheerio, BeautifulSoup, DOMParser, or equivalent.
- Fall back to one persistent headed browser session only when the mirror returns an anti-bot challenge.
- Save raw scrape JSON before any summarization, enrichment, or Notion/database writes.

Known mirror patterns:

- Profile timeline: `/<handle>`
- List timeline: `/i/lists/<listId>`
- List members, when supported by the mirror: `/i/lists/<listId>/members`
- Pagination: append `?cursor=<cursor>`
- Common fallback mirror: `https://xcancel.com` when `https://nitter.net` is unavailable

Preserve list IDs and tweet IDs as strings. They can exceed safe integer precision.

## Scraping Workflow

1. Resolve the target:
   - Numeric input usually means `list`.
   - `@handle` or non-numeric input usually means `profile`.
   - Allow an explicit `type` override.
   - Treat `following` and `followers` targets as unsupported unless the implementation has a verified, current source for that specific graph.

2. Resolve the time window:
   - Default to the last 24 hours.
   - Accept ISO timestamps and relative offsets like `3d`, `12h`, or `90m`.
   - Include tweets at or after `start`.
   - Skip tweets newer than `end`.

3. Fetch each page:
   - Use browser-like headers: `User-Agent`, `Accept`, `Accept-Language`, and `Accept-Encoding`.
   - Retry `429`, `502`, and `503` with exponential backoff.
   - Honor `Retry-After` and `X-Rate-Limit-Reset` headers when present.
   - Cap retries and page count.
   - Log the fetched URL, status, byte length, and whether a challenge marker was present.

4. Parse tweets from each page:
   - Load HTML into a DOM parser.
   - Select `.timeline .timeline-item` and filter for items containing `.tweet-body`.
   - Extract tweet ID and source URL from `a.tweet-link[href]` using `/status/(\\d+)/`.
   - Extract timestamp from `.tweet-date a[title]`; normalize bullets/dots before `Date` parsing.
   - Extract text from `.tweet-content.media-body`.
   - Extract author from `.tweet-header a.username[title]` and `.tweet-header a.fullname[title]`.
   - Extract stats from `.tweet-stats .tweet-stat` by icon class: comment, retweet, quote, heart, and play.
   - Extract media from `.attachments`, `.gallery-video`, and card links.
   - Extract retweets from `.retweet-header`.
   - Extract quoted tweets from `.quote`.

5. Stop pagination:
   - Read the next cursor from `div.show-more a[href]`, falling back to any `a[href*="?cursor="]`.
   - Stop if there is no next cursor.
   - Stop once the newest relevant non-retweet on a page is older than `start`.
   - Do not let old retweets alone force an early stop; they can appear out of chronological order.

6. Persist output:
   - Sort collected tweets by timestamp.
   - Save `tweets` plus `diagnostics` to JSON before downstream work.
   - Include `baseUrl`, page count, byte count, tweet count, effective window, earliest/latest timestamps, duration, and partial/error flags.

## Anti-Bot Handling

Detect mirror challenge pages by checking the status code and HTML for strings such as:

- `Verifying your request`
- `Verifying your browser`
- `Making sure you're not a bot`
- `Anubis`

When detected, switch the rest of the run to one persistent headed browser session.

Browser fallback guidance:

- Use real system Chrome when available.
- Use headed mode; headless often fails these challenges.
- Reuse the same browser/page for all later pages.
- Wait for `.timeline-item` or for the challenge marker to disappear.
- Close or release the browser session at the end of the scrape.

Do not relaunch a browser per page. It is slower, noisier, and more likely to trigger blocking.

Do not solve CAPTCHAs or bypass explicit browser safety barriers. Proof-of-work pages that complete automatically in a normal browser are acceptable; interactive CAPTCHA or account-login walls are a blocker.

## Failure Behavior

Scrapers should preserve useful partial work.

- If page 1 fails, throw a clear error because there is no data to save.
- If a later page fails, return collected tweets with `diagnostics.wasPartial = true` and `diagnostics.errorMessage`.
- Save partial scrape JSON and allow downstream summarization or reprocessing.
- Support a resume mode that accepts raw scrape JSON and skips scraping.
- Reject summary JSON as resume input unless it contains raw tweets.

## Debugging Checklist

When a scrape breaks, narrow to the most likely one or two causes before changing code:

- Mirror is down, rate-limiting, or has changed markup.
- Anti-bot challenge was served and HTTP-only fetching parsed the challenge page.
- Cursor extraction failed, causing only the first page to be scraped.
- Timestamp parsing failed due to locale or title format changes.
- Date-stop logic stopped early because retweets or pinned content distorted ordering.
- Selector drift caused zero tweet items or empty text/stats.
- CLI args were misparsed, especially `--json`, extra `--`, `--type`, or shell-expanded globs.
- The requested route is not supported by Nitter-compatible mirrors, especially `/<handle>/following` and `/<handle>/followers`.

Add validation logs before implementing a fix:

- Effective target type, identifier, base URL, start, and end
- Fetched URL, status, byte length, and challenge marker
- Number of timeline items and tweet-body items per page
- Date ranges for all tweets, non-retweets, and kept tweets
- Next cursor presence, without printing the full cursor unless needed
- Partial status and last error

## Output Model

Use a stable tweet shape:

```ts
interface Tweet {
  id: string;
  url: string;
  user: {
    username: string;
    displayName: string;
    profileUrl?: string;
    avatarUrl?: string;
  };
  timestamp: string;
  timestampMs: number;
  text: string;
  attachments: Array<{
    type: 'image' | 'video' | 'card' | 'unknown';
    previewUrl: string;
    fullUrl?: string;
    alt?: string;
  }>;
  stats: {
    replies: number;
    retweets: number;
    quotes: number;
    likes: number;
    plays?: number;
  };
  retweetedBy?: string;
  quoted?: unknown;
  isThread?: boolean;
}
```

When producing summaries, rewrite Nitter mirror links to `x.com` or `twitter.com`, but keep raw scrape JSON faithful to the source URL and base mirror used.

## Implementation Notes

- Keep scrape-only behavior independent from LLM summarization credentials.
- Add mock HTML mode for repeatable tests using `page1.html`, `page2.html`, and similar fixtures.
- Put a `maxPages` safety cap on every live scrape.
- Add a character budget only as a downstream or pipeline stop condition; do not silently discard raw scraped tweets unless the user requested it.
- Be polite with delays and retry cadence. Public mirrors are fragile community infrastructure.
- Check target site terms and local policy before scraping at scale.

## Current Mirror Notes

As of 2026-05-27, checks against public mirrors showed:

- `https://xcancel.com/swyx` can render a profile timeline after the browser completes proof-of-work.
- `https://xcancel.com/swyx/following` and `https://xcancel.com/swyx/followers` render `Page not found` after proof-of-work.
- HTTP-only fetches to xcancel commonly return `503` verification pages.
- Some Nitter mirrors return empty bodies or Anubis/proof-of-work pages.

Treat these observations as drift-prone diagnostics, not permanent guarantees. Recheck live mirror behavior before relying on a route.
