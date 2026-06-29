import { useEffect, useMemo, useState, useRef, useId } from 'react';
import { CitationTimeline } from './lib/charts.jsx';
import { YearRangeFilter } from './lib/YearRangeFilter.jsx';
import { formatNumber, getPublicationYearRange, truncateText, normalizeYear } from './lib/format.js';
import { normalizeScholarPayload } from './lib/scholarData.js';

const SORT_OPTIONS = [
  { value: 'citations', label: 'Most Cited' },
  { value: 'trending', label: 'Trending (Citations/Year)' },
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'title', label: 'Title (A-Z)' }
];

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://backend-3aen.onrender.com';

function getInitialUserId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('user') || '';
}

function getInitialDarkMode() {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

function getRecentProfiles() {
  try {
    const data = localStorage.getItem('scholar_recent_profiles');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveRecentProfile(profile) {
  try {
    let recent = getRecentProfiles();
    recent = recent.filter(p => p.user !== profile.user);
    recent.unshift(profile);
    if (recent.length > 5) recent = recent.slice(0, 5);
    localStorage.setItem('scholar_recent_profiles', JSON.stringify(recent));
  } catch (e) {
    console.error('Failed to save recent profile', e);
  }
}

export default function App() {
  const [userId, setUserId] = useState(getInitialUserId);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState({ loading: false, error: '' });
  
  const [query, setQuery] = useState('');
  const searchInputRef = useRef(null);
  const [sortBy, setSortBy] = useState('trending');
  const [yearRange, setYearRange] = useState([]);
  const [expandedId, setExpandedId] = useState('');
  const [darkMode, setDarkMode] = useState(getInitialDarkMode);

  useEffect(() => {
    const handlePopState = () => {
      setUserId(getInitialUserId());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [darkMode]);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Focus search on '/' press if not already in an input/textarea
      if (e.key === '/' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    if (!userId) {
      setData(null);
      setStatus({ loading: false, error: '' });
      return;
    }

    async function loadData() {
      setStatus({ loading: true, error: '' });
      try {
        const response = await fetch(`${BACKEND_URL}/profile?user=${encodeURIComponent(userId)}`, {
          headers: { Accept: 'application/json' }
        });
        
        if (!response.ok) {
          throw new Error(`Scholar data request failed with ${response.status}`);
        }

        const payload = await response.json();
        
        if (payload.error) {
           throw new Error(payload.error);
        }

        const nextData = normalizeScholarPayload(payload, {
          user: userId,
          url: `${BACKEND_URL}/profile?user=${userId}`
        });
        
        const defaultPublication = [...nextData.publications].sort(
          (a, b) => b.citations - a.citations || b.year - a.year
        )[0];

        if (isMounted) {
          setData(nextData);
          setExpandedId(defaultPublication?.id || '');
          setStatus({ loading: false, error: '' });
          
          saveRecentProfile({
            user: userId,
            name: nextData.source.profileName || 'Unknown Scholar',
            affiliation: nextData.source.affiliation || '',
            avatarUrl: nextData.source.avatarUrl || ''
          });
        }
      } catch (error) {
        if (isMounted) {
          setStatus({ loading: false, error: error.message });
        }
      }
    }

    loadData();
    return () => { isMounted = false; };
  }, [userId]);

  useEffect(() => {
    if (userId && data?.source?.profileName) {
      document.title = `${data.source.profileName} - Scholar Analytics`;
    } else {
      document.title = 'Scholar Analytics';
    }
  }, [userId, data]);

  function navigateToUser(id) {
    if (!id || id.trim() === '') return;
    const cleanId = id.trim();
    const url = new URL(window.location.href);
    url.searchParams.set('user', cleanId);
    window.history.pushState(null, '', url);
    setUserId(cleanId);
  }

  function goHome(e) {
    e.preventDefault();
    const url = new URL(window.location.href);
    url.searchParams.delete('user');
    window.history.pushState(null, '', url);
    setUserId('');
  }

  const publications = data?.publications || [];
  
  const years = useMemo(() => {
    return [...new Set(publications.map((p) => p.year).filter(Boolean))]
      .sort((a, b) => b - a).map(String);
  }, [publications]);

  const filteredPublications = useMemo(() => {
    const normalizedQuery = normalizeSearch(query);
    const filtered = publications.filter((publication) => {
      const matchesQuery = normalizedQuery === '' ||
        normalizeSearch([publication.title, publication.authors, publication.venue].join(' ')).includes(normalizedQuery);
      
      let matchesYear = true;
      if (yearRange.length === 2) {
        const pubYear = normalizeYear(publication.year);
        if (pubYear === null) {
          matchesYear = false;
        } else {
          matchesYear = pubYear >= yearRange[0] && pubYear <= yearRange[1];
        }
      }
      return matchesQuery && matchesYear;
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'newest') return b.year - a.year || b.citations - a.citations;
      if (sortBy === 'oldest') return a.year - b.year || b.citations - a.citations;
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      return b.citations - a.citations || b.year - a.year;
    });
  }, [publications, query, sortBy, yearRange]);

  const metrics = data?.metrics || {};
  const profileName = data?.source?.profileName || 'Scholar profile';
  const affiliation = data?.source?.affiliation || '';
  const avatarUrl = data?.source?.avatarUrl || '';

  return (
    <>
      <a href="#main-content" className="md-skip-link">Skip to main content</a>
      <header className="md-app-bar">
        <a className="brand" href="/" onClick={goHome}>
          <span className="md-icon" aria-hidden="true" style={{ color: 'var(--md-primary)' }}>school</span>
          <span className="md-headline">Scholar Analytics</span>
        </a>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className="md-btn-icon" 
            onClick={() => setDarkMode(!darkMode)} 
            title="Toggle Dark Mode"
            aria-label="Toggle Dark Mode"
            aria-pressed={darkMode}
          >
            <span className="md-icon" aria-hidden="true">{darkMode ? 'light_mode' : 'dark_mode'}</span>
          </button>
          <a 
            className="md-btn-icon" 
            href="https://github.com/GoogleScholar/googlescholar.github.io" 
            target="_blank" 
            rel="noreferrer"
            aria-label="GitHub Repository (opens in a new tab)"
            title="GitHub Repository"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'inherit' }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          </a>
        </div>
      </header>

      {!userId && <LandingPage onNavigate={navigateToUser} />}

      {userId && status.loading && (
        <div className="md-state-panel" role="status">
          <span className="md-icon" aria-hidden="true" style={{ fontSize: '48px', marginBottom: '16px', animation: 'spin 1s linear infinite' }}>refresh</span>
          <h2 className="md-headline">Fetching Profile...</h2>
          <p className="md-body">Querying Google Scholar for {userId}</p>
        </div>
      )}

      {userId && status.error && (
        <div className="md-state-panel" role="alert">
          <span className="md-icon" aria-hidden="true" style={{ fontSize: '48px', color: 'var(--md-error)', marginBottom: '16px' }}>error</span>
          <h2 className="md-headline" style={{ color: 'var(--md-error)' }}>Unable to load Scholar profile</h2>
          <p className="md-body" style={{ maxWidth: '400px', marginTop: '8px' }}>{status.error}</p>
          <button className="md-btn md-btn-primary" style={{ marginTop: '24px' }} onClick={() => navigateToUser(userId)}>
            Try Again
          </button>
        </div>
      )}

      {userId && !status.loading && !status.error && data && (
        <div className="md-layout">
          <ProfileBanner
            avatarUrl={avatarUrl}
            profileName={profileName}
            affiliation={affiliation}
            metrics={metrics}
          />

          <div className="md-content-grid">
            <aside className="md-sidebar">
              <div style={{ marginBottom: '8px' }}>
                <label htmlFor="search-publications" className="md-label" style={{ marginBottom: '8px', display: 'block', color: 'var(--md-on-surface-variant)' }}>Search</label>
                <div className="md-input-wrapper" style={{ position: 'relative' }}>
                  <span className="md-icon" aria-hidden="true">search</span>
                  <input
                    id="search-publications"
                    ref={searchInputRef}
                    className="md-input"
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search... (Press '/')"
                    aria-label="Search title or authors"
                    style={query ? { paddingRight: '40px' } : {}}
                  />
                {query && (
                  <button
                    className="md-btn-icon"
                    onClick={() => { setQuery(''); searchInputRef.current?.focus(); }}
                    aria-label="Clear search"
                    title="Clear search"
                    style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', padding: '4px', width: '32px', height: '32px' }}
                  >
                    <span className="md-icon" aria-hidden="true" style={{ fontSize: '18px' }}>close</span>
                  </button>
                )}
                </div>
              </div>

              <YearRangeFilter 
                publications={publications} 
                yearRange={yearRange} 
                onChange={setYearRange} 
              />

              <div className="md-input-group">
                <label htmlFor="sort-select" className="md-label" style={{ marginBottom: '8px', display: 'block', color: 'var(--md-on-surface-variant)' }}>Sort</label>
                <select id="sort-select" className="md-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  {SORT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>

              {metrics.citationsPerYear && Object.keys(metrics.citationsPerYear).length > 0 && (
                <div className="md-card" style={{ marginTop: '16px', padding: '16px' }}>
                  <h3 className="md-title" style={{ marginBottom: '16px', fontSize: '14px' }}>Citations by year</h3>
                  <div style={{ height: '150px' }}>
                    <CitationTimeline 
                      citationsPerYear={metrics.citationsPerYear}
                      selectedYear={yearRange.length === 2 && yearRange[0] === yearRange[1] ? String(yearRange[0]) : 'all'}
                      onYearSelect={(year) => setYearRange([year, year])}
                    />
                  </div>
                </div>
              )}
            </aside>

            <main id="main-content" tabIndex="-1">
              <div style={{ marginBottom: '16px' }}>
                <h2 className="md-headline">Publications</h2>
                <p className="md-body" style={{ color: 'var(--md-on-surface-variant)' }} aria-live="polite" aria-atomic="true">
                  Showing {formatNumber(filteredPublications.length)} papers
                </p>
              </div>

              <div>
                {filteredPublications.length === 0 ? (
                  <div className="md-state-panel" style={{ padding: '48px 16px' }}>
                    <span className="md-icon" aria-hidden="true" style={{ fontSize: '48px', color: 'var(--md-on-surface-variant)', marginBottom: '16px' }}>search_off</span>
                    <h3 className="md-title">No matching publications</h3>
                    <p className="md-body" style={{ color: 'var(--md-on-surface-variant)', maxWidth: '400px', margin: '8px auto 24px' }}>
                      We couldn't find any papers matching your current search and year filters.
                    </p>
                    <button
                      className="md-btn md-btn-primary"
                      onClick={() => { setQuery(''); setYearRange([]); searchInputRef.current?.focus(); }}
                    >
                      Clear Filters
                    </button>
                  </div>
                ) : (
                  filteredPublications.map((publication) => (
                    <PaperCard
                      key={publication.id}
                      publication={publication}
                      isExpanded={publication.id === expandedId}
                      onToggle={() => setExpandedId(publication.id === expandedId ? '' : publication.id)}
                    />
                  ))
                )}
              </div>
            </main>
          </div>
        </div>
      )}
    </>
  );
}

function LandingPage({ onNavigate }) {
  const [input, setInput] = useState('');
  const recentProfiles = getRecentProfiles();

  function handleSubmit(e) {
    e.preventDefault();
    const val = input.trim();
    if (val) {
      try {
        const url = new URL(val);
        const userParam = url.searchParams.get('user');
        if (userParam) {
          onNavigate(userParam);
          return;
        }
      } catch (err) {
        // Not a valid URL, treat as ID
      }
      onNavigate(val);
    }
  }

  return (
    <main id="main-content" tabIndex="-1" className="md-landing-container">
      <div className="md-landing-hero">
        <h1 className="md-display" style={{ marginBottom: '16px', color: 'var(--md-primary)' }}>Analyze any Scholar Profile</h1>
        <p className="md-body" style={{ fontSize: '18px', color: 'var(--md-on-surface-variant)', marginBottom: '32px', maxWidth: '600px', margin: '0 auto 32px' }}>
          Instantly fetch, sort, and analyze publications and citations with beautiful, interactive visualizations. 
          Enter a Google Scholar ID below to get started.
        </p>

        <form onSubmit={handleSubmit} style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', gap: '12px' }}>
          <div className="md-input-wrapper" style={{ flex: 1 }}>
            <span className="md-icon" aria-hidden="true">person</span>
            <input 
              className="md-input" 
              style={{ fontSize: '16px', padding: '16px 16px 16px 48px' }}
              type="text" 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              placeholder="e.g. vJjq9LwAAAAJ" 
              aria-label="Google Scholar User ID"
              required
            />
          </div>
          <button type="submit" className="md-btn md-btn-primary" style={{ padding: '0 32px', fontSize: '18px' }}>
            Analyze
          </button>
        </form>
      </div>

      {recentProfiles.length > 0 && (
        <div className="md-recent-profiles">
          <h2 className="md-title" style={{ marginBottom: '24px', textAlign: 'center' }}>Recent Profiles</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', maxWidth: '1000px', margin: '0 auto' }}>
            {recentProfiles.map(profile => (
              <div 
                key={profile.user} 
                className="md-card" 
                style={{ marginBottom: '0', alignItems: 'center', textAlign: 'center', padding: '24px 16px', cursor: 'pointer' }}
                onClick={() => onNavigate(profile.user)}
                role="button"
                tabIndex={0}
                aria-label={`View profile for ${profile.name}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onNavigate(profile.user);
                  }
                }}
              >
                <Avatar name={profile.name} src={profile.avatarUrl} size="large" />
                <h3 className="md-title" style={{ marginTop: '16px', marginBottom: '4px' }}>{profile.name}</h3>
                <p className="md-body" style={{ fontSize: '13px', color: 'var(--md-on-surface-variant)' }}>
                  {truncateText(profile.affiliation, 60)}
                </p>
                <span className="md-chip" style={{ marginTop: '16px' }}>{profile.user}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

function ProfileBanner({ avatarUrl, profileName, affiliation, metrics }) {
  const summary = metrics.summary || {};
  return (
    <div className="md-profile-banner">
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', minWidth: '150px' }}>
        <Avatar name={profileName} src={avatarUrl} size="large" />
      </div>
      <div style={{ flex: 1, minWidth: '300px' }}>
        <h1 className="md-display" style={{ marginBottom: '8px' }}>{profileName}</h1>
        <p className="md-body" style={{ fontSize: '16px', color: 'var(--md-on-surface-variant)', marginBottom: '16px' }}>{affiliation}</p>
        
        <table className="md-metrics-table">
          <thead>
            <tr>
              <th>Index</th>
              <th>All Time</th>
              <th>Since 2019/21</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Citations</td>
              <td>{formatNumber(summary.citations?.all)}</td>
              <td>{formatNumber(summary.citations?.recent)}</td>
            </tr>
            <tr>
              <td>h-index</td>
              <td>{formatNumber(summary.h_index?.all)}</td>
              <td>{formatNumber(summary.h_index?.recent)}</td>
            </tr>
            <tr>
              <td>i10-index</td>
              <td>{formatNumber(summary.i10_index?.all)}</td>
              <td>{formatNumber(summary.i10_index?.recent)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PaperCard({ publication, isExpanded, onToggle }) {
  const [copied, setCopied] = useState(false);
  const [citedByData, setCitedByData] = useState(null);
  const [citedByLoading, setCitedByLoading] = useState(false);
  const [citedByError, setCitedByError] = useState('');
  const [citedBySort, setCitedBySort] = useState('trending');

  useEffect(() => {
    if (isExpanded && publication.citations > 0 && !citedByData && !citedByLoading && publication.links.citedBy) {
      const load = async () => {
        setCitedByLoading(true);
        try {
          const response = await fetch(`${BACKEND_URL}/cited-by?url=${encodeURIComponent(publication.links.citedBy)}&limit=100`);
          if (!response.ok) throw new Error('Failed to load citations');
          const data = await response.json();
          
          const years = {};
          data.items.forEach(item => {
            if (item.year) {
               years[item.year] = (years[item.year] || 0) + 1;
            }
          });
          data.citationsPerYear = years;
          setCitedByData(data);
        } catch (e) {
          setCitedByError(e.message);
        } finally {
          setCitedByLoading(false);
        }
      };
      load();
    }
  }, [isExpanded, publication.citations, citedByData, citedByLoading, publication.links.citedBy]);

  const sortedCitingPapers = useMemo(() => {
    if (!citedByData?.items) return [];
    let items = [...citedByData.items];
    if (citedBySort === 'newest') {
      items.sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0));
    } else if (citedBySort === 'trending') {
      items.sort((a, b) => (b.trendingScore || 0) - (a.trendingScore || 0));
    } else if (citedBySort === 'oldest') {
      items.sort((a, b) => (Number(a.year) || 9999) - (Number(b.year) || 9999));
    } else if (citedBySort === 'title') {
      items.sort((a, b) => a.title.localeCompare(b.title));
    }
    return items;
  }, [citedByData, citedBySort]);

  const authorCount = useMemo(() => {
    return publication.authors ? publication.authors.split(/,|\band\b/i).length : 0;
  }, [publication.authors]);

  const advancedStats = useMemo(() => {
    if (!citedByData || !citedByData.citationsPerYear) return null;
    const years = Object.keys(citedByData.citationsPerYear);
    if (years.length === 0) return null;
    
    let peakYear = years[0];
    let maxCites = citedByData.citationsPerYear[peakYear];
    let total = 0;
    
    years.forEach(y => {
      total += citedByData.citationsPerYear[y];
      if (citedByData.citationsPerYear[y] > maxCites) {
        maxCites = citedByData.citationsPerYear[y];
        peakYear = y;
      }
    });
    
    const span = Math.max(Number(years[years.length - 1]) - Number(years[0]) + 1, 1);
    const avg = (total / span).toFixed(1);
    
    return { peakYear, maxCites, avg };
  }, [citedByData]);
  
  async function copyBibtex(event) {
    event.stopPropagation();
    if (!publication.bibtex) {
      event.preventDefault();
      return;
    }
    await navigator.clipboard.writeText(publication.bibtex);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className={`md-card ${isExpanded && publication.citations > 0 ? 'expanded' : ''}`}>
      <div className="md-card-header" onClick={publication.citations > 0 ? onToggle : undefined} style={{ cursor: publication.citations > 0 ? 'pointer' : 'default' }}>
        <div style={{ flex: 1 }}>
          <h3 className="md-title md-card-title">{publication.title}</h3>
          <p className="md-card-subtitle">{publication.authors}</p>
          <p className="md-card-subtitle" style={{ marginTop: '4px' }}>{publication.venue}</p>
          
          <div className="md-chip-group" style={{ marginTop: '12px' }}>
            <span className="md-chip">{publication.year || 'n.d.'}</span>
            <span className="md-chip">
              <span className="md-icon" aria-hidden="true" style={{ fontSize: '14px', marginRight: '4px' }}>format_quote</span>
              {formatNumber(publication.citations)} citations
            </span>
            <span className="md-chip">
              <span className="md-icon" aria-hidden="true" style={{ fontSize: '14px', marginRight: '4px' }}>group</span>
              {authorCount} author{authorCount !== 1 ? 's' : ''}
            </span>
            <span style={{ width: '8px' }}></span>
            <LinkButton href={publication.links.scholar} icon="school" label="View on Google Scholar" />
            <LinkButton href={publication.links.external} icon="open_in_new" label="Original Publication" />
            
            <button 
              type="button"
              className="md-chip" 
              onClick={copyBibtex} 
              aria-disabled={!publication.bibtex}
              title={publication.bibtex ? "Copy BibTeX" : "No BibTeX available"}
              style={{ cursor: publication.bibtex ? 'pointer' : 'not-allowed', backgroundColor: copied ? 'var(--md-primary)' : '', color: copied ? 'var(--md-on-primary)' : '', border: 'none', opacity: publication.bibtex ? 1 : 0.6 }}
            >
              <span className="md-icon" aria-hidden="true" style={{ fontSize: '14px', marginRight: '4px' }}>{copied ? 'check' : 'content_copy'}</span>
              <span aria-live="polite">{copied ? 'Copied' : 'BibTeX'}</span>
            </button>
          </div>
        </div>
        
        {publication.citations > 0 && (
          <button 
            className="md-btn-icon" 
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            aria-expanded={isExpanded}
            aria-controls={`paper-details-${publication.id}`}
            aria-label={isExpanded ? `Collapse details for ${publication.title}` : `Expand details for ${publication.title}`}
            title={isExpanded ? "Collapse" : "Expand"}
          >
            <span className="md-icon" aria-hidden="true">{isExpanded ? 'expand_less' : 'expand_more'}</span>
          </button>
        )}
      </div>

      {publication.citations > 0 && (
        <div id={`paper-details-${publication.id}`} className="md-card-details" onClick={(e) => e.stopPropagation()}>
          <div style={{ paddingTop: '8px' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
               <div>
                 <h4 className="md-headline" style={{ color: 'var(--md-primary)' }}>Citation Analytics</h4>
                 <p className="md-body" style={{ color: 'var(--md-on-surface-variant)' }}>Fetching up to 100 recent citations directly from Google Scholar.</p>
               </div>
               {advancedStats && (
                 <div className="md-stats-bar">
                   <span><strong>Peak Year:</strong> {advancedStats.peakYear} ({advancedStats.maxCites} citations)</span>
                   <span><strong>Avg:</strong> {advancedStats.avg} / year</span>
                 </div>
               )}
             </div>

             {citedByLoading && <div className="md-state-panel" role="status" style={{ height: '200px' }}><span className="md-icon" aria-hidden="true" style={{ animation: 'spin 1s linear infinite', fontSize: '32px' }}>refresh</span></div>}
             {citedByError && <div className="md-state-panel" role="alert" style={{ height: '200px', color: 'var(--md-error)' }}>{citedByError}</div>}
             {citedByData && (
               <>
                 {Object.keys(citedByData.citationsPerYear).length > 0 && (
                   <div style={{ height: '200px', marginBottom: '32px' }}>
                     <CitationTimeline citationsPerYear={citedByData.citationsPerYear} />
                   </div>
                 )}
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                   <h5 className="md-title">Citing Papers</h5>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                     <label htmlFor={`sort-citations-${publication.id}`} className="md-label" style={{ color: 'var(--md-on-surface-variant)' }}>Sort by</label>
                     <select id={`sort-citations-${publication.id}`} className="md-select" style={{ width: '150px' }} value={citedBySort} onChange={e => setCitedBySort(e.target.value)}>
                       <option value="relevance">Relevance</option>
                       <option value="trending">Trending</option>
                       <option value="newest">Newest</option>
                       <option value="oldest">Oldest</option>
                       <option value="title">Title</option>
                     </select>
                   </div>
                 </div>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                   {sortedCitingPapers.map((item, idx) => (
                     <CitingPaperCard key={idx} item={item} />
                   ))}
                   {sortedCitingPapers.length === 0 && <div className="md-body">No citing papers found.</div>}
                 </div>
               </>
             )}
          </div>
        </div>
      )}
    </div>
  );
}

function Avatar({ name, src, size = 'small' }) {
  const initials = String(name || 'S').split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
  const className = `md-avatar ${size}`;
  if (src) return <img className={className} src={src} alt="" aria-hidden="true" />;
  return <div className={className} aria-hidden="true">{initials}</div>;
}

function LinkButton({ href, icon, label }) {
  if (!href) return null;
  return (
    <a className="md-btn-icon" href={href} target="_blank" rel="noreferrer" title={label} aria-label={`${label} (opens in a new tab)`} style={{ textDecoration: 'none', backgroundColor: 'var(--md-surface-variant)' }}>
      <span className="md-icon" aria-hidden="true">{icon}</span>
    </a>
  );
}

function normalizeSearch(value) {
  return String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

function CitingPaperCard({ item }) {
  const detailsId = useId();
  const [isExpanded, setIsExpanded] = useState(false);
  const [abstract, setAbstract] = useState(item.snippet);
  const [loadingAbstract, setLoadingAbstract] = useState(false);
  
  const itemAuthorCount = item.authors ? item.authors.split(/,|\band\b/i).length : 0;

  useEffect(() => {
    if (isExpanded && item.title && !loadingAbstract && abstract === item.snippet) {
      const fetchAbstract = async () => {
        setLoadingAbstract(true);
        try {
          const res = await fetch(`https://api.crossref.org/works?query.title=${encodeURIComponent(item.title)}&select=abstract&rows=1`);
          const data = await res.json();
          const fetchedAbstract = data?.message?.items?.[0]?.abstract;
          if (fetchedAbstract) {
            const cleanAbstract = fetchedAbstract.replace(/<\/?[^>]+(>|$)/g, "").trim();
            if (cleanAbstract.length > item.snippet.length) {
              setAbstract(cleanAbstract);
            }
          }
        } catch (e) {
          // Fallback to snippet
        } finally {
          setLoadingAbstract(false);
        }
      };
      fetchAbstract();
    }
  }, [isExpanded, item.title, abstract, loadingAbstract, item.snippet]);

  return (
    <div 
      className={`md-card ${isExpanded ? 'expanded' : ''}`}
      style={{ padding: '12px', marginBottom: 0, backgroundColor: 'var(--md-surface)', border: '1px solid var(--md-outline-variant)', borderRadius: 'var(--md-border-radius-md)' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <a href={item.url} target="_blank" rel="noreferrer" aria-label={`${item.title} (opens in a new tab)`} className="md-body" style={{ fontWeight: 600, color: 'var(--md-primary)', textDecoration: 'none' }}>
            {item.title}
          </a>
          <p style={{ fontSize: '13px', color: 'var(--md-on-surface-variant)', marginTop: '4px' }}>{item.authors}</p>
        </div>
        <button 
          className="md-btn-icon" 
          style={{ width: '32px', height: '32px', marginLeft: '12px', flexShrink: 0 }}
          aria-expanded={isExpanded}
          aria-controls={detailsId}
          aria-label={isExpanded ? `Collapse details for ${item.title}` : `Expand details for ${item.title}`}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className="md-icon" aria-hidden="true" style={{ fontSize: '20px' }}>{isExpanded ? 'expand_less' : 'expand_more'}</span>
        </button>
      </div>

      <div className="md-chip-group" style={{ marginTop: '12px' }}>
        <span className="md-chip">{item.year || 'n.d.'}</span>
        <span className="md-chip">
          <span className="md-icon" aria-hidden="true" style={{ fontSize: '14px', marginRight: '4px' }}>format_quote</span>
          {formatNumber(item.citations || 0)} citations
        </span>
        <span className="md-chip">
          <span className="md-icon" aria-hidden="true" style={{ fontSize: '14px', marginRight: '4px' }}>group</span>
          {itemAuthorCount} author{itemAuthorCount !== 1 ? 's' : ''}
        </span>
      </div>
      
      <div id={detailsId} hidden={!isExpanded || !abstract} style={{ fontSize: '13px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--md-outline-variant)', color: 'var(--md-on-surface)', lineHeight: '1.5' }}>
        {loadingAbstract && <span className="md-icon" aria-hidden="true" style={{ fontSize: '14px', animation: 'spin 1s linear infinite', marginRight: '6px', verticalAlign: 'middle', color: 'var(--md-primary)' }}>refresh</span>}
        {abstract}
      </div>
    </div>
  );
}
