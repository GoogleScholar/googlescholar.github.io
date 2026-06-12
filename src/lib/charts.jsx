import { formatNumber, sortedYears } from './format.js';

export function CitationTimeline({ citationsPerYear, selectedYear, onYearSelect }) {
  const points = sortedYears(citationsPerYear);

  if (points.length === 0) {
    return <div className="empty-chart">No yearly citation data</div>;
  }

  const width = 720;
  const height = 220;
  const padding = { top: 18, right: 22, bottom: 32, left: 44 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...points.map((point) => point.citations), 1);
  const minYear = points[0].year;
  const maxYear = points[points.length - 1].year;
  const yearSpan = Math.max(maxYear - minYear, 1);

  const coordinates = points.map((point) => {
    const x = padding.left + ((point.year - minYear) / yearSpan) * chartWidth;
    const y = padding.top + chartHeight - (point.citations / maxValue) * chartHeight;
    return { ...point, x, y };
  });

  const path = coordinates
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');

  const areaPath = `${path} L ${coordinates[coordinates.length - 1].x.toFixed(2)} ${
    padding.top + chartHeight
  } L ${coordinates[0].x.toFixed(2)} ${padding.top + chartHeight} Z`;

  const labels = coordinates.filter((_, index) => {
    if (coordinates.length <= 8) {
      return true;
    }
    return index === 0 || index === coordinates.length - 1 || index % 2 === 0;
  });

  return (
    <svg className="timeline-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Citations by year">
      <line x1={padding.left} y1={padding.top + chartHeight} x2={width - padding.right} y2={padding.top + chartHeight} />
      <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + chartHeight} />
      <text x={padding.left - 8} y={padding.top + 5} textAnchor="end">
        {formatNumber(maxValue)}
      </text>
      <text x={padding.left - 8} y={padding.top + chartHeight + 5} textAnchor="end">
        0
      </text>
      <path className="chart-area" d={areaPath} />
      <path className="chart-line" d={path} />
      {coordinates.map((point) => {
        const isSelected = String(point.year) === String(selectedYear);
        return (
          <g 
            key={point.year}
            onClick={() => onYearSelect && onYearSelect(point.year)}
            style={{ cursor: onYearSelect ? 'pointer' : 'default' }}
          >
            <circle 
              cx={point.x} 
              cy={point.y} 
              r={isSelected ? "6" : "4"} 
              style={{
                fill: isSelected ? 'var(--md-primary)' : 'var(--md-surface)',
                strokeWidth: isSelected ? 3 : 2
              }}
            />
            <title>
              {point.year}: {formatNumber(point.citations)} citations
            </title>
          </g>
        );
      })}
      {labels.map((point) => (
        <text key={`label-${point.year}`} x={point.x} y={height - 9} textAnchor="middle">
          {point.year}
        </text>
      ))}
    </svg>
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
