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
  const [modules, setModules] = useState<Module[]>([]);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  // Always-current ref — avoids stale closures in all callbacks
  const modulesRef = useRef<Module[]>([]);

  const applyModules = useCallback((updated: Module[]) => {
    modulesRef.current = updated;
    setModules(updated);
  }, []);

  // ── Persistence ─────────────────────────────────────────────────────────────

  const loadNotes = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = window.notesAPI ? await window.notesAPI.load() : [];
      applyModules(data);
      if (data.length > 0) {
        setExpandedModules(new Set([data[0].id]));
        setActiveModuleId(data[0].id);
        if (data[0].sections.length > 0) {
          setActiveSectionId(data[0].sections[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load notes:', err);
      applyModules([]);
    } finally {
      setIsLoading(false);
    }
  }, [applyModules]);

  /**
   * Full save — rewrites index.json + all section files.
   * Used for structural changes: create/rename/delete module or section.
   */
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

  /**
   * Partial save — only rewrites the content of one section file.
   * Debounced 600 ms so it doesn't fire on every keystroke.
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSaveSection = useCallback(
    debounce(
      async (moduleId: string, sectionId: string, content: string) => {
        if (!window.notesAPI?.saveSection) return;
        try {
          await window.notesAPI.saveSection(moduleId, sectionId, content);
          setSaveStatus('saved');
        } catch (err) {
          console.error('Section save failed:', err);
          setSaveStatus('unsaved');
        }
      },
      600,
    ),
    [],
  );

  // ── Derived state ────────────────────────────────────────────────────────────

  const activeSection: NoteSection | null = (() => {
    if (!activeModuleId || !activeSectionId) return null;
    const mod = modules.find((m) => m.id === activeModuleId);
    return mod?.sections.find((s) => s.id === activeSectionId) ?? null;
  })();

  // ── Module actions ───────────────────────────────────────────────────────────

  const toggleModule = useCallback((moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      next.has(moduleId) ? next.delete(moduleId) : next.add(moduleId);
      return next;
    });
  }, []);

  const addModule = useCallback(() => {
    const newSection: NoteSection = {
      id: uuidv4(),
      title: 'New Section',
      content: '',
      language: 'javascript',
    };
    const newModule: Module = {
      id: uuidv4(),
      moduleName: 'New Module',
      sections: [newSection],
    };
    const updated = [...modulesRef.current, newModule];
    applyModules(updated);
    fullSave(updated);                                   // structural → full save
    setExpandedModules((prev) => new Set([...prev, newModule.id]));
    setActiveModuleId(newModule.id);
    setActiveSectionId(newSection.id);
  }, [applyModules, fullSave]);

  const renameModule = useCallback(
    (moduleId: string, name: string) => {
      const updated = modulesRef.current.map((m) =>
        m.id === moduleId ? { ...m, moduleName: name } : m,
      );
      applyModules(updated);
      fullSave(updated);                                 // folder rename → full save
    },
    [applyModules, fullSave],
  );

  const deleteModule = useCallback(
    (moduleId: string) => {
      const updated = modulesRef.current.filter((m) => m.id !== moduleId);
      applyModules(updated);
      fullSave(updated);                                 // structural → full save
      setActiveModuleId((prev) => (prev === moduleId ? null : prev));
      setActiveSectionId((prev) => {
        const deletedMod = modulesRef.current.find((m) => m.id === moduleId);
        const sectionIds = new Set(deletedMod?.sections.map((s) => s.id) ?? []);
        return prev && sectionIds.has(prev) ? null : prev;
      });
    },
    [applyModules, fullSave],
  );

  // ── Section actions ──────────────────────────────────────────────────────────

  const selectSection = useCallback((moduleId: string, sectionId: string) => {
    setActiveModuleId(moduleId);
    setActiveSectionId(sectionId);
  }, []);

  const addSection = useCallback(
    (moduleId: string) => {
      const newSection: NoteSection = {
        id: uuidv4(),
        title: 'New Section',
        content: '',
        language: 'javascript',
      };
      const updated = modulesRef.current.map((m) =>
        m.id === moduleId
          ? { ...m, sections: [...m.sections, newSection] }
          : m,
      );
      applyModules(updated);
      fullSave(updated);                                 // structural → full save
      setActiveModuleId(moduleId);
      setActiveSectionId(newSection.id);
      setExpandedModules((prev) => new Set([...prev, moduleId]));
    },
    [applyModules, fullSave],
  );

  const updateSection = useCallback(
    (moduleId: string, sectionId: string, patch: Partial<NoteSection>) => {
      const updated = modulesRef.current.map((m) =>
        m.id === moduleId
          ? {
              ...m,
              sections: m.sections.map((s) =>
                s.id === sectionId ? { ...s, ...patch } : s,
              ),
            }
          : m,
      );
      applyModules(updated);

      const isContentOnly =
        Object.keys(patch).length === 1 && 'content' in patch;

      if (isContentOnly) {
        // Only content changed → fast debounced partial save
        setSaveStatus('unsaved');
        debouncedSaveSection(moduleId, sectionId, patch.content as string);
      } else {
        // Title or language changed → full save (index.json must be updated)
        fullSave(updated);
      }
    },
    [applyModules, fullSave, debouncedSaveSection],
  );

  const deleteSection = useCallback(
    (moduleId: string, sectionId: string) => {
      const updated = modulesRef.current.map((m) =>
        m.id === moduleId
          ? { ...m, sections: m.sections.filter((s) => s.id !== sectionId) }
          : m,
      );
      applyModules(updated);
      fullSave(updated);                                 // structural → full save
      setActiveSectionId((prev) => (prev === sectionId ? null : prev));
    },
    [applyModules, fullSave],
  );

  return {
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
  };
}
