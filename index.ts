import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import getPinnedRepo from "./utils/getPinnedRepo.js";
import { readFile } from "fs/promises";
import path from "path";

const app = new Hono();
const port = process.env.PORT || 3000;

// Serve static files
app.use("/*", serveStatic({ root: "./public" }));

// Home page
app.get("/", async (c) => {
  const filePath = path.join(__dirname, "public", "index.html");
  try {
    const content = await readFile(filePath, "utf-8");
    return c.html(content);
  } catch (error) {
    return c.text("File not found", 404);
  }
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
