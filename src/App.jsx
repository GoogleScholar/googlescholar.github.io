import { useEffect, useMemo, useState } from 'react';
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
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [darkMode]);

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
    return () => { isMounted = false; };
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
    return () => { isMounted = false; };
  }, [dataUrl, scholars]);

  const publications = data?.publications || [];
  const activeScholar = useMemo(() => {
    const matched = scholars.find((scholar) => sameUrl(scholar.dataUrl, dataUrl));
    if (matched) return matched;
    return {
      name: data?.source?.profileName,
      affiliation: data?.source?.affiliation,
      avatarUrl: data?.source?.avatarUrl,
      dataUrl
    };
  }, [data, dataUrl, scholars]);

  const years = useMemo(() => {
    return [...new Set(publications.map((p) => p.year).filter(Boolean))]
      .sort((a, b) => b - a).map(String);
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
    const profileMatches = scholars.filter((scholar) => {
      if (!normalized) return true;
      return normalizeSearch([scholar.name, scholar.affiliation, scholar.user].join(' ')).includes(normalized);
    }).slice(0, 5);
    const authorMatches = coauthors.filter((author) => !normalized || normalizeSearch(author.name).includes(normalized)).slice(0, 8);
    return { profiles: profileMatches, authors: authorMatches };
  }, [coauthors, nameQuery, scholars]);

  const filteredPublications = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    const filtered = publications.filter((publication) => {
      const matchesQuery = normalizedQuery === '' ||
        normalizeSearch([publication.title, publication.authors, publication.venue].join(' ')).includes(normalizedQuery);
      const matchesYear = yearFilter === 'all' || String(publication.year) === yearFilter;
      return matchesQuery && matchesYear;
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'newest') return b.year - a.year || b.citations - a.citations;
      if (sortBy === 'oldest') return a.year - b.year || b.citations - a.citations;
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      return b.citations - a.citations || b.year - a.year;
    });
  }, [publications, query, sortBy, yearFilter]);

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

  return (
    <>
      <header className="md-app-bar">
        <a className="brand" href="/">
          <span className="md-icon" style={{ color: 'var(--md-primary)' }}>school</span>
          <span className="md-title">Scholar Pages</span>
        </a>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="md-btn-icon" onClick={() => setDarkMode(!darkMode)} title="Toggle Dark Mode">
            <span className="md-icon">{darkMode ? 'light_mode' : 'dark_mode'}</span>
          </button>
          <a className="md-btn-text" href="https://github.com/GoogleScholar/googlescholar.github.io" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>
      </header>

      {status.loading && !data && (
        <div className="md-state-panel">
          <span className="md-icon" style={{ fontSize: '48px', marginBottom: '16px', animation: 'spin 1s linear infinite' }}>refresh</span>
          <h2 className="md-headline">Loading Scholar directory</h2>
        </div>
      )}

      {status.error && !data && (
        <div className="md-state-panel">
          <span className="md-icon" style={{ fontSize: '48px', color: 'var(--md-error)', marginBottom: '16px' }}>error</span>
          <h2 className="md-headline" style={{ color: 'var(--md-error)' }}>Unable to load Scholar data</h2>
          <p className="md-body">{status.error}</p>
        </div>
      )}

      {!status.loading && !status.error && data && (
        <div className="md-layout">
          <aside className="md-sidebar">
            <ScholarSearch
              value={nameQuery}
              onChange={setNameQuery}
              matches={nameMatches}
              onScholarSelect={selectScholar}
              onAuthorSelect={(name) => { setQuery(name); setNameQuery(name); }}
            />
            
            <hr className="md-divider" />

            <div className="md-input-group">
              <label className="md-input-label">Search papers</label>
              <div className="md-input-wrapper">
                <span className="md-icon">search</span>
                <input className="md-input" type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search papers..." />
              </div>
            </div>

            <div className="md-input-group">
              <label className="md-input-label">Year</label>
              <select className="md-select" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
                <option value="all">All years</option>
                {years.map(year => <option key={year} value={year}>{year}</option>)}
              </select>
            </div>

            <div className="md-input-group">
              <label className="md-input-label">Sort</label>
              <select className="md-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                {SORT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>

            <button className="md-btn md-btn-text" style={{ marginTop: '8px' }} onClick={resetFilters} disabled={!hasFilters}>
              <span className="md-icon">restart_alt</span> Reset filters
            </button>
          </aside>

          <main className="md-main-content">
            <ProfileBanner
              avatarUrl={avatarUrl}
              profileName={profileName}
              affiliation={affiliation}
              publications={publications}
              metrics={metrics}
              totalPaperCitations={totalPaperCitations}
            />

            <div className="md-card" style={{ marginBottom: '32px' }}>
              <div className="md-card-header" style={{ marginBottom: '16px' }}>
                <h2 className="md-headline">Citations by year</h2>
              </div>
              <div style={{ height: '150px' }}>
                <CitationTimeline citationsPerYear={metrics.citationsPerYear} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
              <div>
                <h2 className="md-headline">Publications</h2>
                <p className="md-body" style={{ color: 'var(--md-on-surface-variant)' }}>Showing {formatNumber(filteredPublications.length)} papers</p>
              </div>
            </div>

            <div>
              {filteredPublications.map((publication) => (
                <PaperCard
                  key={publication.id}
                  publication={publication}
                  isExpanded={publication.id === expandedId}
                  onToggle={() => setExpandedId(publication.id === expandedId ? '' : publication.id)}
                />
              ))}
            </div>
          </main>
        </div>
      )}
    </>
  );
}

