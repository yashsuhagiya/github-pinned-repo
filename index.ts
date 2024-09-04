import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import getPinnedRepo from "./utils/getPinnedRepo";

const app = new Hono();
const port = process.env.PORT || 3000;

// Serve static files
app.use("/*", serveStatic({ root: "./public" }));

// Home page
app.get("/", async (c) => {
  const file = Bun.file("./public/index.html");
  const content = await file.text();
  return c.html(content);
});

// Route to handle the username-specific API
app.get("/:username", async (c) => {
  const username = c.req.param("username");
  const pinnedRepos = await getPinnedRepo(username);
  return c.json({ data: pinnedRepos });
});

console.log(`Server is running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
