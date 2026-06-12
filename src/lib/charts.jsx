import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatNumber, sortedYears } from './format.js';

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div style={{
        backgroundColor: 'var(--md-surface)',
        border: '1px solid var(--md-outline-variant)',
        borderRadius: 'var(--md-border-radius-sm)',
        padding: '8px 12px',
        boxShadow: 'var(--md-elevation-2)',
        color: 'var(--md-on-surface)'
      }}>
        <p className="md-title" style={{ margin: 0, fontSize: '14px', marginBottom: '4px' }}>{label}</p>
        <p className="md-body" style={{ margin: 0, color: 'var(--md-primary)', fontWeight: 600 }}>
          {formatNumber(payload[0].value)} citations
        </p>
      </div>
    );
  }
  return null;
}

export function CitationTimeline({ citationsPerYear, selectedYear, onYearSelect }) {
  const data = useMemo(() => {
    return sortedYears(citationsPerYear).map(point => ({
      name: String(point.year),
      citations: point.citations,
      isSelected: String(point.year) === String(selectedYear)
    }));
  }, [citationsPerYear, selectedYear]);

  if (data.length === 0) {
    return <div className="empty-chart" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--md-on-surface-variant)' }}>No yearly citation data</div>;
  }

  // Find min/max for domain and padding
  const maxCitations = Math.max(...data.map(d => d.citations));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        onClick={(e) => {
          if (e && e.activeLabel && onYearSelect) {
            onYearSelect(e.activeLabel);
          }
        }}
        style={{ cursor: onYearSelect ? 'pointer' : 'default' }}
      >
        <defs>
          <linearGradient id="colorCitations" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--md-primary)" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="var(--md-primary)" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--md-outline-variant)" />
        <XAxis 
          dataKey="name" 
          axisLine={false} 
          tickLine={false} 
          tick={{ fill: 'var(--md-on-surface-variant)', fontSize: 12 }} 
          minTickGap={20}
        />
        <YAxis 
          axisLine={false} 
          tickLine={false} 
          tick={{ fill: 'var(--md-on-surface-variant)', fontSize: 12 }} 
          domain={[0, Math.ceil(maxCitations * 1.1)]}
          tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(1)}k` : value}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--md-outline)', strokeWidth: 1, strokeDasharray: '4 4' }} />
        <Area 
          type="monotone" 
          dataKey="citations" 
          stroke="var(--md-primary)" 
          strokeWidth={3}
          fillOpacity={1} 
          fill="url(#colorCitations)" 
          activeDot={{ r: 6, fill: 'var(--md-primary)', stroke: 'var(--md-surface)', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function PublicationImpactChart({ publications, selectedId, onSelect }) {
  const ranked = [...publications]
    .sort((a, b) => (Number(b.citations) || 0) - (Number(a.citations) || 0))
    .slice(0, 12);

  if (ranked.length === 0) {
    return <div className="empty-chart">No publication data</div>;
  }

  const maxCitations = Math.max(...ranked.map((publication) => Number(publication.citations) || 0), 1);

  return (
    <div className="impact-bars" role="list" aria-label="Top cited publications">
      {ranked.map((publication) => {
        const citations = Number(publication.citations) || 0;
        const width = `${Math.max((citations / maxCitations) * 100, 3)}%`;
        const isSelected = publication.id === selectedId;

        return (
          <button
            className={`impact-bar ${isSelected ? 'is-selected' : ''}`}
            key={publication.id}
            type="button"
            onClick={() => onSelect(publication.id)}
            title={publication.title}
          >
            <span className="impact-bar-title">{publication.title}</span>
            <span className="impact-track" aria-hidden="true">
              <span style={{ width }} />
            </span>
            <span className="impact-count">{formatNumber(citations)}</span>
          </button>
        );
      })}
    </div>
  );
}