function ScholarSearch({ value, onChange, matches, onScholarSelect, onAuthorSelect }) {
  const hasQuery = value.trim().length > 0;
  const showProfiles = hasQuery || matches.profiles.length > 1;

  return (
    <div className="md-input-group">
      <label className="md-input-label">Find scholar or author</label>
      <div className="md-input-wrapper">
        <span className="md-icon">person_search</span>
        <input className="md-input" type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Search for a name..." />
      </div>
      
      <div style={{ marginTop: '8px' }}>
        {showProfiles && matches.profiles.length > 0 && (
          <div style={{ marginBottom: '16px' }}>
            <span className="md-label" style={{ color: 'var(--md-on-surface-variant)', display: 'block', marginBottom: '8px' }}>Profiles</span>
            {matches.profiles.map((scholar) => (
              <button key={scholar.dataUrl} className="md-list-item" onClick={() => onScholarSelect(scholar)}>
                <Avatar name={scholar.name} src={scholar.avatarUrl} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <strong className="md-body">{scholar.name}</strong>
                  <small style={{ fontSize: '12px', color: 'var(--md-on-surface-variant)' }}>{truncateText(scholar.affiliation, 48)}</small>
                </div>
              </button>
            ))}
          </div>
        )}

        {hasQuery && matches.authors.length > 0 && (
          <div>
            <span className="md-label" style={{ color: 'var(--md-on-surface-variant)', display: 'block', marginBottom: '8px' }}>Authors in papers</span>
            {matches.authors.map((author) => (
              <button key={author.name} className="md-list-item" onClick={() => onAuthorSelect(author.name)} style={{ padding: '8px' }}>
                <span className="md-icon" style={{ color: 'var(--md-on-surface-variant)' }}>group</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <strong className="md-body">{author.name}</strong>
                  <small style={{ fontSize: '12px', color: 'var(--md-on-surface-variant)' }}>{author.count} papers</small>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileBanner({ avatarUrl, profileName, affiliation, publications, metrics, totalPaperCitations }) {
  return (
    <div className="md-profile-banner">
      <Avatar name={profileName} src={avatarUrl} size="large" />
      <div style={{ flex: 1, minWidth: '250px' }}>
        <h1 className="md-display">{profileName}</h1>
        <p className="md-title" style={{ fontWeight: 400, opacity: 0.9 }}>{affiliation}</p>
        
        <div className="md-metrics-grid">
          <div className="md-metric">
            <span className="md-metric-value">{formatNumber(metrics.totalCitations)}</span>
            <span className="md-metric-label">Profile Citations</span>
          </div>
          <div className="md-metric">
            <span className="md-metric-value">{formatNumber(publications.length)}</span>
            <span className="md-metric-label">Publications</span>
          </div>
          <div className="md-metric">
            <span className="md-metric-value">{formatNumber(metrics.hIndex)}</span>
            <span className="md-metric-label">h-index</span>
          </div>
          <div className="md-metric">
            <span className="md-metric-value">{getPublicationYearRange(publications)}</span>
            <span className="md-metric-label">Range</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaperCard({ publication, isExpanded, onToggle }) {
  const [copied, setCopied] = useState(false);
  
  async function copyBibtex(event) {
    event.stopPropagation();
    if (!publication.bibtex) return;
    await navigator.clipboard.writeText(publication.bibtex);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className={`md-card ${isExpanded ? 'expanded' : ''}`} onClick={onToggle}>
      <div className="md-card-header">
        <div style={{ flex: 1 }}>
          <h3 className="md-title md-card-title">{publication.title}</h3>
          <p className="md-card-subtitle">{publication.authors}</p>
          <p className="md-card-subtitle" style={{ marginTop: '4px' }}>{publication.venue}</p>
          
          <div className="md-chip-group" style={{ marginTop: '12px' }}>
            <span className="md-chip">{publication.year || 'n.d.'}</span>
            <span className="md-chip">
              <span className="md-icon" style={{ fontSize: '14px', marginRight: '4px' }}>format_quote</span>
              {formatNumber(publication.citations)} citations
            </span>
          </div>
        </div>
        
        <button className="md-btn-icon" onClick={onToggle}>
          <span className="md-icon">{isExpanded ? 'expand_less' : 'expand_more'}</span>
        </button>
      </div>

      <div className="md-card-details">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div>
            <span className="md-label" style={{ color: 'var(--md-on-surface-variant)', display: 'block', marginBottom: '8px' }}>BibTeX</span>
            <pre>{publication.bibtex || 'No BibTeX available'}</pre>
            <button className="md-btn md-btn-text" style={{ marginTop: '8px' }} onClick={copyBibtex} disabled={!publication.bibtex}>
              <span className="md-icon">{copied ? 'check' : 'content_copy'}</span>
              {copied ? 'Copied' : 'Copy BibTeX'}
            </button>
          </div>
          
          <div>
            <span className="md-label" style={{ color: 'var(--md-on-surface-variant)', display: 'block', marginBottom: '8px' }}>Links</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
              <LinkButton href={publication.links.scholar} icon="school" label="Scholar" />
              <LinkButton href={publication.links.external} icon="open_in_new" label="Publication" />
              <LinkButton href={publication.links.citedBy} icon="format_quote" label="Cited by" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Avatar({ name, src, size = 'small' }) {
  const initials = String(name || 'S').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
  const className = `md-avatar ${size}`;
  if (src) return <img className={className} src={src} alt={name} />;
  return <div className={className}>{initials}</div>;
}

function LinkButton({ href, icon, label }) {
  if (!href) return null;
  return (
    <a className="md-btn md-btn-text" href={href} target="_blank" rel="noreferrer">
      <span className="md-icon">{icon}</span> {label}
    </a>
  );
}

function splitAuthors(authors) {
  return String(authors || '').split(/,|\band\b/i).map((author) => author.trim()).filter(Boolean);
}

function normalizeSearch(value) {
  return String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

function resolveDataUrl(url) {
  return new URL(url || DEFAULT_DATA_URL, window.location.href).toString();
}

function sameUrl(left, right) {
  if (!left || !right) return false;
  return resolveDataUrl(left) === resolveDataUrl(right);
}
