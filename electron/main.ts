import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import path from 'path';
import fs from 'fs';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NoteSection {
  id: string;
  title: string;
  content: string;
  language: string;
}

interface Module {
  id: string;
  moduleName: string;
  sections: NoteSection[];
}

// ─── Index types (what lives in index.json — NO content) ──────────────────────

interface SectionMeta {
  id: string;
  title: string;
  language: string;
  /** filename on disk, e.g. "Closures.js" */
  file: string;
}

interface ModuleMeta {
  id: string;
  moduleName: string;
  /** sanitized folder name on disk, e.g. "JavaScript" */
  folder: string;
  sections: SectionMeta[];
}

// ─── Paths ────────────────────────────────────────────────────────────────────

const ROOT_DIR   = path.join(app.getPath('userData'), 'dev-notes');
const INDEX_FILE = path.join(ROOT_DIR, 'index.json');

// ─── Main window reference (declared early so IPC handlers can use it) ────────

let mainWindow: BrowserWindow | null = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Turn any string into a safe filesystem name.
 * Strips characters that are illegal on Windows/macOS/Linux.
 */
function safeName(name: string): string {
  return name
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') // illegal chars → underscore
    .replace(/\s+/g, ' ')                     // collapse whitespace
    .slice(0, 100)                             // max length
    || '_unnamed';
}

/**
 * Map a language id to a file extension.
 */
const LANG_EXT: Record<string, string> = {
  javascript: 'js',
  typescript: 'ts',
  python:     'py',
  rust:       'rs',
  go:         'go',
  java:       'java',
  cpp:        'cpp',
  c:          'c',
  csharp:     'cs',
  html:       'html',
  css:        'css',
  json:       'json',
  markdown:   'md',
  sql:        'sql',
  shell:      'sh',
  plaintext:  'txt',
};

function extFor(language: string): string {
  return LANG_EXT[language] ?? 'txt';
}

/**
 * Build a unique filename for a section inside a module folder.
 * If "Closures.js" already exists (different section), appends _2, _3, etc.
 */
