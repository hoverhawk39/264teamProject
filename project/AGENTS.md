# Codex development contract

Read README.md, docs/HANDOFF.md, docs/ACCEPTANCE.md before editing.
Preserve existing user-approved UI and established route flow.

- Rotation is persisted in 90-degree increments. Original PDF bytes never change. Masks and notes (including text orientation) follow page rotation. Preview and export must agree.
- Any edit, batch operation, undo or redo invalidates confirmation on affected pages. Never auto-confirm batch targets. Export only complete documents with every page confirmed.
- Export original basename + _NL.pdf, preserve page order, dimensions and count. Unmasked pages preserve original vector/text; masked pages irreversibly remove source content and become a single lossless 600-DPI image with white masks. Notes are independent editable PDF Text annotations above either page type. Do not silently lower resolution; keep the 80MP guard for masked pages. About 100KB per PDF is a target, not a hard cap; show actual size and ask before downloading larger files.
- Source PDFs are binary files, not Base64 localStorage. Browser metadata is prototype storage; local server is single-user test-only.
- Batch mask operation adds selected regions to selected pages, skips duplicates, retains existing regions, and is one history transaction.
- Final preview reads the generated output PDF. Reuse exact cached bytes for unchanged export, invalidate by full edit/revision key.
- Do not remove original PDFs or overwrite existing cases during backup restore. Validate backup manifest and restore atomically at metadata commit.
- Do not expose local.py on LAN without authentication, authorization, CSRF/origin protection, shared storage API, revision conflict handling and deployment review.
- AI and member management are prototype UI; do not claim real inference or access control.
- React/Ant Design migration was authorized on 2026-10-01. Use src/ui and the explicit dist/ui-adapter.js bridge; preserve the PDF engine and data contracts. Keep new modules bounded; gradually replace legacy wrappers with explicit imports and APIs.
- Run node tests/pdf-rotation.mjs and node tests/workflow-state.cjs for related changes. Use actual print fixtures for PDF quality acceptance.
- Never commit local-data or user PDFs. Test fixtures must be synthetic.
