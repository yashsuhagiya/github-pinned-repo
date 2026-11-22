import { scrapePinned } from "../src/github.ts";

// A profile that reliably has pinned repos. Calls the HTML scraper directly
// (not GraphQL) so markup changes on github.com are detected.
const user = process.env.CANARY_USER || "sindresorhus";

function fail(message: string): never {
  console.error(`canary failed for ${user}: ${message}`);
  process.exit(1);
}

let repos: Awaited<ReturnType<typeof scrapePinned>>;
try {
  repos = await scrapePinned(user);
} catch (error) {
  fail(`scrapePinned threw: ${error instanceof Error ? error.message : String(error)}`);
}

if (repos.length === 0) fail("scraper returned no pinned repos");
if (repos.some((r) => !r.name || !r.repo)) fail("an item is missing name or repo");
if (repos.every((r) => r.stars === 0)) fail("every item has 0 stars (star selector likely broke)");

console.log(`ok: ${repos.length} pinned repos for ${user} (source: html)`);
