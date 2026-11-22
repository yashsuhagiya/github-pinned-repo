import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HttpError, getPinned, getRepos, parsePinnedHtml, scrapePinned } from "../src/github.ts";

const profileHtml = readFileSync(new URL("./fixtures/profile.html", import.meta.url), "utf8");
const graphqlJson = readFileSync(new URL("./fixtures/graphql.json", import.meta.url), "utf8");

const TS = { name: "TypeScript", color: "#3178c6" };
const SWIFT = { name: "Swift", color: "#F05138" };
const NONE = { name: "", color: "" };
const pin = (name: string, language: { name: string; color: string }, stars: number, forks: number) => ({
  name,
  language,
  stars,
  forks,
});

const item = (href: string, stars: string, forks: string) =>
  `<li class="js-pinned-item-list-item"><a href="${href}">x</a><a href="${href}/stargazers">${stars}</a><a href="${href}/forks">${forks}</a></li>`;

const savedToken = process.env.GITHUB_TOKEN;
beforeEach(() => {
  delete process.env.GITHUB_TOKEN;
});
afterEach(() => {
  if (savedToken === undefined) delete process.env.GITHUB_TOKEN;
  else process.env.GITHUB_TOKEN = savedToken;
});

describe("parsePinnedHtml", () => {
  it("parses the saved profile fixture", () => {
    const got = parsePinnedHtml(profileHtml).map((r) => pin(r.name, r.language, r.stars, r.forks));
    assert.deepEqual(got, [
      pin("type-fest", TS, 17600, 745),
      pin("ky", TS, 17200, 620),
      pin("awesome", NONE, 541000, 38600),
      pin("awesome-chatgpt", NONE, 6500, 496),
      pin("KeyboardShortcuts", SWIFT, 2700, 252),
      pin("Defaults", SWIFT, 2500, 164),
    ]);
    assert.equal(parsePinnedHtml(profileHtml)[0].repo, "https://github.com/sindresorhus/type-fest");
  });

  it("parses counts with commas, k and m suffixes", () => {
    const html = item("/a/b", "1,234", "2.5K") + item("/a/c", "1.2m", "abc");
    const got = parsePinnedHtml(html);
    assert.deepEqual([got[0].stars, got[0].forks], [1234, 2500]);
    assert.deepEqual([got[1].stars, got[1].forks], [1200000, 0]);
  });

  it("returns [] for empty or unrelated HTML", () => {
    assert.deepEqual(parsePinnedHtml(""), []);
    assert.deepEqual(parsePinnedHtml("<html><body><p>hi</p></body></html>"), []);
  });

  it("skips gist-style hrefs", () => {
    const got = parsePinnedHtml(item("https://gist.github.com/a/123", "1", "1") + item("/a/b", "1", "1"));
    assert.deepEqual(got.map((r) => r.name), ["b"]);
  });
});

describe("scrapePinned", () => {
  const respond = (t: { mock: { method: Function } }, impl: () => Response | Promise<Response>) =>
    t.mock.method(globalThis, "fetch", impl);

  it("404 -> HttpError 404", async (t) => {
    respond(t, () => new Response("", { status: 404 }));
    await assert.rejects(scrapePinned("x"), (e: HttpError) => e instanceof HttpError && e.status === 404);
  });
  it("500 -> HttpError 502", async (t) => {
    respond(t, () => new Response("", { status: 500 }));
    await assert.rejects(scrapePinned("x"), (e: HttpError) => e instanceof HttpError && e.status === 502);
  });
  it("fetch throws -> HttpError 502", async (t) => {
    respond(t, () => Promise.reject(new Error("boom")));
    await assert.rejects(scrapePinned("x"), (e: HttpError) => e instanceof HttpError && e.status === 502);
  });
});

describe("getPinned", () => {
  const htmlRes = () => new Response(item("/a/b", "5", "1"), { status: 200 });

  it("uses GraphQL with a token, drops private, maps nulls", async (t) => {
    process.env.GITHUB_TOKEN = "tok";
    const calls: { url: string; init?: RequestInit }[] = [];
    t.mock.method(globalThis, "fetch", (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(graphqlJson, { status: 200 });
    });
    const got = await getPinned("octocat");
    assert.equal(got.source, "graphql");
    assert.deepEqual(got.data, [
      {
        name: "alpha",
        repo: "https://github.com/octocat/alpha",
        description: "First repo",
        language: TS,
        stars: 120,
        forks: 7,
      },
      { name: "beta", repo: "https://github.com/octocat/beta", description: "", language: NONE, stars: 3, forks: 0 },
    ]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.github.com/graphql");
    assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, "Bearer tok");
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)).variables, { login: "octocat" });
  });

  for (const [label, body] of [
    ["errors", { errors: [{ message: "bad" }] }],
    ["null user", { data: { user: null } }],
  ] as const) {
    it(`falls back to HTML on GraphQL ${label}`, async (t) => {
      process.env.GITHUB_TOKEN = "tok";
      t.mock.method(globalThis, "fetch", (url: string) =>
        String(url).includes("api.github.com/graphql") ? Response.json(body) : htmlRes(),
      );
      const got = await getPinned("octocat");
      assert.equal(got.source, "html");
      assert.equal(got.data[0].name, "b");
    });
  }

  it("falls back to HTML when GraphQL fetch throws or is non-ok", async (t) => {
    process.env.GITHUB_TOKEN = "tok";
    let n = 0;
    t.mock.method(globalThis, "fetch", (url: string) => {
      if (String(url).includes("graphql")) return ++n === 1 ? Promise.reject(new Error("x")) : new Response("", { status: 401 });
      return htmlRes();
    });
    assert.equal((await getPinned("octocat")).source, "html");
    assert.equal((await getPinned("octocat")).source, "html");
  });

  it("makes no GraphQL request without a token", async (t) => {
    const urls: string[] = [];
    t.mock.method(globalThis, "fetch", (url: string) => {
      urls.push(String(url));
      return htmlRes();
    });
    const got = await getPinned("octocat");
    assert.equal(got.source, "html");
    assert.deepEqual(urls, ["https://github.com/octocat"]);
  });
});

describe("getRepos", () => {
  it("sends Authorization only when a token is set", async (t) => {
    const seen: (Record<string, string> | undefined)[] = [];
    t.mock.method(globalThis, "fetch", (_url: string, init?: RequestInit) => {
      seen.push(init?.headers as Record<string, string>);
      return Response.json([{ id: 1 }]);
    });
    assert.deepEqual(await getRepos("octocat"), [{ id: 1 }]);
    process.env.GITHUB_TOKEN = "tok";
    await getRepos("octocat");
    assert.equal(seen[0]?.Authorization, undefined);
    assert.equal(seen[1]?.Authorization, "Bearer tok");
  });
  it("403 -> 502", async (t) => {
    t.mock.method(globalThis, "fetch", () => new Response("", { status: 403 }));
    await assert.rejects(getRepos("x"), (e: HttpError) => e.status === 502);
  });
  it("404 -> 404", async (t) => {
    t.mock.method(globalThis, "fetch", () => new Response("", { status: 404 }));
    await assert.rejects(getRepos("x"), (e: HttpError) => e.status === 404);
  });
  it("fetch throws -> 502", async (t) => {
    t.mock.method(globalThis, "fetch", () => Promise.reject(new Error("x")));
    await assert.rejects(getRepos("x"), (e: HttpError) => e.status === 502);
  });
});
