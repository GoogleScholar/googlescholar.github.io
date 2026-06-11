#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  mergePublicationDetails,
  parseCitedByHtml,
  parseProfileHtml,
  parsePublicationDetailHtml,
  SCHOLAR_ORIGIN
} from './scholar-dom.mjs';

const DEFAULT_USER = process.env.SCHOLAR_USER_ID || process.env.VITE_SCHOLAR_USER_ID || 'vJjq9LwAAAAJ';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const user = args.user || DEFAULT_USER;
  if (!/^[A-Za-z0-9_-]+$/.test(user)) {
    throw new Error('Expected --user to be a Google Scholar profile id.');
  }

  const outFile = args.out || 'public/data/scholar.json';
  const detailsEnabled = Boolean(args.details || process.env.SCHOLAR_FETCH_DETAILS === 'true');
  const citedLimit = Number(args['cited-limit'] ?? process.env.SCHOLAR_CITED_LIMIT ?? 0);
  const maxPublications = Number(args['max-publications'] ?? process.env.SCHOLAR_MAX_PUBLICATIONS ?? 100);
  const delayMs = Number(args['delay-ms'] ?? process.env.SCHOLAR_DELAY_MS ?? 650);
  const profileUrl = buildProfileUrl(user, args);

  const profileHtml = await fetchText(profileUrl);
  const profile = parseProfileHtml(profileHtml, {
    user,
    url: profileUrl,
    fetchedAt: new Date().toISOString()
  });

  if (detailsEnabled) {
    const selected = profile.publications.slice(0, Math.max(0, maxPublications));
    for (const [index, publication] of selected.entries()) {
      if (!publication.links.scholar) {
        continue;
      }

      await delay(delayMs);
      try {
        const detailHtml = await fetchText(publication.links.scholar);
        const details = parsePublicationDetailHtml(detailHtml);
        let enriched = mergePublicationDetails(publication, details);

        const citedByUrl = enriched.links.citedBy || publication.links.citedBy;
        if (citedLimit > 0 && citedByUrl) {
          await delay(delayMs);
          const citedByHtml = await fetchText(citedByUrl);
          enriched = {
            ...enriched,
            relatedPapers: parseCitedByHtml(citedByHtml, citedLimit)
          };
        }

        profile.publications[index] = enriched;
      } catch (error) {
        profile.publications[index] = {
          ...publication,
          detailError: error.message
        };
      }
    }
  }

  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, `${JSON.stringify(profile, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${profile.publications.length} publications to ${outFile}`);
}

function buildProfileUrl(user, args) {
  const url = new URL('/citations', SCHOLAR_ORIGIN);
  url.searchParams.set('user', user);
  url.searchParams.set('hl', args.hl || 'en');
  url.searchParams.set('pagesize', String(Math.min(Math.max(Number(args.pagesize || 100), 1), 100)));
  url.searchParams.set('view_op', 'list_works');
  url.searchParams.set('sortby', args.sortby || 'pubdate');
  return url.toString();
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent':
        'Mozilla/5.0 (compatible; GoogleScholarPages/1.0; +https://github.com/GoogleScholar/googlescholar.github.io)'
    },
    signal: AbortSignal.timeout(20000)
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status}`);
  }

  return response.text();
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      continue;
    }

    const [key, inlineValue] = token.slice(2).split('=');
    if (inlineValue !== undefined) {
      args[key] = inlineValue;
    } else if (argv[index + 1] && !argv[index + 1].startsWith('--')) {
      args[key] = argv[index + 1];
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
