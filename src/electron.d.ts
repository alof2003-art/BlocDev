import type { Module } from './types';

interface NotesAPI {
  load: () => Promise<Module[]>;
  save: (modules: Module[]) => Promise<{ success: boolean }>;
  saveSection: (moduleId: string, sectionId: string, content: string) => Promise<{ success: boolean }>;
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
  about: () => void;
  devtools: () => void;
  reload: () => void;
}

declare global {
  interface Window {
    notesAPI?: NotesAPI;
    windowAPI?: WindowAPI;
    menuAPI?: MenuAPI;
  }
}

export {};
