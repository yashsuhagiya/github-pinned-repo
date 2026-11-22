import assert from "node:assert/strict";
import { test } from "node:test";
import type { PinnedRepo } from "../src/github.ts";
import { escapeXml, renderCard, THEMES } from "../src/svg.ts";

const repo = (over: Partial<PinnedRepo> = {}): PinnedRepo => ({
  name: "demo",
  repo: "https://github.com/u/demo",
  description: "A demo repo",
  language: { name: "TypeScript", color: "#3178c6" },
  stars: 10,
  forks: 2,
  ...over,
});

test("escapes hostile name and description", () => {
  const svg = renderCard(
    "u",
    [repo({ name: `<script>alert(1)</script>`, description: `"onload="x <script>alert(1)</script>` })],
    "light",
  );
  assert.ok(!svg.includes("<script"));
  assert.ok(!svg.includes(`"onload=`));
  assert.ok(svg.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(svg.includes("&quot;onload=&quot;x"));
});

test("escapeXml escapes specials and strips invalid chars", () => {
  assert.equal(escapeXml(`&<>"'`), "&amp;&lt;&gt;&quot;&apos;");
  assert.equal(escapeXml("a\u0000b\u0008c\td"), "abc\td");
});

test("hostile language colour falls back to grey", () => {
  for (const color of ["red;background:url(http://x)", `#fff" onload="x`]) {
    const svg = renderCard("u", [repo({ language: { name: "X", color } })], "light");
    assert.ok(!svg.includes(color));
    assert.ok(!svg.includes("onload"));
    assert.ok(svg.includes(`fill="#8b949e"`));
  }
});

test("light and dark differ and contain their backgrounds", () => {
  const light = renderCard("u", [repo()], "light");
  const dark = renderCard("u", [repo()], "dark");
  assert.notEqual(light, dark);
  assert.ok(light.includes(THEMES.light.background));
  assert.ok(dark.includes(THEMES.dark.background));
});

test("output is self-contained", () => {
  const svg = renderCard("u", [repo()], "dark");
  assert.ok(svg.startsWith(`<svg xmlns="http://www.w3.org/2000/svg"`));
  assert.ok(!svg.includes("<a"));
  assert.ok(!svg.includes("<foreignObject"));
  assert.equal(svg.replace(`xmlns="http://www.w3.org/2000/svg"`, "").includes("http://"), false);
  assert.ok(svg.includes("<title"));
  assert.ok(svg.includes(`role="img"`));
});

test("renders at most 6 cards", () => {
  const svg = renderCard("u", Array.from({ length: 9 }, (_, i) => repo({ name: `r${i}` })), "light");
  assert.equal(svg.match(/class="c"/g)?.length, 6);
});

test("empty list shows a message", () => {
  assert.ok(renderCard("u", [], "light").includes("No pinned repositories"));
});

test("formats counts", () => {
  const svg = renderCard("u", [repo({ stars: 17600, forks: 999 })], "light");
  assert.ok(svg.includes("★ 17.6k"));
  assert.ok(svg.includes("⑂ 999"));
  assert.ok(renderCard("u", [repo({ stars: 1500000 })], "light").includes("★ 1.5m"));
});

test("long description is truncated with an ellipsis", () => {
  const svg = renderCard("u", [repo({ description: "word ".repeat(60) })], "light");
  assert.ok(svg.includes("…"));
  assert.equal(svg.match(/<text class="m" x="16" y="(48|66)"/g)?.length, 2);
});
