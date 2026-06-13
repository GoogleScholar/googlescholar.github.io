## 2024-06-13 - Focus Visible Accessibility
**Learning:** The application was missing explicit `:focus-visible` styles for its interactive buttons (`.md-btn`, `.md-btn-icon`), which is a critical accessibility requirement for keyboard navigation.
**Action:** Always ensure that any new interactive elements added to the application have explicit `:focus-visible` styles defined in `src/styles.css`, and not just `:focus` or `:hover`.
