function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function numberValue(value) {
  const cleaned = String(value ?? '').replace(/[^\d-]/g, '');
  return cleaned ? Number(cleaned) : 0;
}

function slug(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function bibtexKey(publication) {
  const firstAuthor = cleanText(publication.authors).split(/,|\band\b/i)[0] || 'paper';
  const author = firstAuthor.replace(/[^A-Za-z0-9]+/g, '') || 'paper';
  const year = publication.year > 0 ? publication.year : 'nd';
  const firstTitleWord = cleanText(publication.title).split(/\s+/)[0] || 'untitled';
  const title = firstTitleWord.replace(/[^A-Za-z0-9]+/g, '') || 'untitled';
  return `${author}${year}${title}`.toLowerCase();
}

export function generateBibtex(publication) {
  const fields = {
    title: publication.title,
    author: cleanText(publication.authors).replace(/,\s+/g, ' and '),
    journal: publication.venue,
    year: publication.year > 0 ? String(publication.year) : '',
    url: publication.links?.external || publication.links?.scholar,
    note: `Cited by ${numberValue(publication.citations)}`
  };

  const lines = [`@article{${bibtexKey(publication)},`];
  for (const [field, value] of Object.entries(fields)) {
    if (cleanText(value)) {
      lines.push(`  ${field} = {${cleanText(value)}},`);
    }
  }
  lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, '');
  lines.push('}');
  return lines.join('\n');
}

export function normalizePublication(publication, index = 0) {
  const normalized = {
    id: publication.id || slug(`${publication.title}-${publication.year}-${index}`) || `paper-${index}`,
    title: cleanText(publication.title) || 'Untitled publication',
    authors: cleanText(publication.authors),
    venue: cleanText(publication.venue),
    year: numberValue(publication.year),
    citations: numberValue(publication.citations),
    links: publication.links || {},
    relatedPapers: Array.isArray(publication.relatedPapers) ? publication.relatedPapers : [],
    scholarFields: publication.scholarFields || {}
  };

  normalized.bibtex = publication.bibtex || generateBibtex(normalized);
  return normalized;
}

export function normalizeScholarPayload(payload, options = {}) {
  const isLegacy = Object.hasOwn(payload || {}, 'total_citations') || Object.hasOwn(payload || {}, 'citations_per_year');
  const publications = (payload?.publications || []).map(normalizePublication);

  if (!isLegacy) {
    return {
      source: {
        kind: payload?.source?.kind || 'google-scholar-dom',
        user: payload?.source?.user || options.user || '',
        url: payload?.source?.url || options.url || '',
        fetchedAt: payload?.source?.fetchedAt || options.fetchedAt || new Date().toISOString(),
        profileName: payload?.source?.profileName || options.profileName || 'Scholar profile',
        affiliation: payload?.source?.affiliation || options.affiliation || '',
        verifiedEmail: payload?.source?.verifiedEmail || '',
        avatarUrl: payload?.source?.avatarUrl || options.avatarUrl || ''
      },
      metrics: {
        totalCitations: numberValue(payload?.metrics?.totalCitations),
        hIndex: numberValue(payload?.metrics?.hIndex),
        i10Index: numberValue(payload?.metrics?.i10Index),
        summary: payload?.metrics?.summary || {},
        citationsPerYear: normalizeYearMap(payload?.metrics?.citationsPerYear)
      },
      publications
    };
  }

  return {
    source: {
      kind: 'legacy-google-scholar-json',
      user: options.user || '',
      url: options.url || '',
      fetchedAt: options.fetchedAt || new Date().toISOString(),
      profileName: options.profileName || 'Scholar profile',
      affiliation: options.affiliation || '',
      verifiedEmail: '',
      avatarUrl: options.avatarUrl || ''
    },
    metrics: {
      totalCitations: numberValue(payload.total_citations),
      hIndex: 0,
      i10Index: 0,
      summary: {
        citations: {
          all: numberValue(payload.total_citations),
          recent: 0
        }
      },
      citationsPerYear: normalizeYearMap(payload.citations_per_year)
    },
    publications
  };
}

function normalizeYearMap(yearMap = {}) {
  return Object.fromEntries(
    Object.entries(yearMap)
      .map(([year, value]) => [String(year).trim(), numberValue(value)])
      .filter(([year]) => year)
  );
}
