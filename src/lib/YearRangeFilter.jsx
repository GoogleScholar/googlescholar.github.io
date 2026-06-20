import React, { useMemo } from 'react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import { BarChart, Bar, Cell, ResponsiveContainer } from 'recharts';
import { normalizeYear } from './format.js';

export function YearRangeFilter({ publications, yearRange, onChange }) {
  // Compute absolute min and max years from the full dataset
  const { minYear, maxYear, data } = useMemo(() => {
    const validPubs = publications.filter(p => normalizeYear(p.year) !== null);
    if (validPubs.length === 0) return { minYear: 0, maxYear: 0, data: [] };
    
    const years = validPubs.map(p => normalizeYear(p.year));
    const min = Math.min(...years);
    const max = Math.max(...years);
    
    // Create an array of bins for every year from min to max
    const counts = {};
    validPubs.forEach(p => {
      const y = normalizeYear(p.year);
      counts[y] = (counts[y] || 0) + 1;
    });
    
    const data = [];
    for (let i = min; i <= max; i++) {
      data.push({ year: i, count: counts[i] || 0 });
    }
    return { minYear: min, maxYear: max, data };
  }, [publications]);

  if (data.length === 0 || minYear === maxYear) {
    return null; // Not enough data to show a range filter
  }

  // Ensure yearRange defaults to full range if not set
  const currentMin = yearRange[0] ?? minYear;
  const currentMax = yearRange[1] ?? maxYear;

  return (
    <div style={{ marginTop: '24px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
        <label className="md-title" style={{ fontSize: '14px', margin: 0 }}>Year Published</label>
        <span className="md-body" style={{ fontSize: '13px', color: 'var(--md-on-surface-variant)' }}>
          {currentMin} - {currentMax}
        </span>
      </div>
      
      {/* Histogram */}
      <div style={{ height: '50px', width: '100%', marginBottom: '-6px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 0, left: 7, right: 7, bottom: 0 }}>
            <Bar dataKey="count" isAnimationActive={false}>
              {data.map((entry, index) => {
                const isActive = entry.year >= currentMin && entry.year <= currentMax;
                return (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={isActive ? 'var(--md-primary)' : 'var(--md-outline-variant)'} 
                    style={{ transition: 'fill 0.2s ease' }}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Slider */}
      <div style={{ padding: '0 10px' }}>
        <Slider
          range
          min={minYear}
          max={maxYear}
          value={[currentMin, currentMax]}
          onChange={onChange}
          step={1}
          allowCross={false}
          ariaLabelForHandle={['Start year', 'End year']}
          styles={{
            track: { backgroundColor: 'var(--md-primary)', height: '4px' },
            rail: { backgroundColor: 'var(--md-outline-variant)', height: '4px' },
            handle: {
              borderColor: 'var(--md-primary)',
              backgroundColor: 'var(--md-surface)',
              height: '16px',
              width: '16px',
              marginTop: '-6px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              opacity: 1
            }
          }}
        />
      </div>
    </div>
  );
}
