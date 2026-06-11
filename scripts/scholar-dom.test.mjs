import { describe, expect, it } from 'vitest';
import { generateBibtex, parseCitedByHtml, parseProfileHtml, parsePublicationDetailHtml } from './scholar-dom.mjs';

const profileFixture = `
<html>
  <body>
    <div id="gsc_prf_in">Ada Scholar</div>
    <div class="gsc_prf_il">Example University</div>
    <div class="gsc_prf_il">Verified email at example.edu</div>
    <table id="gsc_rsb_st">
      <tr><td class="gsc_rsb_sc1">Citations</td><td class="gsc_rsb_std">1,234</td><td class="gsc_rsb_std">456</td></tr>
      <tr><td class="gsc_rsb_sc1">h-index</td><td class="gsc_rsb_std">22</td><td class="gsc_rsb_std">14</td></tr>
      <tr><td class="gsc_rsb_sc1">i10-index</td><td class="gsc_rsb_std">31</td><td class="gsc_rsb_std">19</td></tr>
    </table>
    <span class="gsc_g_t">2024</span><span class="gsc_g_t">2025</span>
    <span class="gsc_g_al">52</span><span class="gsc_g_al">61</span>
    <table id="gsc_a_t">
      <tr class="gsc_a_tr">
        <td>
          <a class="gsc_a_at" href="/citations?view_op=view_citation&citation_for_view=abc123">A careful paper</a>
          <div class="gs_gray">A Scholar, B Writer</div>
          <div class="gs_gray">Journal of Examples, 2025</div>
        </td>
        <td><a class="gsc_a_ac" href="/scholar?cites=42">17</a></td>
        <td class="gsc_a_y"><span class="gsc_a_h">2025</span></td>
      </tr>
    </table>
  </body>
</html>`;

describe('parseProfileHtml', () => {
  it('extracts profile metrics, yearly citations, and publications from Scholar DOM', () => {
    const parsed = parseProfileHtml(profileFixture, {
      user: 'abc',
      url: 'https://scholar.google.com/citations?user=abc'
    });

    expect(parsed.source.profileName).toBe('Ada Scholar');
    expect(parsed.source.affiliation).toBe('Example University');
    expect(parsed.metrics.totalCitations).toBe(1234);
    expect(parsed.metrics.hIndex).toBe(22);
    expect(parsed.metrics.citationsPerYear).toEqual({ 2024: 52, 2025: 61 });
    expect(parsed.publications).toHaveLength(1);
    expect(parsed.publications[0]).toMatchObject({
      id: 'abc123',
      title: 'A careful paper',
      authors: 'A Scholar, B Writer',
      venue: 'Journal of Examples, 2025',
      citations: 17,
      year: 2025
    });
  });
});

describe('parsePublicationDetailHtml', () => {
  it('extracts fields and navigation links from publication detail DOM', () => {
    const parsed = parsePublicationDetailHtml(`
      <div id="gsc_oci_title"><a href="https://example.edu/paper">A careful paper</a></div>
      <div class="gsc_oci_field">Journal</div><div class="gsc_oci_value">Journal of Examples</div>
      <a href="/scholar?cites=42">Cited by 17</a>
      <a href="/scholar?q=related:42">Related articles</a>
    `);

    expect(parsed.fields.journal).toBe('Journal of Examples');
    expect(parsed.links.external).toBe('https://example.edu/paper');
    expect(parsed.links.citedBy).toContain('/scholar?cites=42');
    expect(parsed.links.related).toContain('/scholar?q=related:42');
  });
});

describe('parseCitedByHtml', () => {
  it('returns citing paper samples from Scholar result DOM', () => {
    const papers = parseCitedByHtml(`
      <div class="gs_r gs_or gs_scl">
        <div class="gs_ri">
          <h3 class="gs_rt"><a href="https://example.edu/citing">A citing paper</a></h3>
          <div class="gs_a">C Author - 2026</div>
          <div class="gs_rs">A short abstract.</div>
        </div>
      </div>
    `);

    expect(papers).toEqual([
      {
        title: 'A citing paper',
        authors: 'C Author - 2026',
        snippet: 'A short abstract.',
        url: 'https://example.edu/citing'
      }
    ]);
  });
});

describe('generateBibtex', () => {
  it('generates a stable BibTeX entry from publication data', () => {
    const bibtex = generateBibtex({
      title: 'A careful paper',
      authors: 'A Scholar, B Writer',
      venue: 'Journal of Examples',
      year: 2025,
      citations: 17,
      links: { scholar: 'https://scholar.google.com/citations?view_op=view_citation' }
    });

    expect(bibtex).toContain('@article{ascholar2025a,');
    expect(bibtex).toContain('title = {A careful paper}');
    expect(bibtex).toContain('author = {A Scholar and B Writer}');
  });
});
