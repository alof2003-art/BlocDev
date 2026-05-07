import { useEffect, useRef, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { EditorPanel } from './components/EditorPanel';
import { TitleBar } from './components/TitleBar';
import { QuickOpen } from './components/QuickOpen';
import { useNotesStore } from './store';

export default function App() {
  const {
    modules,
    activeModuleId,
    activeSectionId,
    activeSection,
    expandedModules,
    isLoading,
    saveStatus,
    sidebarVisible,
    loadNotes,
    forceSave,
    saveAs,
    toggleSidebar,
    toggleModule,
    addModule,
    renameModule,
    deleteModule,
    selectSection,
    addSection,
    updateSection,
    deleteSection,
    moveSection,
  } = useNotesStore();

  const [quickOpenVisible, setQuickOpenVisible] = useState(false);

  // Always-current ref — avoids stale closures in event handlers
  const stateRef = useRef({ activeModuleId, addModule, addSection, forceSave, saveAs, moveSection });
  stateRef.current = { activeModuleId, addModule, addSection, forceSave, saveAs, moveSection };

  // Load notes on mount
  useEffect(() => { loadNotes(); }, [loadNotes]);

  // ── Renderer-side keyboard shortcuts ──────────────────────────────────────
  // These handle keys that Monaco doesn't intercept.
  // Keys that Monaco swallows (Ctrl+S, Ctrl+P, etc.) are handled via
  // IPC from the main process (see shortcutsAPI listeners below).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA';

      // Ctrl + M → new module
      if (e.ctrlKey && !e.altKey && !e.shiftKey && e.code === 'KeyM' && !isInput) {
        e.preventDefault();
        stateRef.current.addModule();
        return;
      }
      // Ctrl + Shift + N → new section
      if (e.ctrlKey && !e.altKey && e.shiftKey && e.code === 'KeyN' && !isInput) {
        e.preventDefault();
        const { activeModuleId: modId, addSection: addSec } = stateRef.current;
        if (modId) addSec(modId);
        return;
      }
      // Ctrl + Shift + S → save as
      if (e.ctrlKey && !e.altKey && e.shiftKey && e.code === 'KeyS') {
        e.preventDefault();
        stateRef.current.saveAs();
        return;
      }
      // Ctrl + \ → toggle sidebar
      if (e.ctrlKey && !e.altKey && !e.shiftKey && e.code === 'Backslash') {
        e.preventDefault();
        toggleSidebar();
        return;
      }
      // Alt + ArrowUp → move section up
      if (e.altKey && !e.ctrlKey && e.code === 'ArrowUp') {
        e.preventDefault();
        stateRef.current.moveSection(-1);
        return;
      }
      // Alt + ArrowDown → move section down
      if (e.altKey && !e.ctrlKey && e.code === 'ArrowDown') {
        e.preventDefault();
        stateRef.current.moveSection(1);
        return;
      }
    };

    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [toggleSidebar]);

  // ── IPC shortcut listeners (main process → renderer) ──────────────────────
  // These fire for shortcuts that Monaco would otherwise swallow.
  useEffect(() => {
    if (!window.shortcutsAPI) return;

    const unsubForceSave     = window.shortcutsAPI.onForceSave(() => stateRef.current.forceSave());
    const unsubToggleSidebar = window.shortcutsAPI.onToggleSidebar(() => toggleSidebar());
    const unsubMoveUp        = window.shortcutsAPI.onMoveSectionUp(() => stateRef.current.moveSection(-1));
    const unsubMoveDown      = window.shortcutsAPI.onMoveSectionDown(() => stateRef.current.moveSection(1));
    const unsubQuickOpen     = window.shortcutsAPI.onQuickOpen(() => setQuickOpenVisible(true));

    return () => {
      unsubForceSave();
      unsubToggleSidebar();
      unsubMoveUp();
      unsubMoveDown();
      unsubQuickOpen();
    };
  }, [toggleSidebar]);

  // Ref forwarded to EditorPanel so TitleBar/App can trigger Monaco Find
  const triggerFindRef = useRef<(() => void) | null>(null);
  const handleFind = () => triggerFindRef.current?.();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0f1117]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-white/40 text-sm font-mono">Cargando notas…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#0f1117] text-white font-sans">
      {/* ── Title bar ── */}
      <TitleBar
        onAddModule={addModule}
        onAddSection={() => {
          const { activeModuleId: modId, addSection: addSec } = stateRef.current;
          if (modId) addSec(modId);
        }}
        onFind={handleFind}
        onForceSave={() => stateRef.current.forceSave()}
        onSaveAs={() => stateRef.current.saveAs()}
        onToggleSidebar={toggleSidebar}
        onQuickOpen={() => setQuickOpenVisible(true)}
      />

      {/* ── Main content ── */}
      <div className="flex flex-1 min-h-0 pt-9">
        {/* Sidebar — hidden when toggled */}
        {sidebarVisible && (
          <Sidebar
            modules={modules}
            activeModuleId={activeModuleId}
            activeSectionId={activeSectionId}
            expandedModules={expandedModules}
            onToggleModule={toggleModule}
            onSelectSection={selectSection}
            onAddModule={addModule}
            onAddSection={addSection}
            onRenameModule={renameModule}
            onDeleteModule={deleteModule}
            onDeleteSection={deleteSection}
          />
        )}

        {/* Editor */}
        <main className="flex-1 flex flex-col min-w-0">
          <EditorPanel
            section={activeSection}
            saveStatus={saveStatus}
            triggerFindRef={triggerFindRef}
            activeModuleId={activeModuleId}
            activeSectionId={activeSectionId}
            onUpdateSection={(patch) => {
              if (activeModuleId && activeSectionId) {
                updateSection(activeModuleId, activeSectionId, patch);
              }
            }}
          />
        </main>
      </div>

      {/* ── Quick Open overlay ── */}
      {quickOpenVisible && (
        <QuickOpen
          modules={modules}
          onSelect={(modId, secId) => selectSection(modId, secId)}
          onClose={() => setQuickOpenVisible(false)}
        />
      )}
    </div>
  );
}
