import express from "express";
import path from "node:path";
import { HttpError, getPinned, getRepos } from "./github.ts";
import { renderCard } from "./svg.ts";

const USERNAME_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

const app = express();
app.disable("x-powered-by");
app.use(express.static(path.join(import.meta.dirname, "../public")));
// On Vercel, public/ lives on the CDN and "/" reaches this function; send it to the static page.
app.get("/", (_req, res) => res.redirect("/index.html"));

app.param("username", (_req, _res, next, value) => {
  if (!USERNAME_RE.test(String(value))) {
    next(new HttpError(400, "Invalid GitHub username"));
    return;
  }
  next();
});

app.get("/:username.svg", async (req, res) => {
  const username = req.params.username;
  const theme = req.query.theme === "dark" ? "dark" : "light";
  const pinned = await getPinned(username);
  res.set({
    "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
  });
  res.type("image/svg+xml").send(renderCard(username, pinned.data, theme));
});

app.get("/:username/repos", async (req, res) => {
  const repos = await getRepos(req.params.username);
  res.set("Cache-Control", "public, s-maxage=43200, stale-while-revalidate=86400");
  res.json(repos);
});

app.get("/:username", async (req, res) => {
  const pinned = await getPinned(req.params.username);
  res.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.json(pinned);
});

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.set("Cache-Control", "no-store");
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal error" });
});

if (import.meta.main) {
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, () => console.log(`Server is running on port ${port}`));
}

export default app;
