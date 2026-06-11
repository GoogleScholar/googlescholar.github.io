# Google Scholar Pages

A GitHub Pages publication dashboard generated from Google Scholar DOM data.

The site is fully static at runtime:

- `scripts/fetch-scholar.mjs` fetches and parses Google Scholar DOM pages with Node and Cheerio.
- `scripts/import-scholar-json.mjs` imports compatible JSON outputs, including the legacy BTH endpoint shape.
- `public/data/scholar.json` stores the generated profile data used by the site.
- `public/data/scholars.json` stores searchable profile metadata such as name, avatar, affiliation, and data URL.
- `src/` contains the Vite + React dashboard deployed to GitHub Pages.

Google Scholar does not provide an official public API, so this project intentionally avoids third-party citation APIs and parses Scholar HTML selectors instead.

## Local development

```bash
npm install
npm run dev
```

The app reads `public/data/scholar.json` by default.

Refresh the JSON from a Scholar profile:

```bash
npm run fetch:scholar -- --user vJjq9LwAAAAJ --out public/data/scholar.json
```

Import the legacy BTH JSON output:

```bash
npm run import:scholar-json -- \
  --url "https://cse.bth.se/~fer/googlescholar-api/googlescholar.php?user=vJjq9LwAAAAJ" \
  --name "Fredrik Erlandsson" \
  --out public/data/scholar.json
```

That endpoint does not send CORS headers, so GitHub Pages cannot fetch it directly from the browser. Import it at build time, commit the generated JSON, and the frontend can render it statically.

Fetch publication detail pages and a small sample of citing papers:

```bash
npm run fetch:scholar -- --user vJjq9LwAAAAJ --details --cited-limit 3
```

Detail fetching makes additional Google Scholar requests and can be rate limited. Keep the limit small.

## GitHub Pages

This repository is configured to deploy with `.github/workflows/pages.yml`.

In the repository settings:

1. Enable GitHub Pages.
2. Set the Pages source to GitHub Actions.
3. Add repository variables as needed:

| Variable | Default | Purpose |
| --- | --- | --- |
| `SCHOLAR_USER_ID` | `vJjq9LwAAAAJ` | Google Scholar profile id to publish |
| `SCHOLAR_SOURCE_URL` | empty | Optional JSON source URL to import instead of scraping Scholar DOM |
| `SCHOLAR_PROFILE_NAME` | empty | Name to apply when importing legacy JSON |
| `SCHOLAR_AFFILIATION` | empty | Affiliation to apply when importing legacy JSON |
| `SCHOLAR_AVATAR_URL` | empty | Avatar URL to apply when importing legacy JSON |
| `SCHOLAR_FETCH_DETAILS` | `false` | Set to `true` to fetch publication detail pages |
| `SCHOLAR_CITED_LIMIT` | `0` | Number of citing-paper samples per publication |
| `SCHOLAR_MAX_PUBLICATIONS` | `100` | Detail-fetch limit |

The workflow refreshes data, runs tests, builds the React app, and deploys `dist/`.
The refresh step is best effort so temporary Scholar blocking does not prevent Pages from deploying with the committed JSON file.

## Frontend data

The dashboard supports these data sources:

- Static Pages data: `public/data/scholar.json`.
- A custom CORS-enabled JSON URL: `https://googlescholar.github.io/?data=https://example.com/scholar.json`.
- Build-time imported legacy JSON through `scripts/import-scholar-json.mjs`.

The JSON shape is:

```json
{
  "source": {
    "kind": "google-scholar-dom",
    "user": "vJjq9LwAAAAJ",
    "profileName": "Scholar Name",
    "avatarUrl": "https://scholar.googleusercontent.com/...",
    "fetchedAt": "2026-06-11T00:00:00.000Z"
  },
  "metrics": {
    "totalCitations": 341,
    "hIndex": 12,
    "i10Index": 20,
    "citationsPerYear": {
      "2025": 11
    }
  },
  "publications": [
    {
      "title": "Paper title",
      "authors": "A Author, B Author",
      "venue": "Venue, 2025",
      "citations": 42,
      "year": 2025,
      "links": {
        "scholar": "https://scholar.google.com/...",
        "citedBy": "https://scholar.google.com/...",
        "related": "https://scholar.google.com/...",
        "external": "https://publisher.example/paper"
      },
      "bibtex": "@article{...}",
      "relatedPapers": []
    }
  ]
}
```
