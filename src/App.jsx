import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Clipboard,
  ExternalLink,
  FileCode2,
  Link2,
  Quote,
  Search
} from 'lucide-react';
import { CitationTimeline, PublicationImpactChart } from './lib/charts.jsx';
import { formatNumber, getPublicationYearRange, getSourceLabel, truncateText } from './lib/format.js';

const SORT_OPTIONS = [
  { value: 'citations', label: 'Most cited' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'title', label: 'Title' }
];

function getDataUrl() {
  const params = new URLSearchParams(window.location.search);
  const explicitDataUrl = params.get('data');
  if (explicitDataUrl) {
    return explicitDataUrl;
  }

  const apiUrl = import.meta.env.VITE_SCHOLAR_API_URL;
  const user = params.get('user') || import.meta.env.VITE_SCHOLAR_USER_ID;
  if (apiUrl && user) {
    const url = new URL(apiUrl, window.location.href);
    url.searchParams.set('user', user);
    return url.toString();
  }

  return `${import.meta.env.BASE_URL}data/scholar.json`;
}

function normalizePublications(publications = []) {
  return publications.map((publication, index) => ({
    id: publication.id || `${publication.title}-${publication.year}-${index}`,
    title: publication.title || 'Untitled publication',
    authors: publication.authors || '',
    venue: publication.venue || '',
    year: Number(publication.year) || 0,
    citations: Number(publication.citations) || 0,
    links: publication.links || {},
    relatedPapers: publication.relatedPapers || [],
    bibtex: publication.bibtex || ''
  }));
}

