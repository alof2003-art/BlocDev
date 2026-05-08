import { useState, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Module, NoteSection } from './types';

// ─── Debounce helper ──────────────────────────────────────────────────────────

function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  ms: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotesStore() {
  const [modules, setModules]               = useState<Module[]>([]);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading]           = useState(true);
  const [saveStatus, setSaveStatus]         = useState<'saved' | 'saving' | 'unsaved'>('saved');
  const [sidebarVisible, setSidebarVisible] = useState(true);

  // Always-current ref — avoids stale closures in all callbacks
  const modulesRef       = useRef<Module[]>([]);
  const activeModuleRef  = useRef<string | null>(null);
  const activeSectionRef = useRef<string | null>(null);

  const applyModules = useCallback((updated: Module[]) => {
    modulesRef.current = updated;
    setModules(updated);
  }, []);

  // Keep refs in sync with state
  const setActiveModuleIdSynced = useCallback((id: string | null) => {
    activeModuleRef.current = id;
    setActiveModuleId(id);
  }, []);

  const setActiveSectionIdSynced = useCallback((id: string | null) => {
    activeSectionRef.current = id;
    setActiveSectionId(id);
  }, []);

  // ── Persistence ─────────────────────────────────────────────────────────────

  const loadNotes = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = window.notesAPI ? await window.notesAPI.load() : [];
      applyModules(data);
      if (data.length > 0) {
        setExpandedModules(new Set([data[0].id]));
        setActiveModuleIdSynced(data[0].id);
        if (data[0].sections.length > 0) {
          setActiveSectionIdSynced(data[0].sections[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load notes:', err);
      applyModules([]);
    } finally {
      setIsLoading(false);
    }
  }, [applyModules, setActiveModuleIdSynced, setActiveSectionIdSynced]);

  /** Full save — rewrites index.json + all section files */
  const fullSave = useCallback(async (updated: Module[]) => {
    if (!window.notesAPI) return;
    setSaveStatus('saving');
    try {
      await window.notesAPI.save(updated);
      setSaveStatus('saved');
    } catch (err) {
      console.error('Full save failed:', err);
      setSaveStatus('unsaved');
    }
  }, []);

  /** Immediate full save of current state — used by Ctrl+S */
  const forceSave = useCallback(async () => {
    if (!window.notesAPI) return;
    setSaveStatus('saving');
    try {
      await window.notesAPI.save(modulesRef.current);
      setSaveStatus('saved');
    } catch (err) {
      console.error('Force save failed:', err);
      setSaveStatus('unsaved');
    }
  }, []);

  /** Save As — opens native dialog, exports section to chosen path */
  const saveAs = useCallback(async () => {
    const modId = activeModuleRef.current;
    const secId = activeSectionRef.current;
    if (!modId || !secId || !window.notesAPI?.saveAs) return;

    // Flush any pending debounced content first
    await forceSave();

    const mod = modulesRef.current.find((m) => m.id === modId);
    const sec = mod?.sections.find((s) => s.id === secId);
    if (!mod || !sec) return;

    const result = await window.notesAPI.saveAs(
      modId, secId, mod.moduleName, sec.title, sec.language,
    );
    if (result.success) {
      setSaveStatus('saved');
    }
  }, [forceSave]);

  /** Partial save — debounced 600ms, only rewrites one section file */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSaveSection = useCallback(
    debounce(async (moduleId: string, sectionId: string, content: string) => {
      if (!window.notesAPI?.saveSection) return;
      try {
        await window.notesAPI.saveSection(moduleId, sectionId, content);
        setSaveStatus('saved');
      } catch (err) {
        console.error('Section save failed:', err);
        setSaveStatus('unsaved');
      }
    }, 600),
    [],
  );

  // ── Derived state ────────────────────────────────────────────────────────────

  const activeSection: NoteSection | null = (() => {
    if (!activeModuleId || !activeSectionId) return null;
    const mod = modules.find((m) => m.id === activeModuleId);
    return mod?.sections.find((s) => s.id === activeSectionId) ?? null;
  })();

  // ── Sidebar ──────────────────────────────────────────────────────────────────

  const toggleSidebar = useCallback(() => setSidebarVisible((v) => !v), []);

  // ── Module actions ───────────────────────────────────────────────────────────

  const toggleModule = useCallback((moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      next.has(moduleId) ? next.delete(moduleId) : next.add(moduleId);
      return next;
    });
  }, []);

  const addModule = useCallback(() => {
    const newSection: NoteSection = { id: uuidv4(), title: 'New Section', content: '', language: 'plaintext' };
    const newModule: Module       = { id: uuidv4(), moduleName: 'New Module', sections: [newSection] };
    const updated = [...modulesRef.current, newModule];
    applyModules(updated);
    fullSave(updated);
    setExpandedModules((prev) => new Set([...prev, newModule.id]));
    setActiveModuleIdSynced(newModule.id);
    setActiveSectionIdSynced(newSection.id);
  }, [applyModules, fullSave, setActiveModuleIdSynced, setActiveSectionIdSynced]);

  const renameModule = useCallback((moduleId: string, name: string) => {
    const updated = modulesRef.current.map((m) =>
      m.id === moduleId ? { ...m, moduleName: name } : m,
    );
    applyModules(updated);
    fullSave(updated);
  }, [applyModules, fullSave]);

  const deleteModule = useCallback((moduleId: string) => {
    const updated = modulesRef.current.filter((m) => m.id !== moduleId);
    applyModules(updated);
    fullSave(updated);
    setActiveModuleIdSynced(activeModuleRef.current === moduleId ? null : activeModuleRef.current);
    setActiveSectionIdSynced(
      activeSectionRef.current && new Set(
        modulesRef.current.find((m) => m.id === moduleId)?.sections.map((s) => s.id) ?? []
      ).has(activeSectionRef.current)
        ? null
        : activeSectionRef.current,
    );
  }, [applyModules, fullSave, setActiveModuleIdSynced, setActiveSectionIdSynced]);

  // ── Section actions ──────────────────────────────────────────────────────────

  const selectSection = useCallback((moduleId: string, sectionId: string) => {
    setActiveModuleIdSynced(moduleId);
    setActiveSectionIdSynced(sectionId);
  }, [setActiveModuleIdSynced, setActiveSectionIdSynced]);

  const addSection = useCallback((moduleId: string) => {
    const newSection: NoteSection = { id: uuidv4(), title: 'New Section', content: '', language: 'plaintext' };
    const updated = modulesRef.current.map((m) =>
      m.id === moduleId ? { ...m, sections: [...m.sections, newSection] } : m,
    );
    applyModules(updated);
    fullSave(updated);
    setActiveModuleIdSynced(moduleId);
    setActiveSectionIdSynced(newSection.id);
    setExpandedModules((prev) => new Set([...prev, moduleId]));
  }, [applyModules, fullSave, setActiveModuleIdSynced, setActiveSectionIdSynced]);

  const renameSection = useCallback(
    (moduleId: string, sectionId: string, title: string) => {
      const updated = modulesRef.current.map((m) =>
        m.id === moduleId
          ? { ...m, sections: m.sections.map((s) => s.id === sectionId ? { ...s, title } : s) }
          : m,
      );
      applyModules(updated);
      fullSave(updated); // title change → full save (index.json + file rename)
    },
    [applyModules, fullSave],
  );

  const updateSection = useCallback(
    (moduleId: string, sectionId: string, patch: Partial<NoteSection>) => {
      const updated = modulesRef.current.map((m) =>
        m.id === moduleId
          ? { ...m, sections: m.sections.map((s) => s.id === sectionId ? { ...s, ...patch } : s) }
          : m,
      );
      applyModules(updated);

      if (Object.keys(patch).length === 1 && 'content' in patch) {
        setSaveStatus('unsaved');
        debouncedSaveSection(moduleId, sectionId, patch.content as string);
      } else {
        fullSave(updated);
      }
    },
    [applyModules, fullSave, debouncedSaveSection],
  );

  const deleteSection = useCallback((moduleId: string, sectionId: string) => {
    const updated = modulesRef.current.map((m) =>
      m.id === moduleId
        ? { ...m, sections: m.sections.filter((s) => s.id !== sectionId) }
        : m,
    );
    applyModules(updated);
    fullSave(updated);
    setActiveSectionIdSynced(activeSectionRef.current === sectionId ? null : activeSectionRef.current);
  }, [applyModules, fullSave, setActiveSectionIdSynced]);

  /**
   * Move the active section up or down within its module.
   * direction: -1 = up, +1 = down
   */
  const moveSection = useCallback((direction: -1 | 1) => {
    const modId = activeModuleRef.current;
    const secId = activeSectionRef.current;
    if (!modId || !secId) return;

    const updated = modulesRef.current.map((m) => {
      if (m.id !== modId) return m;
      const idx = m.sections.findIndex((s) => s.id === secId);
      if (idx === -1) return m;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= m.sections.length) return m;
      const sections = [...m.sections];
      [sections[idx], sections[newIdx]] = [sections[newIdx], sections[idx]];
      return { ...m, sections };
    });

    applyModules(updated);
    fullSave(updated);
  }, [applyModules, fullSave]);

  /**
   * Import a BlocDev .txt file. If it has a valid header, creates a new section
   * inside an existing module (matched by name) or a new one.
   */
  const importFile = useCallback(async () => {
    if (!window.notesAPI?.importFile) return;

    const result = await window.notesAPI.importFile();
    if (!result.success || result.canceled) return;

    const moduleName   = result.module   ?? 'Importado';
    const sectionTitle = result.section  ?? 'Importado';
    const language     = result.language ?? 'plaintext';
    const content      = result.content  ?? '';

    // Find existing module by name (case-insensitive) or create new one
    const existing = modulesRef.current.find(
      (m) => m.moduleName.toLowerCase() === moduleName.toLowerCase(),
    );

    const newSection: NoteSection = {
      id: uuidv4(), title: sectionTitle, content, language,
    };

    let updated: Module[];
    let targetModuleId: string;

    if (existing) {
      targetModuleId = existing.id;
      updated = modulesRef.current.map((m) =>
        m.id === existing.id
          ? { ...m, sections: [...m.sections, newSection] }
          : m,
      );
    } else {
      const newModule: Module = { id: uuidv4(), moduleName, sections: [newSection] };
      targetModuleId = newModule.id;
      updated = [...modulesRef.current, newModule];
      setExpandedModules((prev) => new Set([...prev, newModule.id]));
    }

    applyModules(updated);
    fullSave(updated);
    setExpandedModules((prev) => new Set([...prev, targetModuleId]));
    setActiveModuleIdSynced(targetModuleId);
    setActiveSectionIdSynced(newSection.id);
  }, [applyModules, fullSave, setActiveModuleIdSynced, setActiveSectionIdSynced]);

  // ── Return ───────────────────────────────────────────────────────────────────

  return {
    // State
    modules,
    activeModuleId,
    activeSectionId,
    activeSection,
    expandedModules,
    isLoading,
    saveStatus,
    sidebarVisible,
    // Actions
    loadNotes,
    forceSave,
    saveAs,
    importFile,
    toggleSidebar,
    toggleModule,
    addModule,
    renameModule,
    deleteModule,
    selectSection,
    addSection,
    renameSection,
    updateSection,
    deleteSection,
    moveSection,
  };
}