function uniqueFilename(
  moduleFolder: string,
  title: string,
  language: string,
  excludeFile?: string,
): string {
  const base = safeName(title);
  const ext  = extFor(language);
  let candidate = `${base}.${ext}`;
  let counter = 2;

  while (
    fs.existsSync(path.join(moduleFolder, candidate)) &&
    candidate !== excludeFile
  ) {
    candidate = `${base}_${counter}.${ext}`;
    counter++;
  }
  return candidate;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

function readData(): Module[] {
  try {
    if (!fs.existsSync(INDEX_FILE)) return [];

    const index: ModuleMeta[] = JSON.parse(
      fs.readFileSync(INDEX_FILE, 'utf-8'),
    );

    if (!Array.isArray(index)) return [];

    return index.map((mod) => {
      const moduleFolder = path.join(ROOT_DIR, mod.folder);

      const sections: NoteSection[] = (mod.sections ?? []).map((sec) => {
        const filePath = path.join(moduleFolder, sec.file);
        let content = '';
        try {
          if (fs.existsSync(filePath)) {
            content = fs.readFileSync(filePath, 'utf-8');
          }
        } catch {
          // file unreadable — return empty content, don't crash
        }
        return {
          id:       sec.id,
          title:    sec.title,
          language: sec.language,
          content,
        };
      });

      return {
        id:         mod.id,
        moduleName: mod.moduleName,
        sections,
      };
    });
  } catch {
    return [];
  }
}

// ─── Write ────────────────────────────────────────────────────────────────────

function writeData(modules: Module[]): void {
  // Ensure root directory exists
  fs.mkdirSync(ROOT_DIR, { recursive: true });

  // Build the new index and write each section file
  const newIndex: ModuleMeta[] = modules.map((mod) => {
    const folderName   = safeName(mod.moduleName);
    const moduleFolder = path.join(ROOT_DIR, folderName);
    fs.mkdirSync(moduleFolder, { recursive: true });

    const sectionsMeta: SectionMeta[] = mod.sections.map((sec) => {
      const filename = uniqueFilename(moduleFolder, sec.title, sec.language);
      const filePath = path.join(moduleFolder, filename);
      fs.writeFileSync(filePath, sec.content, 'utf-8');
      return {
        id:       sec.id,
        title:    sec.title,
        language: sec.language,
        file:     filename,
      };
    });

    return {
      id:         mod.id,
      moduleName: mod.moduleName,
      folder:     folderName,
      sections:   sectionsMeta,
    };
  });

  fs.writeFileSync(INDEX_FILE, JSON.stringify(newIndex, null, 2), 'utf-8');

  // ── Garbage-collect orphaned folders / files ──────────────────────────────
  // Any folder in ROOT_DIR that is no longer referenced by the index gets removed.
  const activeFolders = new Set(newIndex.map((m) => m.folder));
  const activeFiles   = new Map<string, Set<string>>();
  for (const mod of newIndex) {
    activeFiles.set(mod.folder, new Set(mod.sections.map((s) => s.file)));
  }

  try {
    for (const entry of fs.readdirSync(ROOT_DIR)) {
      if (entry === 'index.json') continue;

      const entryPath = path.join(ROOT_DIR, entry);
      const stat = fs.statSync(entryPath);

      if (stat.isDirectory()) {
        if (!activeFolders.has(entry)) {
          // Deleted module — remove its folder
          fs.rmSync(entryPath, { recursive: true, force: true });
        } else {
          // Active module — remove orphaned section files
          const keepFiles = activeFiles.get(entry) ?? new Set();
          for (const file of fs.readdirSync(entryPath)) {
            if (!keepFiles.has(file)) {
              fs.rmSync(path.join(entryPath, file), { force: true });
            }
          }
        }
      }
    }
  } catch {
    // GC errors are non-fatal
  }
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('notes:load', () => {
  return readData();
});

ipcMain.handle('notes:save', (_event, modules: Module[]) => {
  writeData(modules);
  return { success: true };
});

/**
 * Partial save: only rewrite the content of one section file.
 * Reads the current index to find the file path, then overwrites just that file.
 * Much faster than a full save on every keystroke.
 */
ipcMain.handle(
  'notes:saveSection',
  (_event, moduleId: string, sectionId: string, content: string) => {
    try {
      if (!fs.existsSync(INDEX_FILE)) return { success: false };

      const index: ModuleMeta[] = JSON.parse(
        fs.readFileSync(INDEX_FILE, 'utf-8'),
      );

      const mod = index.find((m) => m.id === moduleId);
      if (!mod) return { success: false };

      const sec = mod.sections.find((s) => s.id === sectionId);
      if (!sec) return { success: false };

      const filePath = path.join(ROOT_DIR, mod.folder, sec.file);
      fs.writeFileSync(filePath, content, 'utf-8');
      return { success: true };
    } catch {
      return { success: false };
    }
  },
);

// ─── Window control IPC ───────────────────────────────────────────────────────
// Use mainWindow directly — getFocusedWindow() can return null when the
// renderer has focus (e.g. after clicking a button inside the app).

ipcMain.on('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.on('window:maximize', () => {
  if (!mainWindow) return;
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});

ipcMain.on('window:close', () => {
  mainWindow?.close();
});

ipcMain.handle('window:isMaximized', () => {
  return mainWindow?.isMaximized() ?? false;
});

// ─── Menu action IPC ──────────────────────────────────────────────────────────

ipcMain.on('menu:openDataFolder', () => {
  shell.openPath(ROOT_DIR);
});

ipcMain.on('menu:about', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'DevNotes',
    message: 'DevNotes',
    detail: 'A specialized note editor for programmers.\n\nVersion 1.0.0\nBuilt with Electron + React + Monaco Editor',
    buttons: ['OK'],
  });
});

ipcMain.on('menu:devtools', () => {
  mainWindow?.webContents.toggleDevTools();
});

ipcMain.on('menu:reload', () => {
  mainWindow?.webContents.reload();
});

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0f1117',
    frame: false,                  // frameless — we draw our own titlebar
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Notify renderer when maximize state changes
  mainWindow.on('maximize',   () => mainWindow?.webContents.send('window:maximizeChange', true));
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window:maximizeChange', false));

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    // DevTools available via Herramientas → Herramientas de desarrollo (or F12)
    // Not opened automatically to avoid the Chromium resize px overlay
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
