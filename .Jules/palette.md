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
