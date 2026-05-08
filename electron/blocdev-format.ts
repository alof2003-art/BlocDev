/**
 * BlocDev Note Format  (.txt)
 * ─────────────────────────────────────────────────────────────────────────────
 * Every exported file is a plain UTF-8 .txt readable by any editor.
 * The first N lines are a structured header; the rest is raw content.
 *
 * Example file on disk:
 * ┌─────────────────────────────────────────────────────┐
 * │ ╔══════════════════════════════════════════════════╗ │
 * │ ║  BlocDev Note                          v1        ║ │
 * │ ╠══════════════════════════════════════════════════╣ │
 * │ ║  module:    AppWeb                               ║ │
 * │ ║  section:   Probando                             ║ │
 * │ ║  language:  markdown                             ║ │
 * │ ║  saved:     2026-05-07T14:32:00Z                 ║ │
 * │ ╚══════════════════════════════════════════════════╝ │
 * │                                                     │
 * │ [content starts here — no wrapper, raw code/text]   │
 * └─────────────────────────────────────────────────────┘
 */

export interface BlocDevMeta {
  module:   string;
  section:  string;
  language: string;
  saved:    string;
}

// Width of the box (inner content area, excluding border chars)
const BOX_WIDTH = 52;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad(text: string): string {
  const spaces = BOX_WIDTH - text.length;
  return `║  ${text}${' '.repeat(Math.max(0, spaces - 2))}║`;
}

function hLine(left: string, right: string, fill = '═'): string {
  return `${left}${fill.repeat(BOX_WIDTH)}${right}`;
}

// ─── Serialize ────────────────────────────────────────────────────────────────

export function serialize(meta: BlocDevMeta, content: string): string {
  const header = [
    hLine('╔', '╗'),
    pad('BlocDev Note                          v1'),
    hLine('╠', '╣'),
    pad(`module:    ${meta.module}`),
    pad(`section:   ${meta.section}`),
    pad(`language:  ${meta.language}`),
    pad(`saved:     ${meta.saved}`),
    hLine('╚', '╝'),
    '',   // blank line separating header from content
  ].join('\n');

  return header + content;
}

// ─── Parse ────────────────────────────────────────────────────────────────────

const FIELD_RE = /^║\s{2}(\w+):\s{1,}(.+?)\s*║\s*$/;
const CLOSE_RE = /^╚[═]+╝\s*$/;

export interface ParseResult {
  ok:      boolean;
  meta?:   BlocDevMeta;
  content: string;
}

export function parse(raw: string): ParseResult {
  // Normalize line endings
  const lines = raw.replace(/\r\n/g, '\n').split('\n');

  // Must start with the top border
  if (!lines[0]?.startsWith('╔')) {
    return { ok: false, content: raw };
  }

  const fields: Record<string, string> = {};
  let closeIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (CLOSE_RE.test(lines[i])) {
      closeIdx = i;
      break;
    }
    const m = FIELD_RE.exec(lines[i]);
    if (m) fields[m[1]] = m[2].trim();
  }

  if (closeIdx === -1) {
    return { ok: false, content: raw };
  }

  // Content starts after the closing border + optional blank line
  const contentStart =
    closeIdx + 1 < lines.length && lines[closeIdx + 1] === ''
      ? closeIdx + 2
      : closeIdx + 1;

  const content = lines.slice(contentStart).join('\n');

  const meta: BlocDevMeta = {
    module:   fields['module']   ?? 'Imported',
    section:  fields['section']  ?? 'Imported',
    language: fields['language'] ?? 'plaintext',
    saved:    fields['saved']    ?? new Date().toISOString(),
  };

  return { ok: true, meta, content };
}
