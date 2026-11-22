delete process.env.GITHUB_TOKEN;

import { after, before, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

const { default: app } = await import("../src/app.ts");

const realFetch = globalThis.fetch;
const PINNED_HTML = `<html><body><ol><li class="js-pinned-item-list-item">
<a href="/octocat/hello">octocat/hello</a>
<p class="pinned-item-desc">A repo</p>
<span class="repo-language-color" style="background-color: #3178c6;"></span>
<span itemprop="programmingLanguage">TypeScript</span>
<a href="/octocat/hello/stargazers">12</a>
<a href="/octocat/hello/network/members">3</a>
</li></ol></body></html>`;

describe("app", () => {
  let server: Server;
  let base: string;
  let upstreamCalls = 0;
  let upstream: (url: string) => Response = () => new Response("", { status: 500 });

  before(() => {
    server = app.listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    mock.method(globalThis, "fetch", (input: string | URL | Request, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.startsWith(base)) return realFetch(input, init);
      upstreamCalls++;
      return Promise.resolve(upstream(url));
    });
  });

  after(() => {
    mock.restoreAll();
    server.close();
  });

  it("rejects invalid usernames without upstream calls", async () => {
    upstreamCalls = 0;
    for (const name of ["a..b", "-a", "a--b"]) {
      const res = await fetch(`${base}/${name}`);
      assert.equal(res.status, 400, name);
    }
    assert.equal(upstreamCalls, 0);
  });

  it("maps upstream 404 to 404 with no-store", async () => {
    upstream = () => new Response("", { status: 404 });
    const res = await fetch(`${base}/octocat`);
    assert.equal(res.status, 404);
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.ok((await res.json()).error);
  });

  it("maps upstream 500 to 502 with no-store", async () => {
    upstream = () => new Response("", { status: 500 });
    const res = await fetch(`${base}/octocat`);
    assert.equal(res.status, 502);
    assert.equal(res.headers.get("cache-control"), "no-store");
  });

  it("returns pinned repos with cache headers and ETag", async () => {
    upstream = () => new Response(PINNED_HTML, { status: 200 });
    const res = await fetch(`${base}/octocat`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { source: string; data: unknown[] };
    assert.equal(body.source, "html");
    assert.ok(Array.isArray(body.data));
    assert.match(res.headers.get("cache-control") ?? "", /s-maxage=3600/);
    assert.ok(res.headers.get("etag"));
  });

  it("serves the svg card", async () => {
    upstream = () => new Response(PINNED_HTML, { status: 200 });
    const res = await fetch(`${base}/octocat.svg?theme=dark`);
    assert.equal(res.status, 200);
    assert.ok(res.headers.get("content-type")?.startsWith("image/svg+xml"));
  });

  it("returns repos", async () => {
    upstream = () => new Response(JSON.stringify([{ name: "x" }]), { status: 200 });
    const res = await fetch(`${base}/octocat/repos`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(await res.json()));
    assert.match(res.headers.get("cache-control") ?? "", /s-maxage=43200/);
  });

  it("serves the index page", async () => {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /text\/html/);
  });
});
