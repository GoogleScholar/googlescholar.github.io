import { useEffect, useMemo, useState } from 'react';
import { CitationTimeline } from './lib/charts.jsx';
import { formatNumber, getPublicationYearRange, truncateText } from './lib/format.js';
import { normalizeScholarPayload } from './lib/scholarData.js';

const SORT_OPTIONS = [
  { value: 'citations', label: 'Most cited' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'title', label: 'Title' }
];

const BACKEND_URL = 'https://backend-3aen.onrender.com';

function getInitialUserId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('user') || '';
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

function getInitialDarkMode() {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

export default function App() {
  const [userId, setUserId] = useState(getInitialUserId);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState({ loading: false, error: '' });
  
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('citations');
  const [yearFilter, setYearFilter] = useState('all');
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
  const profileName = data?.source?.profileName || 'Scholar profile';
  const affiliation = data?.source?.affiliation || '';
  const avatarUrl = data?.source?.avatarUrl || '';
  const hasFilters = query || yearFilter !== 'all' || sortBy !== 'citations';

  function resetFilters() {
    setQuery('');
    setYearFilter('all');
    setSortBy('citations');
  }

  return (
    <>
      <header className="md-app-bar">
        <a className="brand" href="/" onClick={goHome}>
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

      {!userId && <LandingPage onNavigate={navigateToUser} />}

      {userId && status.loading && (
        <div className="md-state-panel">
          <span className="md-icon" style={{ fontSize: '48px', marginBottom: '16px', animation: 'spin 1s linear infinite' }}>refresh</span>
          <h2 className="md-headline">Fetching Profile...</h2>
          <p className="md-body">Querying Google Scholar for {userId}</p>
        </div>
      )}

      {userId && status.error && (
        <div className="md-state-panel">
          <span className="md-icon" style={{ fontSize: '48px', color: 'var(--md-error)', marginBottom: '16px' }}>error</span>
          <h2 className="md-headline" style={{ color: 'var(--md-error)' }}>Unable to load Scholar profile</h2>
          <p className="md-body" style={{ maxWidth: '400px', marginTop: '8px' }}>{status.error}</p>
          <button className="md-btn md-btn-primary" style={{ marginTop: '24px' }} onClick={() => navigateToUser(userId)}>
            Try Again
          </button>
        </div>
      )}

      {userId && !status.loading && !status.error && data && (
        <div className="md-layout">
          <aside className="md-sidebar">
            <div className="md-input-group">
              <label className="md-input-label">Search papers</label>
              <div className="md-input-wrapper">
                <span className="md-icon">search</span>
                <input className="md-input" type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title or authors..." />
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

            {metrics.citationsPerYear && Object.keys(metrics.citationsPerYear).length > 0 && (
              <div className="md-card" style={{ marginBottom: '32px' }}>
                <div className="md-card-header" style={{ marginBottom: '16px' }}>
                  <h2 className="md-headline">Citations by year</h2>
                </div>
                <div style={{ height: '150px' }}>
                <CitationTimeline 
                  citationsPerYear={metrics.citationsPerYear}
                  selectedYear={yearFilter}
                  onYearSelect={(year) => setYearFilter(String(year))}
                />
                </div>
              </div>
            )}

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

function LandingPage({ onNavigate }) {
  const [input, setInput] = useState('');
  const recentProfiles = getRecentProfiles();

  function handleSubmit(e) {
    e.preventDefault();
    if (input.trim()) onNavigate(input.trim());
  }

  return (
    <div className="md-landing-container">
      <div className="md-landing-hero">
        <h1 className="md-display" style={{ marginBottom: '16px', color: 'var(--md-primary)' }}>Analyze any Scholar Profile</h1>
        <p className="md-body" style={{ fontSize: '18px', color: 'var(--md-on-surface-variant)', marginBottom: '32px', maxWidth: '600px', margin: '0 auto 32px' }}>
          Instantly fetch, sort, and analyze publications and citations. 
          Enter a Google Scholar ID below to get started.
        </p>

        <form onSubmit={handleSubmit} style={{ maxWidth: '500px', margin: '0 auto', display: 'flex', gap: '12px' }}>
          <div className="md-input-wrapper" style={{ flex: 1 }}>
            <span className="md-icon">person</span>
            <input 
              className="md-input" 
              type="text" 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              placeholder="e.g. vJjq9LwAAAAJ" 
              required
            />
          </div>
          <button type="submit" className="md-btn md-btn-primary" style={{ padding: '0 32px', fontSize: '16px' }}>
            Analyze
          </button>
        </form>
      </div>

      {recentProfiles.length > 0 && (
        <div className="md-recent-profiles">
          <h2 className="md-title" style={{ marginBottom: '24px', textAlign: 'center' }}>Recent Profiles</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', maxWidth: '1000px', margin: '0 auto' }}>
            {recentProfiles.map(profile => (
              <div 
                key={profile.user} 
                className="md-card" 
                style={{ marginBottom: '0', alignItems: 'center', textAlign: 'center', padding: '24px 16px' }}
                onClick={() => onNavigate(profile.user)}
              >
                <Avatar name={profile.name} src={profile.avatarUrl} size="large" />
                <h3 className="md-title" style={{ marginTop: '12px', marginBottom: '4px' }}>{profile.name}</h3>
                <p className="md-body" style={{ fontSize: '14px', color: 'var(--md-on-surface-variant)' }}>
                  {truncateText(profile.affiliation, 60)}
                </p>
                <span className="md-chip" style={{ marginTop: '16px' }}>{profile.user}</span>
              </div>
            ))}
          </div>
        </div>
      )}
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
  const [citedByData, setCitedByData] = useState(null);
  const [citedByLoading, setCitedByLoading] = useState(false);
  const [citedByError, setCitedByError] = useState('');
  const [showCitationAnalysis, setShowCitationAnalysis] = useState(false);
  const [citedBySort, setCitedBySort] = useState('relevance');

  const sortedCitingPapers = useMemo(() => {
    if (!citedByData?.items) return [];
    let items = [...citedByData.items];
    if (citedBySort === 'newest') {
      items.sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0));
    } else if (citedBySort === 'oldest') {
      items.sort((a, b) => (Number(a.year) || 9999) - (Number(b.year) || 9999));
    } else if (citedBySort === 'title') {
      items.sort((a, b) => a.title.localeCompare(b.title));
    }
    return items;
  }, [citedByData, citedBySort]);
  
  async function copyBibtex(event) {
    event.stopPropagation();
    if (!publication.bibtex) return;
    await navigator.clipboard.writeText(publication.bibtex);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  async function loadCitations(event) {
    event.stopPropagation();
    
    if (showCitationAnalysis) {
      setShowCitationAnalysis(false);
      return;
    }
    
    setShowCitationAnalysis(true);
    if (!isExpanded) onToggle();
    
    if (citedByData || citedByLoading || !publication.links.citedBy) return;
    
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
  }

  return (
    <div className={`md-card ${isExpanded ? 'expanded' : ''}`}>
      <div className="md-card-header" onClick={onToggle} style={{ cursor: 'pointer' }}>
        <div style={{ flex: 1 }}>
          <h3 className="md-title md-card-title">{publication.title}</h3>
          <p className="md-card-subtitle">{publication.authors}</p>
          <p className="md-card-subtitle" style={{ marginTop: '4px' }}>{publication.venue}</p>
          
          <div className="md-chip-group" style={{ marginTop: '12px' }}>
            <span className="md-chip">{publication.year || 'n.d.'}</span>
            <button 
              className="md-chip" 
              style={{ cursor: publication.citations > 0 ? 'pointer' : 'default', border: showCitationAnalysis ? '1px solid var(--md-primary)' : '1px solid transparent' }}
              onClick={publication.citations > 0 ? loadCitations : undefined}
              disabled={publication.citations === 0}
              title="Click to analyze citations"
            >
              <span className="md-icon" style={{ fontSize: '14px', marginRight: '4px' }}>format_quote</span>
              {formatNumber(publication.citations)} citations
            </button>
          </div>
        </div>
        
        <button className="md-btn-icon" onClick={onToggle}>
          <span className="md-icon">{isExpanded ? 'expand_less' : 'expand_more'}</span>
        </button>
      </div>

      <div className="md-card-details">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div style={{ minWidth: 0 }}>
            <span className="md-label" style={{ color: 'var(--md-on-surface-variant)', display: 'block', marginBottom: '8px' }}>BibTeX</span>
            <pre>{publication.bibtex || 'No BibTeX available'}</pre>
            <button className="md-btn md-btn-text" style={{ marginTop: '8px' }} onClick={copyBibtex} disabled={!publication.bibtex}>
              <span className="md-icon">{copied ? 'check' : 'content_copy'}</span>
              {copied ? 'Copied' : 'Copy BibTeX'}
            </button>
          </div>
          
          <div style={{ minWidth: 0 }}>
            <span className="md-label" style={{ color: 'var(--md-on-surface-variant)', display: 'block', marginBottom: '8px' }}>Links</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
              <LinkButton href={publication.links.scholar} icon="school" label="Scholar" />
              <LinkButton href={publication.links.external} icon="open_in_new" label="Publication" />
              <LinkButton href={publication.links.citedBy} icon="format_quote" label="Cited by" />
            </div>
          </div>
        </div>

        {showCitationAnalysis && (
          <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--md-outline-variant)' }}>
             <h4 className="md-title" style={{ marginBottom: '16px' }}>Citation Analysis</h4>
             {citedByLoading && <div className="md-body">Loading citing papers...</div>}
             {citedByError && <div className="md-body" style={{ color: 'var(--md-error)' }}>{citedByError}</div>}
             {citedByData && (
               <>
                 {Object.keys(citedByData.citationsPerYear).length > 0 && (
                   <div style={{ height: '120px', marginBottom: '24px' }}>
                     <CitationTimeline citationsPerYear={citedByData.citationsPerYear} />
                   </div>
                 )}
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                   <h5 className="md-title" style={{ fontSize: '14px' }}>Citing Papers</h5>
                   <select className="md-select" style={{ width: '150px', padding: '4px 24px 4px 8px', fontSize: '12px' }} value={citedBySort} onChange={e => setCitedBySort(e.target.value)}>
                     <option value="relevance">Relevance</option>
                     <option value="newest">Newest</option>
                     <option value="oldest">Oldest</option>
                     <option value="title">Title</option>
                   </select>
                 </div>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                   {sortedCitingPapers.map((item, idx) => (
                     <div key={idx} style={{ padding: '12px', backgroundColor: 'var(--md-surface-variant)', borderRadius: 'var(--md-border-radius-sm)' }}>
                       <a href={item.url} target="_blank" rel="noreferrer" className="md-body" style={{ fontWeight: 500, color: 'var(--md-primary)', textDecoration: 'none' }} onClick={(e) => e.stopPropagation()}>
                         {item.title}
                       </a>
                       <p style={{ fontSize: '12px', color: 'var(--md-on-surface-variant)', marginTop: '4px' }}>{item.authors}</p>
                       <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.8 }}>{item.snippet}</div>
                     </div>
                   ))}
                   {sortedCitingPapers.length === 0 && <div className="md-body">No citing papers found.</div>}
                 </div>
               </>
             )}
          </div>
        )}
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

function normalizeSearch(value) {
  return String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}
