# PDF integration v56

- Source binary: IndexedDB `drawing-desk-pdf/sources`, unique UUID per imported document.
- Existing `case.files` is a backwards-compatible page queue, not physical document count. `pdfGroups` derives document groups; all new pages carry sourceId, pageIndex, pageCount, width/height in points, revision, rule, masks, notes.
- Overlay geometry is normalized percentages of the rotated CropBox. MuPDF converts to page-space points. This retains existing editor data and supports heterogeneous page dimensions.
- Engine runs in a module Worker with vendored WASM, no CDN. Original PDF is read-only. Export clones pages into a new document, applies redactions (pixels for images, touched vector paths, text), burns vector note appearance, then renders each page at 600 dpi and writes exactly one RGB image per output page with lossless compression. No source text, annotations, or optional-content layers are copied to the final document.
- Preview uses the exact same processed-page function as export. Approval is gated on successful preview of the current edit key. Source scan detail cannot be improved; exported vectors become pixels. Visible page dimensions and orientation are preserved; exported page rotation is normalized to zero.
- Whole PDF only: all pages approved, indexes/count validated. ZIP preserves original basenames with _NL before .pdf; duplicate names are placed in separate folders to prevent overwriting. Includes JSON manifest. Serial processing, errors isolated, immediate cancellation.
- Notes use embedded CJK font, Latin Helvetica regular/bold; numbered lists and bold are converted to vector runs. Unsupported glyphs and overflow reject output rather than silently dropping text. Final preview is authoritative (HTML editor fonts can differ).
- Original source annotations/forms are baked before processing. Touched vector paths may be removed outside mask bounds; user must inspect actual final preview before approval.
- Case metadata retains prior synchronous localStorage semantics; PDFs are not base64-encoded there. Storage quota errors are surfaced and new source blobs rolled back when metadata commit fails. Confirmed case deletion removes its blobs.
- Full offline installation/package is not implemented; all PDF engine dependencies are local assets ready for an offline deployment. Existing hosted site still needs initial page access.

## Historical validation (v53 vector export; not v56 raster export)
- 3-page mixed portrait/landscape/rotated PDF: page boxes/rotation retained, sensitive test text removed, searchable technical text/vector lines retained. Unmodified technical region pixels exactly equal at 300dpi.
- 200-page PDF: count, order, all page text and page boxes roundtrip verified.
- Cropped PDF: CropBox/MediaBox/rotation retained.
- Invalid file and incomplete-page export rejected.
- DOM integration harness: case/work/review/export routes render; review zoom controls; confirmation stays on page; edits revoke confirmation; whole-document export gate; import dialog; all-page customer rule; IndexedDB blob roundtrip and removal.
- No physical printer test or full real-browser visual QA performed in this environment.

## Import recovery (v55)
- Worker readiness handshake waits for WASM before posting requests; dynamic import registers the worker handler before initialization. Startup and operation errors/timeouts are surfaced.
- Cancel, close icon, and Escape cancel immediately. Pending reads are detached, active worker is terminated, writes abort, newly stored sources roll back; no cancelled batch reaches case metadata. Retry creates a fresh worker.
- Verified with Node worker adapter and a real three-page PDF; isolated tests cover delayed readiness, startup failure, worker cancellation, stalled file-read cancellation, modal close, and retry. Full browser QA remains unavailable.

## Dependencies
MuPDF 1.27.0 (AGPLv3-or-later/commercial dual licensing), JSZip (MIT).
Before proprietary distribution, resolve MuPDF licensing; see dist/OPEN_SOURCE.txt.

## Single-image export v56
- Default export: one flattened image per page at 600 dpi, lossless image encoding; multiple pages stay separate. Manifest states the output mode; PDF filenames contain only the original basename plus _NL.
- The original source remains in IndexedDB for editing. Export text is not searchable; rasterization has finite resolution, not mathematical vector equivalence.
- Reject pages over 80 million pixels before processing; never silently downsample. Desktop-side large-sheet output remains future work.
- Verified a three-page portrait/landscape/rotated fixture: one image per page, no annotations/widgets/OCGs/text, visible dimensions retained, pixel-identical source/output rendering at 600 dpi without edits. Edited fixture has masks and notes embedded in the same image.
- Export parent route verified as review. Physical printing and actual-browser UI verification were not performed.

## Download handoff v61
- Generate ZIP first, then expose a native anchor with blob URL and download filename in the result dialog and export page. No asynchronous synthetic auto-click.
- Keep the URL until next generation or document unload, supporting repeat downloads after closing the dialog. Empty blobs are rejected.
- Only record a download request after the user clicks; browser disk completion cannot be detected. Historical exported statuses are not migrated.
- Verified real 3-page PDF ZIP creation/reopening/parsing and isolated link/status/retry checks. Actual browser download verification remains unavailable.

## Review simplification v62
- Workbench confirmation alone qualifies each page. Any subsequent edit clears acceptance and export status; whole-document export still requires all pages ready. Previously accepted pages also qualify without a second checklist.
- Review is read-only: collapsible search/status panel, top navigation, SVG zoom buttons, pointer-captured grab-to-pan inside fixed viewport. No duplicate title subtitle or final checklist.
- Isolated checks verified whole-PDF gating, edit invalidation, confirmation and review markup. No actual-browser visual QA.


## Workbench compact controls
Single-page files show status directly; multi-page PDFs remain grouped. File list paginates 20 documents and keeps search, status, and sorting in a collapsible panel. Masks use black/white; new notes use five pastel colors. Geometry is edited on canvas. Note underline is preserved through preview and PDF rendering.
