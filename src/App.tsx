import { useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { EditorPanel } from './components/EditorPanel';
import { TitleBar } from './components/TitleBar';
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
    loadNotes,
    toggleModule,
    addModule,
    renameModule,
    deleteModule,
    selectSection,
    addSection,
    updateSection,
    deleteSection,
  } = useNotesStore();

  // Always-current ref — avoids stale closures in event handlers
  const stateRef = useRef({ activeModuleId, addModule, addSection });
  stateRef.current = { activeModuleId, addModule, addSection };

  // Load notes on mount
  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // ── Global keyboard shortcuts ──────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isTextInput = tag === 'INPUT' || tag === 'TEXTAREA';

      // Ctrl + M  →  new module + default section
      if (e.ctrlKey && !e.altKey && !e.shiftKey && e.code === 'KeyM' && !isTextInput) {
        e.preventDefault();
        stateRef.current.addModule();
        return;
      }

      // Ctrl + Shift + N  →  new section in active module
      if (e.ctrlKey && !e.altKey && e.shiftKey && e.code === 'KeyN' && !isTextInput) {
        e.preventDefault();
        const { activeModuleId: modId, addSection: addSec } = stateRef.current;
        if (modId) addSec(modId);
        return;
      }
    };

    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, []);

  // Ref forwarded to EditorPanel so TitleBar/App can trigger Monaco Find
  const triggerFindRef = useRef<(() => void) | null>(null);
  const handleFind = () => triggerFindRef.current?.();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0f1117]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-white/40 text-sm font-mono">Loading notes…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#0f1117] text-white font-sans">
      {/* ── Custom title bar ── */}
      <TitleBar
        onAddModule={addModule}
        onAddSection={() => {
          const { activeModuleId: modId, addSection: addSec } = stateRef.current;
          if (modId) addSec(modId);
        }}
        onFind={handleFind}
      />

      {/* ── Main content (below title bar) ── */}
      <div className="flex flex-1 min-h-0 pt-9">
        {/* Sidebar */}
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

        {/* Editor */}
        <main className="flex-1 flex flex-col min-w-0">
          <EditorPanel
            section={activeSection}
            saveStatus={saveStatus}
            triggerFindRef={triggerFindRef}
            onUpdateSection={(patch) => {
              if (activeModuleId && activeSectionId) {
                updateSection(activeModuleId, activeSectionId, patch);
              }
            }}
          />
        </main>
      </div>
    </div>
  );
}
