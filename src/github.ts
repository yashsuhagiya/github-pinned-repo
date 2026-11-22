import * as cheerio from "cheerio";

const BASE_GITHUB_URL = "https://github.com";

export type PinnedRepo = {
  name: string;
  repo: string;
  description: string;
  language: { name: string; color: string };
  stars: number;
  forks: number;
};
export type Pinned = { source: "graphql" | "html"; data: PinnedRepo[] };

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function parseCount(text: string): number {
  const m = text.trim().replace(/,/g, "").match(/^(\d+(?:\.\d+)?)([km])?$/i);
  if (!m) return 0;
  const mult = { k: 1e3, m: 1e6 }[m[2]?.toLowerCase() as "k" | "m"] ?? 1;
  return Math.round(parseFloat(m[1]) * mult);
}

export function parsePinnedHtml(html: string): PinnedRepo[] {
  const $ = cheerio.load(html);
  const pinned: PinnedRepo[] = [];

  $(".js-pinned-item-list-item").each((_i, el) => {
    const href = $(el).find("a").get(0)?.attribs.href ?? "";
    if (!/^\/[^/]+\/[^/]+$/.test(href)) return;
    pinned.push({
      name: href.split("/")[2],
      repo: BASE_GITHUB_URL + href,
      description: $(el).find("p.pinned-item-desc").text().replace(/\n/g, "").trim(),
      language: {
        name: $(el).find("span[itemprop='programmingLanguage']").text(),
        color:
          $(el).find("span.repo-language-color").get(0)?.attribs.style?.split(":")[1]?.replace(";", "").trim() || "",
      },
      stars: parseCount($(el).find("a[href$='stargazers']").text()),
      forks: parseCount($(el).find("a[href$='/forks'], a[href$='network/members']").text()),
    });
  });

  return pinned;
}

export async function scrapePinned(username: string): Promise<PinnedRepo[]> {
  let res: Response;
  try {
    res = await fetch(`${BASE_GITHUB_URL}/${username}`, { signal: AbortSignal.timeout(8000) });
  } catch {
    throw new HttpError(502, "GitHub request failed");
  }
  if (res.status === 404) throw new HttpError(404, "GitHub user not found");
  if (!res.ok) throw new HttpError(502, "GitHub request failed");
  return parsePinnedHtml(await res.text());
}

const PINNED_QUERY = `query($login: String!) { user(login: $login) { pinnedItems(first: 6, types: REPOSITORY) { nodes { ... on Repository { name url description isPrivate stargazerCount forkCount primaryLanguage { name color } } } } } }`;

type GraphqlNode = {
  name?: string;
  url?: string;
  description?: string | null;
  isPrivate?: boolean;
  stargazerCount?: number;
  forkCount?: number;
  primaryLanguage?: { name?: string; color?: string } | null;
};

// Returns null on any problem so the caller can fall back to scraping.
async function graphqlPinned(username: string, token: string): Promise<PinnedRepo[] | null> {
  try {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "github-pinned-repo" },
      body: JSON.stringify({ query: PINNED_QUERY, variables: { login: username } }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { errors?: unknown; data?: { user?: { pinnedItems?: { nodes?: GraphqlNode[] } } | null } };
    const nodes = json.data?.user?.pinnedItems?.nodes;
    if (json.errors || !nodes) return null;
    return nodes
      .filter((n): n is GraphqlNode => !!n && !!n.name && !n.isPrivate)
      .map((n) => ({
        name: n.name as string,
        repo: n.url ?? "",
        description: n.description ?? "",
        language: { name: n.primaryLanguage?.name ?? "", color: n.primaryLanguage?.color ?? "" },
        stars: n.stargazerCount ?? 0,
        forks: n.forkCount ?? 0,
      }));
  } catch {
    return null;
  }
}

export async function getPinned(username: string): Promise<Pinned> {
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    const data = await graphqlPinned(username, token);
    if (data) return { source: "graphql", data };
  }
  return { source: "html", data: await scrapePinned(username) };
}

export async function getRepos(username: string): Promise<unknown[]> {
  const token = process.env.GITHUB_TOKEN;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json", "User-Agent": "github-pinned-repo" };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`https://api.github.com/users/${username}/repos?per_page=100`, {
      headers,
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new HttpError(502, "GitHub request failed");
  }
  if (res.status === 404) throw new HttpError(404, "GitHub user not found");
  if (!res.ok) throw new HttpError(502, "GitHub request failed");
  try {
    return (await res.json()) as unknown[];
  } catch {
    throw new HttpError(502, "GitHub request failed");
  }
}
