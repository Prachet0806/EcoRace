# ADR-FE-006 — Rosso Telemetry theme + toggle roadmap

Status: Accepted (dark live, light stubbed).

## Decision

Ferrari-inspired (not trademarked) dark UI: carbon surfaces, Rosso Corsa
accents, Giallo Modena highlights, timing-tower results, CARTO dark-matter
basemap, Archivo display + IBM Plex Mono telemetry numerals via next/font.

No prancing-horse imagery, Scuderia marks, or "Ferrari" naming in UI/copy.
The red/yellow pinstripe bar is the signature brand accent.

## Token architecture (enables the future toggle)

- Single source: `globals.css` custom properties under
  `:root[data-theme="dark"]`, consumed via Tailwind v4 `@theme inline`
  (`bg-card`, `text-mute`, `font-tel`, …).
- Components must not use hardcoded palettes (no `slate-*`/`sky-*`).
- `<html data-theme="dark">` set in `layout.tsx`.
- Light values are specified as a commented block in `globals.css`.

## Toggle roadmap (not implemented)

1. Uncomment/verify light tokens (contrast ≥ 4.5:1 re-check).
2. Add `data-theme` switch on `<html>` + persisted preference
   (localStorage), default dark.
3. Map basemap swap positron ↔ dark-matter on toggle.
4. E2E: assert `documentElement.dataset.theme` flips + canvas present.

Estimated: ~1 session. No component rewrites — tokens only.
