import { useRef, useCallback, type RefObject } from 'react';
import MonacoEditor, { type OnMount, loader } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import type { NoteSection } from '../types';
import { LANGUAGES } from '../types';

// ─── Configure Monaco to use local workers (required for Electron) ────────────
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

self.MonacoEnvironment = {
  getWorker(_: unknown, label: string) {
    if (label === 'json') return new jsonWorker();
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker();
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker();
    if (label === 'typescript' || label === 'javascript') return new tsWorker();
    return new editorWorker();
  },
};

loader.config({ monaco });

// ─── Types ────────────────────────────────────────────────────────────────────

interface EditorPanelProps {
  section: NoteSection | null;
  saveStatus: 'saved' | 'saving' | 'unsaved';
  /** Ref populated with a function that opens Monaco's Find widget */
  triggerFindRef: RefObject<(() => void) | null>;
  onUpdateSection: (patch: Partial<NoteSection>) => void;
}

const SAVE_STATUS_LABEL: Record<string, string> = {
  saved: '● Saved',
  saving: '◌ Saving…',
  unsaved: '○ Unsaved',
};

const SAVE_STATUS_COLOR: Record<string, string> = {
  saved: 'text-emerald-400',
  saving: 'text-yellow-400',
  unsaved: 'text-white/40',
};

// ─── Shortcut hint pill ───────────────────────────────────────────────────────

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-white/5 text-white/30 border border-white/10">
      {children}
    </kbd>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EditorPanel({ section, saveStatus, triggerFindRef, onUpdateSection }: EditorPanelProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleMount: OnMount = useCallback((editorInstance) => {
    editorRef.current = editorInstance;
    editorInstance.focus();

    // Populate the external ref so App can trigger Find programmatically
    if (triggerFindRef) {
      triggerFindRef.current = () => {
        editorInstance.focus();
        editorInstance.trigger('keyboard', 'actions.find', null);
      };
    }

    // Override Ctrl+F inside Monaco to use its native Find widget
    // (Monaco already does this by default — this just makes it explicit)
    editorInstance.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF,
      () => {
        editorInstance.trigger('keyboard', 'actions.find', null);
      }
    );
  }, [triggerFindRef]);

  if (!section) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0f1117] text-white/20 gap-6">
        <div className="text-5xl">⌘</div>
        <p className="text-sm font-mono">Select a section to start editing</p>
        {/* Shortcut hints */}
        <div className="flex flex-col items-center gap-2 text-xs font-mono text-white/20">
          <div className="flex items-center gap-2">
            <Kbd>Ctrl</Kbd><span>+</span><Kbd>M</Kbd>
            <span className="ml-1">New module + section</span>
          </div>
          <div className="flex items-center gap-2">
            <Kbd>Ctrl</Kbd><span>+</span><Kbd>Shift</Kbd><span>+</span><Kbd>N</Kbd>
            <span className="ml-1">New section in active module</span>
          </div>
          <div className="flex items-center gap-2">
            <Kbd>Ctrl</Kbd><span>+</span><Kbd>F</Kbd>
            <span className="ml-1">Find in editor</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0f1117]">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-white/5 shrink-0">
        {/* Section title */}
        <input
          key={section.id}
          defaultValue={section.title}
          onBlur={(e) => {
            const trimmed = e.target.value.trim();
            if (trimmed && trimmed !== section.title) {
              onUpdateSection({ title: trimmed });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          className="bg-transparent text-white font-semibold text-sm outline-none border-b border-transparent focus:border-indigo-400 transition-colors min-w-0 flex-1"
          placeholder="Section title…"
        />

        {/* Language selector */}
        <select
          value={section.language}
          onChange={(e) => onUpdateSection({ language: e.target.value })}
          className="bg-[#161b22] text-white/60 text-xs font-mono border border-white/10 rounded px-2 py-1 outline-none hover:border-indigo-400 focus:border-indigo-400 transition-colors cursor-pointer"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>

        {/* Find hint */}
        <span className="hidden sm:flex items-center gap-1 text-white/20 text-[10px] font-mono shrink-0">
          <Kbd>Ctrl</Kbd><Kbd>F</Kbd> find
        </span>

        {/* Save status */}
        <span className={`text-xs font-mono shrink-0 ${SAVE_STATUS_COLOR[saveStatus]}`}>
          {SAVE_STATUS_LABEL[saveStatus]}
        </span>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 min-h-0">
        <MonacoEditor
          key={section.id}
          height="100%"
          language={section.language}
          value={section.content}
          theme="vs-dark"
          onMount={handleMount}
          onChange={(value) => {
            if (value !== undefined) {
              onUpdateSection({ content: value });
            }
          }}
          options={{
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
            fontSize: 14,
            lineHeight: 22,
            fontLigatures: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            padding: { top: 16, bottom: 16 },
            renderLineHighlight: 'gutter',
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            bracketPairColorization: { enabled: true },
            guides: {
              bracketPairs: true,
              indentation: true,
            },
            suggest: {
              showKeywords: true,
            },
            tabSize: 2,
            insertSpaces: true,
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  );
}