export default function App() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState({ loading: true, error: '' });
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('citations');
  const [yearFilter, setYearFilter] = useState('all');
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const response = await fetch(getDataUrl(), {
          headers: { Accept: 'application/json' }
        });
        if (!response.ok) {
          throw new Error(`Scholar data request failed with ${response.status}`);
        }
        const payload = await response.json();
        const publications = normalizePublications(payload.publications);
        const nextData = { ...payload, publications };
        const defaultPublication = [...publications].sort(
          (a, b) => b.citations - a.citations || b.year - a.year
        )[0];

        if (isMounted) {
          setData(nextData);
          setSelectedId(defaultPublication?.id || '');
          setStatus({ loading: false, error: '' });
        }
      } catch (error) {
        if (isMounted) {
          setStatus({ loading: false, error: error.message });
        }
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const publications = data?.publications || [];
  const years = useMemo(() => {
    return [...new Set(publications.map((publication) => publication.year).filter(Boolean))]
      .sort((a, b) => b - a)
      .map(String);
  }, [publications]);

  const filteredPublications = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = publications.filter((publication) => {
      const matchesQuery =
        normalizedQuery === '' ||
        [publication.title, publication.authors, publication.venue]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesYear = yearFilter === 'all' || String(publication.year) === yearFilter;
      return matchesQuery && matchesYear;
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'newest') {
        return b.year - a.year || b.citations - a.citations;
      }
      if (sortBy === 'oldest') {
        return a.year - b.year || b.citations - a.citations;
      }
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      return b.citations - a.citations || b.year - a.year;
    });
  }, [publications, query, sortBy, yearFilter]);

  const selectedPublication = useMemo(() => {
    return (
      filteredPublications.find((publication) => publication.id === selectedId) ||
      filteredPublications[0] ||
      publications.find((publication) => publication.id === selectedId) ||
      null
    );
  }, [filteredPublications, publications, selectedId]);

  const totalPaperCitations = publications.reduce((sum, publication) => sum + publication.citations, 0);
  const profileName = data?.source?.profileName || 'Google Scholar Dashboard';
  const affiliation = data?.source?.affiliation || 'DOM-sourced publication profile';
  const metrics = data?.metrics || {};

  if (status.loading) {
    return (
      <main className="app-shell is-loading">
        <div className="loading-panel">Loading Scholar data</div>
      </main>
    );
  }

  if (status.error) {
    return (
      <main className="app-shell">
        <section className="error-panel">
          <h1>Unable to load Scholar data</h1>
          <p>{status.error}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="profile-header">
        <div>
          <p className="eyebrow">Google Scholar DOM Dashboard</p>
          <h1>{profileName}</h1>
          <p className="profile-subtitle">{affiliation}</p>
        </div>
        <div className="source-meta">
          <span>Updated {getSourceLabel(data.source)}</span>
          <span>{getPublicationYearRange(publications)}</span>
        </div>
      </header>

      <section className="metric-grid" aria-label="Profile metrics">
        <MetricCard icon={<Quote />} label="Profile citations" value={formatNumber(metrics.totalCitations)} />
        <MetricCard icon={<BookOpen />} label="Publications" value={formatNumber(publications.length)} />
        <MetricCard icon={<BarChart3 />} label="h-index" value={formatNumber(metrics.hIndex)} />
        <MetricCard icon={<FileCode2 />} label="i10-index" value={formatNumber(metrics.i10Index)} />
        <MetricCard icon={<Quote />} label="Listed citations" value={formatNumber(totalPaperCitations)} />
      </section>

      <section className="analytics-band">
        <div className="panel timeline-panel">
          <div className="panel-heading">
            <h2>Citations by year</h2>
            <span>{Object.keys(metrics.citationsPerYear || {}).length} years</span>
          </div>
          <CitationTimeline citationsPerYear={metrics.citationsPerYear} />
        </div>

        <div className="panel impact-panel">
          <div className="panel-heading">
            <h2>Publication impact</h2>
            <span>Top cited</span>
          </div>
          <PublicationImpactChart
            publications={publications}
            selectedId={selectedPublication?.id}
            onSelect={setSelectedId}
          />
        </div>
      </section>

      <section className="workspace-grid">
        <div className="panel publication-browser">
          <div className="browser-toolbar">
            <label className="search-box">
              <Search size={18} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search papers, authors, venues"
              />
            </label>
            <select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)} aria-label="Filter by year">
              <option value="all">All years</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sort publications">
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="result-count">{formatNumber(filteredPublications.length)} publications</div>

          <div className="publication-list">
            {filteredPublications.map((publication) => (
              <button
                className={`publication-row ${publication.id === selectedPublication?.id ? 'is-selected' : ''}`}
                key={publication.id}
                type="button"
                onClick={() => setSelectedId(publication.id)}
              >
                <span className="publication-main">
                  <strong>{publication.title}</strong>
                  <span>{truncateText(publication.authors || publication.venue, 140)}</span>
                </span>
                <span className="publication-stats">
                  <span>{publication.year || 'n.d.'}</span>
                  <span>{formatNumber(publication.citations)} cites</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <PaperDetail publication={selectedPublication} />
      </section>
    </main>
  );
}

function MetricCard({ icon, label, value }) {
  return (
    <div className="metric-card">
      <span className="metric-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PaperDetail({ publication }) {
  const [copied, setCopied] = useState(false);

  if (!publication) {
    return (
      <aside className="panel paper-detail">
        <div className="empty-detail">No publication selected</div>
      </aside>
    );
  }

  async function copyBibtex() {
    if (!publication.bibtex) {
      return;
    }
    await navigator.clipboard.writeText(publication.bibtex);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <aside className="panel paper-detail">
      <div className="detail-heading">
        <span>{publication.year || 'n.d.'}</span>
        <strong>{formatNumber(publication.citations)} citations</strong>
      </div>

      <h2>{publication.title}</h2>
      <p className="detail-authors">{publication.authors}</p>
      <p className="detail-venue">{publication.venue}</p>

      <div className="link-row" aria-label="Publication links">
        <LinkButton href={publication.links.scholar} icon={<ExternalLink />} label="Scholar" />
        <LinkButton href={publication.links.external} icon={<Link2 />} label="Publication" />
        <LinkButton href={publication.links.citedBy} icon={<Quote />} label="Cited by" />
        <LinkButton href={publication.links.related} icon={<BookOpen />} label="Related" />
      </div>

      <div className="detail-section">
        <div className="section-heading">
          <h3>BibTeX</h3>
          <button type="button" className="icon-command" onClick={copyBibtex} disabled={!publication.bibtex}>
            <Clipboard size={16} aria-hidden="true" />
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre>{publication.bibtex || 'No BibTeX available'}</pre>
      </div>

      <div className="detail-section">
        <div className="section-heading">
          <h3>Citing papers</h3>
          <span>{publication.relatedPapers.length}</span>
        </div>
        {publication.relatedPapers.length > 0 ? (
          <div className="related-list">
            {publication.relatedPapers.map((paper) => (
              <a href={paper.url} key={`${paper.title}-${paper.url}`} target="_blank" rel="noreferrer">
                <strong>{paper.title}</strong>
                <span>{paper.authors}</span>
              </a>
            ))}
          </div>
        ) : (
          <p className="muted">Citing-paper samples are added when the DOM refresh is run with detail fetching enabled.</p>
        )}
      </div>
    </aside>
  );
}

function LinkButton({ href, icon, label }) {
  if (!href) {
    return null;
  }

  return (
    <a className="link-button" href={href} target="_blank" rel="noreferrer" title={label}>
      {icon}
      <span>{label}</span>
    </a>
  );
}
