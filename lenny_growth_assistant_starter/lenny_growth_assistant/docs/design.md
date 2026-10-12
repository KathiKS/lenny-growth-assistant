# Design — The Lenny Growth Assistant

- Three-pane desktop layout: navigation, chat, sources/artifacts.
- Responsive layout collapses side panels on small screens.
- User messages and assistant messages have distinct visual treatments.
- Source filenames and passage previews are visible.
- Loading, empty, and error states are present.
- Controls use native buttons and text inputs with visible labels or clear context.
- Generated HTML must be rendered in a sandboxed iframe in the full implementation; do not execute untrusted markup in the main application DOM.
