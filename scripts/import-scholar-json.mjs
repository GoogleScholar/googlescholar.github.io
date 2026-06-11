#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { normalizeScholarPayload } from '../src/lib/scholarData.js';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = args.url || process.env.SCHOLAR_SOURCE_URL;
  if (!url) {
    throw new Error('Expected --url or SCHOLAR_SOURCE_URL.');
  }

  const outFile = args.out || 'public/data/scholar.json';
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent':
        'Mozilla/5.0 (compatible; GoogleScholarPages/1.0; +https://github.com/GoogleScholar/googlescholar.github.io)'
    },
    signal: AbortSignal.timeout(20000)
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status}`);
  }

  const payload = await response.json();
  const normalized = normalizeScholarPayload(payload, {
    url,
    user: args.user || process.env.SCHOLAR_USER_ID || '',
    profileName: args.name || process.env.SCHOLAR_PROFILE_NAME || '',
    affiliation: args.affiliation || process.env.SCHOLAR_AFFILIATION || '',
    avatarUrl: args.avatar || process.env.SCHOLAR_AVATAR_URL || ''
  });

  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  console.log(`Imported ${normalized.publications.length} publications to ${outFile}`);
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
