export function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Number(value) || 0);
}

export function normalizeYear(value) {
  const year = Number(value);
  return Number.isFinite(year) && year > 0 ? year : null;
}

export function getPublicationYearRange(publications) {
  const years = publications
    .map((publication) => normalizeYear(publication.year))
    .filter(Boolean);

  if (years.length === 0) {
    return 'No years';
  }

  const min = Math.min(...years);
  const max = Math.max(...years);
  return min === max ? String(max) : `${min}-${max}`;
}

export function getSourceLabel(source) {
  if (!source?.fetchedAt) {
    return 'Static data';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(source.fetchedAt));
}

export function sortedYears(citationsPerYear = {}) {
  return Object.entries(citationsPerYear)
    .map(([year, citations]) => ({ year: Number(year), citations: Number(citations) || 0 }))
    .filter((entry) => Number.isFinite(entry.year))
    .sort((a, b) => a.year - b.year);
}

export function truncateText(value, maxLength = 120) {
  const text = String(value || '').trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1).trim()}...`;
}
