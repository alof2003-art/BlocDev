import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';

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

interface SectionMeta {
  id: string;
  title: string;
  language: string;
  file: string;
}

interface ModuleMeta {
  id: string;
  moduleName: string;
  folder: string;
  sections: SectionMeta[];
}

// ─── Paths ────────────────────────────────────────────────────────────────────

const ROOT_DIR   = path.join(app.getPath('userData'), 'dev-notes');
const INDEX_FILE = path.join(ROOT_DIR, 'index.json');

// ─── Main window (declared early so all IPC handlers can reference it) ────────

let mainWindow: BrowserWindow | null = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strip illegal filesystem characters and cap length */
function safeName(name: string): string {
  return name
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 100) || '_unnamed';
}

const LANG_EXT: Record<string, string> = {
  javascript: 'js',  typescript: 'ts',  python:    'py',
  rust:       'rs',  go:         'go',  java:      'java',
  cpp:        'cpp', c:          'c',   csharp:    'cs',
  html:       'html',css:        'css', json:      'json',
  markdown:   'md',  sql:        'sql', shell:     'sh',
  plaintext:  'txt',
};

function extFor(language: string): string {
  return LANG_EXT[language] ?? 'txt';
}

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

// ─── Content normalization ────────────────────────────────────────────────────

/**
 * Normalize line endings to CRLF on Windows, LF elsewhere.
 * Ensures files are readable by Notepad and any other editor.
 * Also trims trailing whitespace from each line (auto-format on save).
 */
function normalizeContent(content: string): string {
  // 1. Normalize all line endings to \n first
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 2. Trim trailing whitespace from each line
  const trimmed = normalized
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');

  // 3. Use OS-native line ending
  const eol = os.platform() === 'win32' ? '\r\n' : '\n';
  return trimmed.replace(/\n/g, eol);
}

// ─── Atomic write ─────────────────────────────────────────────────────────────

/**
 * Write content atomically: write to a temp file first, then rename.
 * Prevents 0-byte files if the process is killed mid-write.
 */
function atomicWrite(filePath: string, content: string): void {
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, content, 'utf-8');
  fs.renameSync(tmp, filePath);
}

// ─── Read ─────────────────────────────────────────────────────────────────────

function readData(): Module[] {
  try {
    if (!fs.existsSync(INDEX_FILE)) return [];
    const index: ModuleMeta[] = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
    if (!Array.isArray(index)) return [];

    return index.map((mod) => {
      const moduleFolder = path.join(ROOT_DIR, mod.folder);
      const sections: NoteSection[] = (mod.sections ?? []).map((sec) => {
        const filePath = path.join(moduleFolder, sec.file);
        let content = '';
        try {
          if (fs.existsSync(filePath)) {
            // Normalize to \n when loading into the editor
            content = fs.readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n');
          }
        } catch { /* unreadable — return empty */ }
        return { id: sec.id, title: sec.title, language: sec.language, content };
      });
      return { id: mod.id, moduleName: mod.moduleName, sections };
    });
  } catch {
    return [];
  }
}

// ─── Write ────────────────────────────────────────────────────────────────────

function writeData(modules: Module[]): void {
  fs.mkdirSync(ROOT_DIR, { recursive: true });

  const newIndex: ModuleMeta[] = modules.map((mod) => {
    const folderName   = safeName(mod.moduleName);
    const moduleFolder = path.join(ROOT_DIR, folderName);
    fs.mkdirSync(moduleFolder, { recursive: true });

    const sectionsMeta: SectionMeta[] = mod.sections.map((sec) => {
      const filename = uniqueFilename(moduleFolder, sec.title, sec.language);
      const filePath = path.join(moduleFolder, filename);
      atomicWrite(filePath, normalizeContent(sec.content));
      return { id: sec.id, title: sec.title, language: sec.language, file: filename };
    });

    return { id: mod.id, moduleName: mod.moduleName, folder: folderName, sections: sectionsMeta };
  });

  atomicWrite(INDEX_FILE, JSON.stringify(newIndex, null, 2));

  // Garbage-collect orphaned folders / files
  const activeFolders = new Set(newIndex.map((m) => m.folder));
  const activeFiles   = new Map<string, Set<string>>();
  for (const mod of newIndex) {
    activeFiles.set(mod.folder, new Set(mod.sections.map((s) => s.file)));
  }
  try {
    for (const entry of fs.readdirSync(ROOT_DIR)) {
      if (entry === 'index.json') continue;
      const entryPath = path.join(ROOT_DIR, entry);
      if (!fs.statSync(entryPath).isDirectory()) continue;
      if (!activeFolders.has(entry)) {
        fs.rmSync(entryPath, { recursive: true, force: true });
      } else {
        const keepFiles = activeFiles.get(entry) ?? new Set();
        for (const file of fs.readdirSync(entryPath)) {
          if (!keepFiles.has(file)) fs.rmSync(path.join(entryPath, file), { force: true });
        }
      }
    }
  } catch { /* GC errors are non-fatal */ }
}

