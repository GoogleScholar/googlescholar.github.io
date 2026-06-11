<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: public, max-age=3600');

include_once __DIR__ . '/simple_html_dom.php';

function respond_error($status, $message)
{
    http_response_code($status);
    echo json_encode(array(
        'error' => array(
            'message' => $message,
            'status' => $status
        )
    ), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

function clean_text($value)
{
    $value = html_entity_decode((string) $value, ENT_QUOTES, 'UTF-8');
    $value = preg_replace('/\s+/u', ' ', $value);
    return trim($value);
}

function node_text($node)
{
    if (!$node) {
        return '';
    }

    return clean_text($node->plaintext);
}

function parse_number($value)
{
    $value = preg_replace('/[^\d-]/', '', (string) $value);
    return $value === '' ? 0 : (int) $value;
}

function scholar_url($href)
{
    $href = trim((string) $href);
    if ($href === '' || strpos($href, 'javascript:') === 0) {
        return null;
    }

    if (preg_match('/^https?:\/\//', $href)) {
        return $href;
    }

    if ($href[0] === '/') {
        return 'https://scholar.google.com' . $href;
    }

    return 'https://scholar.google.com/' . $href;
}

function slug_key($value)
{
    $value = strtolower(clean_text($value));
    $value = preg_replace('/[^a-z0-9]+/', '_', $value);
    return trim($value, '_');
}

function bibtex_escape($value)
{
    $value = str_replace(array('\\', '{', '}'), array('\\\\', '\\{', '\\}'), clean_text($value));
    return $value;
}

function bibtex_key($publication)
{
    $authors = isset($publication['authors']) ? $publication['authors'] : 'paper';
    $year = isset($publication['year']) && $publication['year'] > 0 ? $publication['year'] : 'nd';
    $title = isset($publication['title']) ? $publication['title'] : 'untitled';

    $author_parts = preg_split('/,|\band\b/i', $authors);
    $author = isset($author_parts[0]) ? $author_parts[0] : 'paper';
    $author = preg_replace('/[^A-Za-z0-9]+/', '', $author);

    $title_word = preg_replace('/[^A-Za-z0-9]+/', '', strtok($title, ' '));
    $key = strtolower($author . $year . $title_word);

    return $key === '' ? 'scholarpaper' : $key;
}

function build_bibtex($publication)
{
    $fields = array(
        'title' => isset($publication['title']) ? $publication['title'] : '',
        'author' => isset($publication['authors']) ? str_replace(', ', ' and ', $publication['authors']) : '',
        'journal' => isset($publication['venue']) ? $publication['venue'] : '',
        'year' => isset($publication['year']) && $publication['year'] > 0 ? (string) $publication['year'] : '',
        'url' => isset($publication['links']['scholar']) ? $publication['links']['scholar'] : '',
        'note' => isset($publication['citations']) ? 'Cited by ' . $publication['citations'] : ''
    );

    $lines = array('@article{' . bibtex_key($publication) . ',');
    foreach ($fields as $name => $value) {
        if (clean_text($value) !== '') {
            $lines[] = '  ' . $name . ' = {' . bibtex_escape($value) . '},';
        }
    }

    $last = count($lines) - 1;
    if ($last > 0) {
        $lines[$last] = rtrim($lines[$last], ',');
    }
    $lines[] = '}';

    return implode("\n", $lines);
}

$user = isset($_GET['user']) ? trim($_GET['user']) : '';
if ($user === '') {
    respond_error(400, 'Missing required user parameter.');
}

if (!preg_match('/^[A-Za-z0-9_-]+$/', $user)) {
    respond_error(400, 'Invalid user parameter. Expected a Google Scholar profile id.');
}

$query = http_build_query(array(
    'user' => $user,
    'hl' => isset($_GET['hl']) ? $_GET['hl'] : 'en',
    'pagesize' => isset($_GET['pagesize']) ? min(100, max(1, (int) $_GET['pagesize'])) : 100,
    'view_op' => 'list_works',
    'sortby' => isset($_GET['sortby']) ? $_GET['sortby'] : 'pubdate'
));
$source_url = 'https://scholar.google.com/citations?' . $query;

$html = new simple_html_dom();
if (!@$html->load_file($source_url)) {
    respond_error(502, 'Unable to load the Google Scholar profile DOM.');
}

$stat_rows = $html->find('#gsc_rsb_st tr');
$summary = array();
foreach ($stat_rows as $row) {
    $label = node_text($row->find('.gsc_rsb_sc1', 0));
    $cells = $row->find('.gsc_rsb_std');
    if ($label !== '' && count($cells) > 0) {
        $summary[slug_key($label)] = array(
            'all' => parse_number(node_text($cells[0])),
            'recent' => isset($cells[1]) ? parse_number(node_text($cells[1])) : 0
        );
    }
}

$years = $html->find('.gsc_g_t');
$scores = $html->find('.gsc_g_al');
$citations_per_year = array();
foreach ($years as $index => $year_node) {
    if (!isset($scores[$index])) {
        continue;
    }

    $year = node_text($year_node);
    if ($year !== '') {
        $citations_per_year[$year] = parse_number(node_text($scores[$index]));
    }
}

$profile_lines = $html->find('.gsc_prf_il');
$verified_email = '';
foreach ($profile_lines as $line) {
    $text = node_text($line);
    if (stripos($text, 'verified email') !== false) {
        $verified_email = $text;
    }
}

$publications = array();
foreach ($html->find('#gsc_a_t .gsc_a_tr') as $row) {
    $title_node = $row->find('.gsc_a_at', 0);
    $citation_node = $row->find('.gsc_a_ac', 0);
    $year_node = $row->find('.gsc_a_h', 0);
    $gray = $row->find('.gs_gray');

    $title = node_text($title_node);
    if ($title === '') {
        continue;
    }

    $publication = array(
        'id' => md5($title . node_text($year_node)),
        'title' => $title,
        'authors' => isset($gray[0]) ? node_text($gray[0]) : '',
        'venue' => isset($gray[1]) ? node_text($gray[1]) : '',
        'citations' => parse_number(node_text($citation_node)),
        'year' => parse_number(node_text($year_node)),
        'links' => array(
            'scholar' => $title_node ? scholar_url($title_node->href) : null,
            'citedBy' => $citation_node ? scholar_url($citation_node->href) : null
        ),
        'relatedPapers' => array()
    );
    $publication['bibtex'] = build_bibtex($publication);
    $publications[] = $publication;
}

$output = array(
    'source' => array(
        'kind' => 'google-scholar-dom',
        'user' => $user,
        'url' => $source_url,
        'fetchedAt' => gmdate('c'),
        'profileName' => node_text($html->find('#gsc_prf_in', 0)),
        'affiliation' => isset($profile_lines[0]) ? node_text($profile_lines[0]) : '',
        'verifiedEmail' => $verified_email
    ),
    'metrics' => array(
        'totalCitations' => isset($summary['citations']['all']) ? $summary['citations']['all'] : 0,
        'hIndex' => isset($summary['h_index']['all']) ? $summary['h_index']['all'] : 0,
        'i10Index' => isset($summary['i10_index']['all']) ? $summary['i10_index']['all'] : 0,
        'summary' => $summary,
        'citationsPerYear' => $citations_per_year
    ),
    'publications' => $publications
);

echo json_encode($output, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
