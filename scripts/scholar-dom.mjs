import * as cheerio from 'cheerio';

export const SCHOLAR_ORIGIN = 'https://scholar.google.com';

export function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export function parseNumber(value) {
  const cleaned = String(value ?? '').replace(/[^\d-]/g, '');
  return cleaned ? Number(cleaned) : 0;
}

export function toScholarUrl(href) {
  const value = cleanText(href);
  if (!value || value.startsWith('javascript:')) {
    return null;
  }

  try {
    return new URL(value, SCHOLAR_ORIGIN).toString();
  } catch {
    return null;
  }
}

export function slugKey(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function bibtexKey(publication) {
  const firstAuthor = cleanText(publication.authors).split(/,|\band\b/i)[0] || 'paper';
  const author = firstAuthor.replace(/[^A-Za-z0-9]+/g, '') || 'paper';
  const year = Number(publication.year) > 0 ? publication.year : 'nd';
  const firstTitleWord = cleanText(publication.title).split(/\s+/)[0] || 'untitled';
  const title = firstTitleWord.replace(/[^A-Za-z0-9]+/g, '') || 'untitled';
  return `${author}${year}${title}`.toLowerCase();
}

function bibtexEscape(value) {
  return cleanText(value).replace(/\\/g, '\\\\').replace(/{/g, '\\{').replace(/}/g, '\\}');
}

export function generateBibtex(publication) {
  const fields = {
    title: publication.title,
    author: cleanText(publication.authors).replace(/,\s+/g, ' and '),
    journal: publication.venue,
    year: Number(publication.year) > 0 ? String(publication.year) : '',
    url: publication.links?.external || publication.links?.scholar,
    note: `Cited by ${Number(publication.citations) || 0}`
  };

  const lines = [`@article{${bibtexKey(publication)},`];
  for (const [field, value] of Object.entries(fields)) {
    if (cleanText(value)) {
      lines.push(`  ${field} = {${bibtexEscape(value)}},`);
    }
  }
  lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, '');
  lines.push('}');
  return lines.join('\n');
}

export function parseProfileHtml(html, options = {}) {
  const $ = cheerio.load(html);
  const profileName = cleanText($('#gsc_prf_in').text());
  const avatarUrl = toScholarUrl($('#gsc_prf_pup-img').attr('src')) || '';
  const profileLines = $('.gsc_prf_il')
    .map((_, element) => cleanText($(element).text()))
    .get()
    .filter(Boolean);

  const summary = {};
  $('#gsc_rsb_st tr').each((_, row) => {
    const label = cleanText($(row).find('.gsc_rsb_sc1').first().text());
    const cells = $(row)
      .find('.gsc_rsb_std')
      .map((__, cell) => parseNumber($(cell).text()))
      .get();

    if (label && cells.length > 0) {
      summary[slugKey(label)] = {
        all: cells[0] ?? 0,
        recent: cells[1] ?? 0
      };
    }
  });

  const citationYears = $('.gsc_g_t')
    .map((_, element) => cleanText($(element).text()))
    .get();
  const citationScores = $('.gsc_g_al')
    .map((_, element) => parseNumber($(element).text()))
    .get();
  const citationsPerYear = {};
  citationYears.forEach((year, index) => {
    if (year) {
      citationsPerYear[year] = citationScores[index] ?? 0;
    }
  });

  const publications = [];
  $('#gsc_a_t .gsc_a_tr, tr.gsc_a_tr').each((index, row) => {
    const titleNode = $(row).find('.gsc_a_at').first();
    const title = cleanText(titleNode.text());
    if (!title) {
      return;
    }

    const grayLines = $(row)
      .find('.gs_gray')
      .map((_, element) => cleanText($(element).text()))
      .get();
    const citationNode = $(row).find('.gsc_a_ac').first();
    const year = parseNumber($(row).find('.gsc_a_y .gsc_a_h, .gsc_a_h').first().text());
    const scholarUrl = toScholarUrl(titleNode.attr('href'));
    const citedByUrl = toScholarUrl(citationNode.attr('href'));
    const id = extractCitationId(scholarUrl) || slugKey(`${title}-${year}-${index}`);

    const publication = {
      id,
      title,
      authors: grayLines[0] || '',
      venue: grayLines[1] || '',
      citations: parseNumber(citationNode.text()),
      year,
      links: {
        scholar: scholarUrl,
        citedBy: citedByUrl
      },
      relatedPapers: []
    };

    publication.bibtex = generateBibtex(publication);
    publications.push(publication);
  });

  return {
    source: {
      kind: 'google-scholar-dom',
      user: options.user || '',
      url: options.url || '',
      fetchedAt: options.fetchedAt || new Date().toISOString(),
      profileName,
      affiliation: profileLines[0] || '',
      verifiedEmail: profileLines.find((line) => /verified email/i.test(line)) || '',
      avatarUrl
    },
    metrics: {
      totalCitations: summary.citations?.all ?? 0,
      hIndex: summary.h_index?.all ?? 0,
      i10Index: summary.i10_index?.all ?? 0,
      summary,
      citationsPerYear
    },
    publications
  };
}

export function parsePublicationDetailHtml(html) {
  const $ = cheerio.load(html);
  const fields = {};
  $('.gsc_oci_field').each((index, element) => {
    const label = slugKey($(element).text());
    const value = cleanText($('.gsc_oci_value').eq(index).text());
    if (label) {
      fields[label] = value;
    }
  });

  const links = {};
  const external = toScholarUrl($('#gsc_oci_title a').first().attr('href'));
  if (external) {
    links.external = external;
  }

  $('a').each((_, element) => {
    const label = cleanText($(element).text());
    const href = toScholarUrl($(element).attr('href'));
    if (!href) {
      return;
    }
    if (/cited by/i.test(label)) {
      links.citedBy = href;
    }
    if (/related articles/i.test(label)) {
      links.related = href;
    }
    if (/bibtex/i.test(label)) {
      links.bibtex = href;
    }
  });

  return { fields, links };
}

export function parseCitedByHtml(html, limit = 5) {
  const $ = cheerio.load(html);
  const papers = [];
  const resultNodes = $('.gs_r.gs_or.gs_scl').length > 0 ? $('.gs_r.gs_or.gs_scl') : $('.gs_ri');

  resultNodes.each((_, element) => {
    if (papers.length >= limit) {
      return false;
    }

    const root = $(element).hasClass('gs_ri') ? $(element) : $(element).find('.gs_ri').first();
    const titleNode = root.find('h3.gs_rt a').first();
    const title = cleanText(titleNode.text() || root.find('h3.gs_rt').first().text());
    if (!title) {
      return;
    }

    papers.push({
      title,
      authors: cleanText(root.find('.gs_a').first().text()),
      snippet: cleanText(root.find('.gs_rs').first().text()),
      url: titleNode.attr('href') || ''
    });
  });

  return papers;
}

export function mergePublicationDetails(publication, details) {
  const links = { ...publication.links, ...details.links };
  const nextPublication = {
    ...publication,
    links,
    scholarFields: details.fields
  };

  if (links.external || publication.links?.scholar) {
    nextPublication.bibtex = generateBibtex(nextPublication);
  }

  return nextPublication;
}

function extractCitationId(url) {
  if (!url) {
    return '';
  }

  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('citation_for_view') || '';
  } catch {
    return '';
  }
}
