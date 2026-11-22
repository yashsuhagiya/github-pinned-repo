# GitHub Pinned Repositories

A small Express 5 and TypeScript service that returns the pinned repositories of a GitHub user. GitHub's REST API does not expose pinned repositories, so this service returns them as JSON or as an embeddable SVG card. It runs on Vercel at https://github-pinned-repositories.vercel.app.

![Pinned repositories](https://github-pinned-repositories.vercel.app/yashsuhagiya.svg)

## Endpoints

| Method and path | Returns | Cache |
|---|---|---|
| `GET /{username}` | Pinned repositories as JSON | `s-maxage=3600`, stale for up to 24 hours |
| `GET /{username}.svg?theme=light\|dark` | SVG card of the pinned repositories | `s-maxage=3600`, stale for up to 24 hours |
| `GET /{username}/repos` | Public repositories (GitHub REST objects, up to 100) | `s-maxage=43200` (12 hours) |
| `GET /openapi.yaml` | OpenAPI spec | |
| `GET /` | "Try it" form | |

The JSON response has this shape:

```json
{
  "source": "graphql",
  "data": [
    {
      "name": "...",
      "repo": "...",
      "description": "...",
      "language": { "name": "...", "color": "..." },
      "stars": 0,
      "forks": 0
    }
  ]
}
```

## Embed the card

Add the card to a profile README:

```markdown
![Pinned repositories](https://github-pinned-repositories.vercel.app/yashsuhagiya.svg?theme=dark)
```

`?theme=dark` switches the card to the dark palette. Use `?theme=light` for the light palette.

## How it works

### Data sources

If `GITHUB_TOKEN` is set, the service asks GitHub's GraphQL API for `user.pinnedItems`. This path is stable. If there is no token, or the GraphQL call fails, the service parses the public profile HTML instead. If the login is an organisation, `user` is null in GraphQL, so the service also falls back to HTML. Private repositories are filtered out.

The `source` field says which path answered: `graphql` or `html`.

### Caching

Successful responses send `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`. Repository lists send `s-maxage=43200`. Vercel's CDN answers repeat requests without calling GitHub. It also keeps serving the last good copy for a day while it refreshes in the background.

Responses carry an ETag. Errors are never cached and send `no-store`.

### Errors

Errors return a JSON body of the form `{ "error": "..." }`.

| Status | Meaning |
|---|---|
| 400 | Invalid username. Checked before any request to GitHub. |
| 404 | User not found. |
| 502 | GitHub failed. |

An unknown user used to return 200 with an empty list. It now returns 404.

## Performance

| | Before | After |
|---|---|---|
| Median response, repeat request | 277 ms | 113 ms |
| p90 response, repeat request | 323 ms | 139 ms |
| CDN cache | none (every request scraped GitHub) | `HIT` after the first request |

Numbers were measured with curl from Germany against the production URL (20 repeat requests each). A cache miss still costs about 300 ms, because it has to fetch from GitHub.

## Reliability

- Fixed a scraper bug where star counts such as "17.6k" were parsed as 17. They are now 17600.
- Fixed a scraper bug where fork counts were always 0. GitHub moved the fork link from `/network/members` to `/forks`, and the scraper now uses the new link.
- A daily GitHub Action named "canary" runs the HTML scraper against a live profile. If it cannot parse pinned repositories, it opens or updates an issue. This is the early warning for GitHub markup changes.
- CI runs typecheck and tests on every push and pull request.
- Tests use `node:test`. They use a saved real profile page as a fixture and a mocked GraphQL response.

## Self-hosting

1. Fork or clone this repository.
2. Import the project into Vercel.
3. Optional: set `GITHUB_TOKEN` in the Vercel project environment variables.

A `GITHUB_TOKEN` is optional, but recommended. Without it, the service always uses the HTML fallback. Use a classic personal access token with no scopes. Public data is enough for this service. Do not use a token with the `repo` scope.

## Local development

Requires Node 24. The version is pinned in `.nvmrc`.

```bash
git clone https://github.com/yashsuhagiya/github-pinned-repo.git
cd github-pinned-repo
pnpm install
pnpm dev
```

The server runs at http://localhost:3000 and restarts when files change, using `node --watch`.

| Command | Purpose |
|---|---|
| `pnpm dev` | Start the server with restart on change |
| `pnpm test` | Run the tests |
| `pnpm typecheck` | Type-check the project with TypeScript |

## Related

This service powers the pinned-work list and the project index on [my portfolio](https://yashsuhagiya.com).

## License

See the [LICENSE](LICENSE) file.
