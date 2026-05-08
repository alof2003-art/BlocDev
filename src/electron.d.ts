import type { Module } from './types';

interface NotesAPI {
  load: () => Promise<Module[]>;
  save: (modules: Module[]) => Promise<{ success: boolean }>;
  saveSection: (moduleId: string, sectionId: string, content: string) => Promise<{ success: boolean }>;
  saveAs: (
    moduleId: string,
    sectionId: string,
    moduleName: string,
    sectionTitle: string,
    language: string,
  ) => Promise<{ success: boolean; canceled: boolean; filePath?: string }>;
  importFile: () => Promise<{
    success: boolean;
    canceled: boolean;
    isBlocDev?: boolean;
    module?: string;
    section?: string;
    language?: string;
    content?: string;
  }>;
}

interface WindowAPI {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onMaximizeChange: (cb: (isMax: boolean) => void) => () => void;
}

interface MenuAPI {
  openDataFolder: () => void;
  openSectionFile: (moduleId: string, sectionId: string) => void;
  about: () => void;
  devtools: () => void;
  reload: () => void;
}

interface ShortcutsAPI {
  onForceSave:       (cb: () => void) => () => void;
  onToggleSidebar:   (cb: () => void) => () => void;
  onMoveSectionUp:   (cb: () => void) => () => void;
  onMoveSectionDown: (cb: () => void) => () => void;
  onQuickOpen:       (cb: () => void) => () => void;
}

declare global {
  interface Window {
    notesAPI?:     NotesAPI;
    windowAPI?:    WindowAPI;
    menuAPI?:      MenuAPI;
    shortcutsAPI?: ShortcutsAPI;
  }
}

export {};
