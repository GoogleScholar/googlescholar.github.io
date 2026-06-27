## 2025-02-24 - Clickable Cards Need Keyboard Support

**Learning:** When using `div` elements as clickable cards (like Recent Profiles or Citing Paper Cards), `onClick` alone is insufficient for accessibility. They miss out on keyboard navigation entirely.
**Action:** Always add `role="button"`, `tabIndex={0}`, an appropriate `aria-label` or text alternative, and handle `onKeyDown` (for Enter/Space) alongside `onClick` on non-interactive semantic elements masquerading as buttons. Include `cursor: pointer` for mouse users if missing.

## 2025-02-24 - Instant Search Needs Clear Action and Live Updates

**Learning:** An instant search input correctly updates results instantly, but mouse users lack a fast way to clear the input, and screen reader users aren't informed that the results have changed dynamically.
**Action:** Pair instant text inputs with a clear button (conditionally rendered) and ensure result count summaries use `aria-live="polite"` so changes are announced effectively without page reloads.
## 2024-06-16 - Interactive elements within an interactive element
**Learning:** Screen readers and accessibility tools struggle when an interactive element (like a link `<a>` or button `<button>`) is nested within another interactive element (like a `div` with `role="button"` or `tabIndex="0"`). This leads to confusing navigation and unpredictable behavior for keyboard users.
**Action:** Always ensure that interactive elements (buttons, links, inputs) are not nested inside other interactive elements or containers with interactive ARIA roles. Apply event listeners and roles to specific, non-nested trigger elements instead.

## 2026-06-17 - Material Icon Ligature Accessibility
**Learning:** Material Icons implemented with ligatures (e.g., `<span class="md-icon">group</span>`) are read aloud by screen readers as the literal text ("group") unless explicitly hidden, creating significant noise for icon-only buttons or decorative chips.
**Action:** Always add `aria-hidden="true"` to `.md-icon` elements, especially those inside chips or icon buttons, to ensure a clean screen reader experience.

## 2023-10-25 - Decorative Avatars
**Learning:** Screen readers will announce the `alt` text of avatars, which leads to redundant announcements when the avatar is rendered immediately adjacent to the user's name text.
**Action:** Apply `alt=""` and `aria-hidden="true"` to avatars that are purely decorative or immediately accompanied by the corresponding text label to improve screen reader flow.

## 2025-02-25 - Focus Management on Ephemeral Action Elements

**Learning:** When interactive elements (like a "Clear Search" or "Clear Filters" button) conditionally render based on state, clicking them causes them to be removed from the DOM. This causes screen readers and keyboard focus to drop entirely to the `<body>` element, disorienting the user.
**Action:** When creating conditionally rendered interactive elements that remove themselves on click, ensure you use a `ref` to programmatically move focus to a logical adjacent element (like the associated search input) immediately after the action completes.

## 2025-02-25 - Focusable Disabled Elements

**Learning:** When adding `disabled` attributes to interactive elements (e.g. `<button disabled>`), the element is removed from the tab order. This is problematic if the element has an informative tooltip (e.g. `title`) explaining *why* it's disabled. Keyboard users and screen reader users won't be able to access the tooltip.
**Action:** Use `aria-disabled="true"` instead of `disabled`. This allows the element to remain focusable so tooltips and labels can be accessed. Ensure you manually handle preventing the click event in the `onClick` handler via `e.preventDefault()`.

## 2025-02-25 - ARIA Labels for Third-Party Slider Handles

**Learning:** Third-party components like `rc-slider` may default to unhelpful generic labels (like "slider") for screen readers, missing context about what the bounds actually represent (e.g., start and end years).
**Action:** Always investigate the specific ARIA props available for third-party libraries (e.g., `ariaLabelForHandle` in `rc-slider`) and apply descriptive labels to give context to multi-thumb sliders.

## 2023-10-25 - External Link Announcements
**Learning:** Links opening in new tabs (`target="_blank"`) can be disorienting for screen reader users if they aren't explicitly informed of the context switch.
**Action:** Always append an audible warning like `(opens in a new tab)` to the `aria-label` of external links so users know what to expect before interacting.

## 2025-03-02 - External Links and Material Icons A11y

**Learning:** External links missing an audible warning can disorient screen reader users, and material icon ligatures are read literally if not hidden.
**Action:** Added `(opens in a new tab)` to `aria-label` attributes for `target="_blank"` links, and added `aria-hidden="true"` to `.md-icon` elements.
## 2026-06-23 - Focus States on Custom Interactive Elements
**Learning:** Adding `role="button"` and `tabIndex={0}` to a `<div>` (like the Recent Profiles cards) makes it focusable, but it lacks default browser focus styles. This makes it impossible for keyboard-only users to know which card is currently focused.
**Action:** Always ensure custom interactive elements explicitly implement a `:focus-visible` style, matching the application's primary focus indicator pattern.


## 2024-05-24 - Contextual ARIA Labels for Repeating Elements
**Learning:** Generic `aria-label`s like "Expand" or "Collapse details" on list items (like paper cards) are confusing for screen reader users who lose context when navigating through multiple items.
**Action:** Always include the specific item identifier (e.g., paper title) in the `aria-label` for interactive elements within a list, and use `aria-controls` to link expand/collapse buttons to their details container.

## 2025-03-02 - Deterministic IDs for Replicated Accordion Patterns

**Learning:** When creating reusable accordion components (like `CitingPaperCard`) where the underlying data items might lack guaranteed unique IDs, standard hardcoded IDs fail to uniquely associate the toggle button with its details panel (causing `aria-controls` to be invalid or non-unique).
**Action:** Use React's `useId()` hook to generate deterministic, unique IDs within component instances that can be reliably passed to both the interactive trigger's `aria-controls` attribute and the content panel's `id`.

## 2025-03-02 - Dynamic Document Titles in SPAs

**Learning:** In a Single Page Application (SPA), navigating between different views or profiles does not inherently update the `document.title`. Screen reader users rely on the document title to understand the context of the page they are on, and sighted users rely on it for tab management. Failing to update it leads to confusion when switching views.
**Action:** Always ensure that `document.title` is updated dynamically using a side effect (e.g. `useEffect` in React) when the primary contextual data (like a user profile) changes, and reset it appropriately when returning to a landing state.

## 2025-03-02 - Skip Link Target Management

**Learning:** When adding a "skip to main content" link to a Single Page Application with dynamic views, you must ensure the target ID (e.g., `#main-content`) is present on the correct semantic container (like `<main>`) across all possible rendering states. Additionally, applying `tabIndex="-1"` to the target element is necessary for older browsers to properly shift focus when the skip link is activated, and a `#main-content:focus { outline: none; }` CSS rule prevents an ugly focus ring from appearing around the entire page content after jumping.
**Action:** Add the skip link as the first focusable element in the DOM. Ensure every major view state (e.g., landing page, profile view) has a semantic `<main id="main-content" tabIndex="-1">` wrapper. Suppress the outline on focus for the target element to maintain visual polish.

## 2025-03-02 - Forgiving URL Input Parsing

**Learning:** Users frequently copy the entire URL from their browser's address bar rather than isolating the specific ID required by an application (e.g., pasting `https://scholar.google.com/citations?user=vJjq9LwAAAAJ` instead of just `vJjq9LwAAAAJ`). Failing to handle this gracefully creates immediate friction.
**Action:** Enhance single-purpose ID input fields to proactively attempt to parse the input as a URL using `new URL()`. If successful, silently extract the necessary query parameter and proceed; otherwise, fall back to treating the input as the raw ID. This makes the interface significantly more forgiving and intuitive without requiring extra user instruction.