// ─── IPC — Notes ─────────────────────────────────────────────────────────────

ipcMain.handle('notes:load', () => readData());

ipcMain.handle('notes:save', (_e, modules: Module[]) => {
  writeData(modules);
  return { success: true };
});

ipcMain.handle(
  'notes:saveSection',
  (_e, moduleId: string, sectionId: string, content: string) => {
    try {
      if (!fs.existsSync(INDEX_FILE)) return { success: false };
      const index: ModuleMeta[] = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
      const mod = index.find((m) => m.id === moduleId);
      if (!mod) return { success: false };
      const sec = mod.sections.find((s) => s.id === sectionId);
      if (!sec) return { success: false };
      const filePath = path.join(ROOT_DIR, mod.folder, sec.file);
      atomicWrite(filePath, normalizeContent(content));
      return { success: true };
    } catch {
      return { success: false };
    }
  },
);

// ─── IPC — Window controls ────────────────────────────────────────────────────

ipcMain.on('window:minimize',    () => mainWindow?.minimize());
ipcMain.on('window:maximize',    () => {
  if (!mainWindow) return;
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.on('window:close',       () => mainWindow?.close());
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false);

// ─── IPC — Menu actions ───────────────────────────────────────────────────────

ipcMain.on('menu:openDataFolder', () => shell.openPath(ROOT_DIR));

ipcMain.on('menu:openSectionFile', (_e, moduleId: string, sectionId: string) => {
  try {
    if (!fs.existsSync(INDEX_FILE)) return;
    const index: ModuleMeta[] = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
    const mod = index.find((m) => m.id === moduleId);
    if (!mod) return;
    const sec = mod.sections.find((s) => s.id === sectionId);
    if (!sec) return;
    shell.openPath(path.join(ROOT_DIR, mod.folder, sec.file));
  } catch { /* ignore */ }
});

ipcMain.on('menu:about', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'BlocDev',
    message: 'BlocDev',
    detail: 'Editor de notas para programadores.\n\nVersion 1.0.0\nElectron + React + Monaco Editor',
    buttons: ['OK'],
  });
});

ipcMain.on('menu:devtools', () => mainWindow?.webContents.toggleDevTools());
ipcMain.on('menu:reload',   () => mainWindow?.webContents.reload());

// ─── IPC — Shortcut triggers (main → renderer) ───────────────────────────────
// These are fired by Electron's global accelerators so they work even when
// Monaco has focus and would otherwise swallow the keystrokes.

ipcMain.on('shortcut:forceSave',    () => mainWindow?.webContents.send('shortcut:forceSave'));
ipcMain.on('shortcut:toggleSidebar',() => mainWindow?.webContents.send('shortcut:toggleSidebar'));
ipcMain.on('shortcut:moveSectionUp',() => mainWindow?.webContents.send('shortcut:moveSectionUp'));
ipcMain.on('shortcut:moveSectionDown',()=>mainWindow?.webContents.send('shortcut:moveSectionDown'));
ipcMain.on('shortcut:quickOpen',    () => mainWindow?.webContents.send('shortcut:quickOpen'));

// ─── Window ───────────────────────────────────────────────────────────────────

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0f1117',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.on('maximize',   () => mainWindow?.webContents.send('window:maximizeChange', true));
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window:maximizeChange', false));

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
