import type { PinnedRepo } from "./github.ts";

export const THEMES = {
  light: { background: "#ffffff", border: "#d0d7de", title: "#1f2328", text: "#1f2328", muted: "#656d76" },
  dark: { background: "#0d1117", border: "#30363d", title: "#e6edf3", text: "#e6edf3", muted: "#8d96a0" },
};

const FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`;
const FALLBACK_COLOR = "#8b949e";
const WIDTH = 840;
const PAD = 20;
const GAP = 16;
const TITLE_H = 56;
const CARD_W = (WIDTH - PAD * 2 - GAP) / 2;
const CARD_H = 122;
const MAX_REPOS = 6;
const LINE_CHARS = 45;
const MAX_LINES = 2;

export function escapeXml(s: string): string {
  return String(s)
    .replace(/[^\u0009\u000A\u000D -퟿-�\u{10000}-\u{10FFFF}]/gu, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatCount(n: number): string {
  const fmt = (v: number, unit: string) => `${Math.floor(v * 10) / 10}${unit}`;
  if (n >= 1_000_000) return fmt(n / 1_000_000, "m");
  if (n >= 1000) return fmt(n / 1000, "k");
  return String(n);
}

// Greedy word wrap into at most MAX_LINES lines; overflow is cut with an ellipsis.
function wrapLines(text: string): string[] {
  const lines: string[] = [];
  let current = "";
  for (const raw of text.split(/\s+/).filter(Boolean)) {
    const word = raw.length > LINE_CHARS ? raw.slice(0, LINE_CHARS) : raw;
    if (current && current.length + 1 + word.length <= LINE_CHARS) {
      current += ` ${word}`;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= MAX_LINES) return lines;
  const out = lines.slice(0, MAX_LINES);
  out[MAX_LINES - 1] = out[MAX_LINES - 1].slice(0, LINE_CHARS - 1).replace(/[\s.,;:]+$/, "") + "…";
  return out;
}

function renderRepo(r: PinnedRepo, x: number, y: number): string {
  const color = /^#[0-9a-f]{3,8}$/i.test(r.language.color) ? r.language.color : FALLBACK_COLOR;
  const desc = wrapLines(r.description)
    .map((l, i) => `<text class="m" x="16" y="${48 + i * 18}">${escapeXml(l)}</text>`)
    .join("");
  const fy = CARD_H - 16;
  let fx = 16;
  let footer = "";
  if (r.language.name) {
    footer += `<circle cx="${fx + 5}" cy="${fy - 4}" r="5" fill="${color}"/><text class="m" x="${fx + 16}" y="${fy}">${escapeXml(r.language.name)}</text>`;
    fx += 16 + r.language.name.length * 7 + 16;
  }
  const stars = formatCount(r.stars);
  footer += `<text class="m" x="${fx}" y="${fy}">★ ${stars}</text>`;
  fx += 14 + stars.length * 7 + 16;
  footer += `<text class="m" x="${fx}" y="${fy}">⑂ ${formatCount(r.forks)}</text>`;
  return `<g transform="translate(${x} ${y})"><rect class="c" width="${CARD_W}" height="${CARD_H}" rx="8"/><text class="n" x="16" y="28">${escapeXml(r.name)}</text>${desc}${footer}</g>`;
}

export function renderCard(username: string, repos: PinnedRepo[], theme: "light" | "dark"): string {
  const t = THEMES[theme] ?? THEMES.light;
  const style =
    `<style>text{font-family:${FONT}}.t{font-size:18px;font-weight:600;fill:${t.title}}` +
    `.n{font-size:15px;font-weight:600;fill:${t.text}}.m{font-size:12px;fill:${t.muted}}` +
    `.c{fill:${t.background};stroke:${t.border}}</style>`;

  const shown = repos.slice(0, MAX_REPOS);
  const rows = Math.ceil(shown.length / 2);
  const height = shown.length === 0 ? 96 : TITLE_H + rows * CARD_H + (rows - 1) * GAP + PAD;
  const body =
    shown.length === 0
      ? `<text class="m" x="${PAD}" y="${TITLE_H + 8}">No pinned repositories</text>`
      : shown
          .map((r, i) => renderRepo(r, PAD + (i % 2) * (CARD_W + GAP), TITLE_H + Math.floor(i / 2) * (CARD_H + GAP)))
          .join("");
  const title = escapeXml(`${username}'s pinned repositories`);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" role="img" aria-labelledby="title">` +
    `<title id="title">${title}</title>${style}` +
    `<rect x="0.5" y="0.5" width="${WIDTH - 1}" height="${height - 1}" rx="10" fill="${t.background}" stroke="${t.border}"/>` +
    `<text class="t" x="${PAD}" y="36">${title}</text>${body}</svg>`
  );
}
