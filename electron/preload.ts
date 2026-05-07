import { contextBridge, ipcRenderer } from 'electron';

export interface NoteSection {
  id: string;
  title: string;
  content: string;
  language: string;
}

export interface Module {
  id: string;
  moduleName: string;
  sections: NoteSection[];
}

// ─── Notes API ────────────────────────────────────────────────────────────────

const notesAPI = {
  load: (): Promise<Module[]> =>
    ipcRenderer.invoke('notes:load'),

  save: (modules: Module[]): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('notes:save', modules),

  saveSection: (
    moduleId: string,
    sectionId: string,
    content: string,
  ): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('notes:saveSection', moduleId, sectionId, content),
};

// ─── Window API ───────────────────────────────────────────────────────────────

const windowAPI = {
  minimize:    () => ipcRenderer.send('window:minimize'),
  maximize:    () => ipcRenderer.send('window:maximize'),
  close:       () => ipcRenderer.send('window:close'),
  isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),
  onMaximizeChange: (cb: (isMax: boolean) => void) => {
    const handler = (_: Electron.IpcRendererEvent, val: boolean) => cb(val);
    ipcRenderer.on('window:maximizeChange', handler);
    // Return cleanup function
    return () => ipcRenderer.removeListener('window:maximizeChange', handler);
  },
};

// ─── Menu API ─────────────────────────────────────────────────────────────────

const menuAPI = {
  openDataFolder: () => ipcRenderer.send('menu:openDataFolder'),
  about:          () => ipcRenderer.send('menu:about'),
  devtools:       () => ipcRenderer.send('menu:devtools'),
  reload:         () => ipcRenderer.send('menu:reload'),
};

// ─── Expose ───────────────────────────────────────────────────────────────────

contextBridge.exposeInMainWorld('notesAPI',  notesAPI);
contextBridge.exposeInMainWorld('windowAPI', windowAPI);
contextBridge.exposeInMainWorld('menuAPI',   menuAPI);

declare global {
  interface Window {
    notesAPI:  typeof notesAPI;
    windowAPI: typeof windowAPI;
    menuAPI:   typeof menuAPI;
  }
}
