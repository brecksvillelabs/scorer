# Scorer v0.3.2 — photo persistence + Games Log

This patch hardens local photo persistence on mobile browsers and adds a dedicated Games Log from Home.

- Camera/gallery images now use multiple decode paths before falling back to storing the original image blob.
- IndexedDB writes complete before the UI reports success.
- Match albums remain local-only.
- Home adds Games Log with View and Delete actions.
- Deleting a log entry also deletes its locally stored match photos after confirmation.
