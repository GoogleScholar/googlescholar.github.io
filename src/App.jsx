import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Calendar,
  Clipboard,
  ExternalLink,
  FileText,
  Link2,
  Quote,
  RotateCcw,
  Search,
  User,
  Users
} from 'lucide-react';
import { CitationTimeline } from './lib/charts.jsx';
import { formatNumber, getPublicationYearRange, getSourceLabel, truncateText } from './lib/format.js';
import { normalizeScholarPayload } from './lib/scholarData.js';

const SORT_OPTIONS = [
  { value: 'citations', label: 'Most cited' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'title', label: 'Title' }
];

const DEFAULT_DATA_URL = `${import.meta.env.BASE_URL}data/scholar.json`;
const SCHOLARS_URL = `${import.meta.env.BASE_URL}data/scholars.json`;

function getInitialDataUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('data') || DEFAULT_DATA_URL;
}

export default function App() {
  const [dataUrl, setDataUrl] = useState(getInitialDataUrl);
  const [data, setData] = useState(null);
  const [scholars, setScholars] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: '' });
  const [query, setQuery] = useState('');
  const [nameQuery, setNameQuery] = useState('');
  const [sortBy, setSortBy] = useState('citations');
  const [yearFilter, setYearFilter] = useState('all');
  const [expandedId, setExpandedId] = useState('');

  useEffect(() => {
    let isMounted = true;
    fetch(SCHOLARS_URL, { headers: { Accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : []))
      .then((payload) => {
        if (isMounted && Array.isArray(payload)) {
          setScholars(payload);
        }
      })
      .catch(() => {
        if (isMounted) {
          setScholars([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const selectedScholar = scholars.find((scholar) => sameUrl(scholar.dataUrl, dataUrl));

    async function loadData() {
      setStatus({ loading: true, error: '' });
      try {
        const response = await fetch(resolveDataUrl(dataUrl), {
          headers: { Accept: 'application/json' }
        });
        if (!response.ok) {
          throw new Error(`Scholar data request failed with ${response.status}`);
        }

        const payload = await response.json();
        const nextData = normalizeScholarPayload(payload, {
          profileName: selectedScholar?.name,
          affiliation: selectedScholar?.affiliation,
          avatarUrl: selectedScholar?.avatarUrl,
          user: selectedScholar?.user,
          url: dataUrl
        });
        const defaultPublication = [...nextData.publications].sort(
          (a, b) => b.citations - a.citations || b.year - a.year
        )[0];

        if (isMounted) {
          setData(nextData);
          setExpandedId(defaultPublication?.id || '');
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
  }, [dataUrl, scholars]);

  const publications = data?.publications || [];
  const activeScholar = useMemo(() => {
    const matched = scholars.find((scholar) => sameUrl(scholar.dataUrl, dataUrl));
    if (matched) {
      return matched;
    }

    return {
      name: data?.source?.profileName,
      affiliation: data?.source?.affiliation,
      avatarUrl: data?.source?.avatarUrl,
      dataUrl
    };
  }, [data, dataUrl, scholars]);

  const years = useMemo(() => {
    return [...new Set(publications.map((publication) => publication.year).filter(Boolean))]
      .sort((a, b) => b - a)
      .map(String);
  }, [publications]);

  const coauthors = useMemo(() => {
    const counts = new Map();
    for (const publication of publications) {
      for (const author of splitAuthors(publication.authors)) {
        counts.set(author, (counts.get(author) || 0) + 1);
      }
    }

    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [publications]);

  const nameMatches = useMemo(() => {
    const normalized = normalizeSearch(nameQuery);
    const profileMatches = scholars
      .filter((scholar) => {
        if (!normalized) {
          return true;
        }
        return normalizeSearch([scholar.name, scholar.affiliation, scholar.user].join(' ')).includes(normalized);
      })
      .slice(0, 5);
    const authorMatches = coauthors
      .filter((author) => !normalized || normalizeSearch(author.name).includes(normalized))
      .slice(0, 8);

    return { profiles: profileMatches, authors: authorMatches };
  }, [coauthors, nameQuery, scholars]);

  const filteredPublications = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    const filtered = publications.filter((publication) => {
      const matchesQuery =
        normalizedQuery === '' ||
        normalizeSearch([publication.title, publication.authors, publication.venue].join(' ')).includes(normalizedQuery);
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

  const selectedPublication = filteredPublications.find((publication) => publication.id === expandedId);
  const metrics = data?.metrics || {};
  const totalPaperCitations = publications.reduce((sum, publication) => sum + publication.citations, 0);
  const profileName = data?.source?.profileName || activeScholar?.name || 'Scholar profile';
  const affiliation = data?.source?.affiliation || activeScholar?.affiliation || 'Google Scholar DOM data';
  const avatarUrl = data?.source?.avatarUrl || activeScholar?.avatarUrl || '';
  const hasFilters = query || yearFilter !== 'all' || sortBy !== 'citations';

  function resetFilters() {
    setQuery('');
    setYearFilter('all');
    setSortBy('citations');
  }

  function selectScholar(scholar) {
    setDataUrl(scholar.dataUrl);
    setNameQuery(scholar.name);
    const url = new URL(window.location.href);
    url.searchParams.delete('data');
    window.history.replaceState(null, '', url);
  }

  if (status.loading && !data) {
    return (
      <main className="app-shell is-loading">
        <div className="loading-panel">Loading Scholar directory</div>
      </main>
    );
  }

  if (status.error && !data) {
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
      <TopNav />

      <div className="directory-layout">
        <aside className="sidebar" aria-label="Scholar controls">
          <ScholarSearch
            value={nameQuery}
            onChange={setNameQuery}
            matches={nameMatches}
            onScholarSelect={selectScholar}
            onAuthorSelect={(name) => {
              setQuery(name);
              setNameQuery(name);
            }}
          />

          <ControlGroup label="Search papers" icon={<Search />}>
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search papers..."
              aria-label="Search papers"
            />
          </ControlGroup>

          <ControlGroup label="Year" icon={<Calendar />}>
            <select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)} aria-label="Filter by year">
              <option value="all">All years</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </ControlGroup>

          <ControlGroup label="Sort" icon={<BarChart3 />}>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sort publications">
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </ControlGroup>

          <button className="reset-button" type="button" onClick={resetFilters} disabled={!hasFilters}>
            <RotateCcw size={14} aria-hidden="true" />
            Reset filters
          </button>
        </aside>

        <section className="directory-main">
          <ProfileBanner
            avatarUrl={avatarUrl}
            profileName={profileName}
            affiliation={affiliation}
            data={data}
            publications={publications}
            metrics={metrics}
            totalPaperCitations={totalPaperCitations}
          />

          <div className="content-grid">
            <section className="paper-directory">
              <div className="directory-header">
                <div>
                  <h2>Publications Directory</h2>
                  <p>{status.loading ? 'Refreshing data...' : `Showing ${formatNumber(filteredPublications.length)} papers`}</p>
                </div>
                <div className="mini-stat">
                  <span>Total citations</span>
                  <strong>{formatNumber(metrics.totalCitations || totalPaperCitations)}</strong>
                </div>
                <div className="mini-stat">
                  <span>h-index</span>
                  <strong>{formatNumber(metrics.hIndex)}</strong>
                </div>
                <div className="mini-stat">
                  <span>Updated</span>
                  <strong>{getSourceLabel(data?.source)}</strong>
                </div>
              </div>

              <div className="paper-list">
                {filteredPublications.map((publication) => (
                  <PaperCard
                    key={publication.id}
                    publication={publication}
                    isExpanded={publication.id === expandedId}
                    onToggle={() => setExpandedId(publication.id === expandedId ? '' : publication.id)}
                  />
                ))}
              </div>
            </section>

            <aside className="analytics-column">
              <section className="panel timeline-panel">
                <div className="panel-heading">
                  <h2>Citations by year</h2>
                  <span>{Object.keys(metrics.citationsPerYear || {}).length} years</span>
                </div>
                <CitationTimeline citationsPerYear={metrics.citationsPerYear} />
              </section>

              <section className="panel focus-panel">
                <div className="panel-heading">
                  <h2>Selected paper</h2>
                  <span>{selectedPublication?.year || 'n.d.'}</span>
                </div>
                {selectedPublication ? (
                  <div className="focus-paper">
                    <strong>{selectedPublication.title}</strong>
                    <span>{formatNumber(selectedPublication.citations)} citations</span>
                    <p>{truncateText(selectedPublication.venue || selectedPublication.authors, 180)}</p>
                  </div>
                ) : (
                  <p className="muted">Select a publication card to pin it here.</p>
                )}
              </section>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

function TopNav() {
  return (
    <header className="top-nav">
      <a className="brand-mark" href="/" aria-label="Scholar Pages home">
        <span className="brand-icon">S</span>
        <span>Scholar Pages</span>
      </a>
      <a className="github-link" href="https://github.com/GoogleScholar/googlescholar.github.io" target="_blank" rel="noreferrer">
        GitHub
      </a>
    </header>
  );
}

function ScholarSearch({ value, onChange, matches, onScholarSelect, onAuthorSelect }) {
  const hasQuery = value.trim().length > 0;
  const showProfiles = hasQuery || matches.profiles.length > 1;

  return (
    <div className="scholar-search">
      <ControlGroup label="Search scholar or author" icon={<User />}>
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Search for a name..."
          aria-label="Search for a scholar or author"
        />
      </ControlGroup>

      <div className="name-results">
        {showProfiles && matches.profiles.length > 0 && (
          <div>
            <span className="result-label">Profiles</span>
            {matches.profiles.map((scholar) => (
              <button key={scholar.dataUrl} type="button" className="name-result" onClick={() => onScholarSelect(scholar)}>
                <Avatar name={scholar.name} src={scholar.avatarUrl} size="small" />
                <span>
                  <strong>{scholar.name}</strong>
                  <small>{truncateText(scholar.affiliation, 48)}</small>
                </span>
              </button>
            ))}
          </div>
        )}

        {hasQuery && matches.authors.length > 0 && (
          <div>
            <span className="result-label">Authors in papers</span>
            {matches.authors.map((author) => (
              <button key={author.name} type="button" className="name-result compact" onClick={() => onAuthorSelect(author.name)}>
                <Users size={15} aria-hidden="true" />
                <span>
                  <strong>{author.name}</strong>
                  <small>{author.count} papers</small>
                </span>
              </button>
            ))}
          </div>
        )}

        {hasQuery && matches.profiles.length === 0 && matches.authors.length === 0 && (
          <p className="muted">No indexed scholar or publication author matches that name.</p>
        )}
      </div>
    </div>
  );
}

function ControlGroup({ label, icon, children }) {
  return (
    <label className="control-group">
      <span className="control-label">{label}</span>
      <span className="control-input">
        {icon}
        {children}
      </span>
    </label>
  );
}

function ProfileBanner({ avatarUrl, profileName, affiliation, data, publications, metrics, totalPaperCitations }) {
  return (
    <section className="profile-banner">
      <div className="profile-identity">
        <Avatar name={profileName} src={avatarUrl} />
        <div>
          <p className="eyebrow">Google Scholar DOM Dashboard</p>
          <h1>{profileName}</h1>
          <p>{affiliation}</p>
        </div>
      </div>

      <div className="profile-metrics" aria-label="Profile metrics">
        <Metric label="Profile citations" value={formatNumber(metrics.totalCitations)} />
        <Metric label="Publications" value={formatNumber(publications.length)} />
        <Metric label="Listed citations" value={formatNumber(totalPaperCitations)} />
        <Metric label="Range" value={getPublicationYearRange(publications)} />
        <Metric label="Source" value={data?.source?.kind === 'legacy-google-scholar-json' ? 'Legacy JSON' : 'DOM scrape'} />
      </div>
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PaperCard({ publication, isExpanded, onToggle }) {
  const [copied, setCopied] = useState(false);
  const tags = [publication.year || 'n.d.', `${formatNumber(publication.citations)} citations`].filter(Boolean);

  async function copyBibtex(event) {
    event.stopPropagation();
    if (!publication.bibtex) {
      return;
    }
    await navigator.clipboard.writeText(publication.bibtex);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <article className={`paper-card ${isExpanded ? 'is-expanded' : ''}`}>
      <button className="paper-card-main" type="button" onClick={onToggle} aria-expanded={isExpanded}>
        <span className="paper-icon">
          <FileText size={22} aria-hidden="true" />
        </span>

        <span className="paper-content">
          <span className="paper-title">{publication.title}</span>
          <span className="paper-authors">{publication.authors}</span>
          <span className="paper-venue">{publication.venue}</span>
          <span className="tag-row">
            {tags.map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
          </span>
        </span>

        <span className="paper-actions" aria-hidden="true">
          <span>{formatNumber(publication.citations)}</span>
          <Quote size={16} />
        </span>
      </button>

      <div className={`paper-details ${isExpanded ? 'is-open' : ''}`}>
        <div className="paper-detail-grid">
          <div>
            <span className="detail-label">BibTeX</span>
            <pre>{publication.bibtex || 'No BibTeX available'}</pre>
          </div>
          <div>
            <span className="detail-label">Links</span>
            <div className="link-row">
              <LinkButton href={publication.links.scholar} icon={<ExternalLink />} label="Scholar" />
              <LinkButton href={publication.links.external} icon={<Link2 />} label="Publication" />
              <LinkButton href={publication.links.citedBy} icon={<Quote />} label="Cited by" />
              <LinkButton href={publication.links.related} icon={<BookOpen />} label="Related" />
              <button type="button" className="link-button" onClick={copyBibtex} disabled={!publication.bibtex}>
                <Clipboard size={16} aria-hidden="true" />
                <span>{copied ? 'Copied' : 'Copy BibTeX'}</span>
              </button>
            </div>

            <span className="detail-label">Citing papers</span>
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
              <p className="muted">Citing-paper samples appear when detail fetching is enabled during data refresh.</p>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function Avatar({ name, src, size = 'large' }) {
  const initials = cleanInitials(name);

  if (src) {
    return <img className={`avatar ${size}`} src={src} alt={`${name} avatar`} />;
  }

  return (
    <span className={`avatar fallback ${size}`} aria-label={`${name} avatar`}>
      {initials}
    </span>
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

function splitAuthors(authors) {
  return String(authors || '')
    .split(/,|\band\b/i)
    .map((author) => author.trim())
    .filter(Boolean);
}

function cleanInitials(name) {
  return String(name || 'S')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function normalizeSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function resolveDataUrl(url) {
  return new URL(url || DEFAULT_DATA_URL, window.location.href).toString();
}

function sameUrl(left, right) {
  if (!left || !right) {
    return false;
  }

  return resolveDataUrl(left) === resolveDataUrl(right);
}
