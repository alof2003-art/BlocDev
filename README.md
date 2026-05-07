# BlocDev

<div align="center">

![BlocDev Banner](https://img.shields.io/badge/BlocDev-Editor%20para%20Programadores-6366f1?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0yMCAzSDRjLTEuMSAwLTIgLjktMiAydjE0YzAgMS4xLjkgMiAyIDJoMTZjMS4xIDAgMi0uOSAyLTJWNWMwLTEuMS0uOS0yLTItMnptLTkgMTRINXYtMmg2djJ6bTgtNEg1di0yaDEydjJ6bTAtNEg1VjdoMTJ2MnoiLz48L3N2Zz4=)

**Editor de notas especializado para programadores**

[![Electron](https://img.shields.io/badge/Electron-42-47848F?style=flat-square&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Monaco Editor](https://img.shields.io/badge/Monaco_Editor-latest-0078D4?style=flat-square&logo=visualstudiocode&logoColor=white)](https://microsoft.github.io/monaco-editor/)

</div>

---

## ¿Qué es BlocDev?

BlocDev es una aplicación de escritorio para tomar notas de código. Organiza tu conocimiento técnico en **módulos** (temas) y **secciones** (archivos de código), con resaltado de sintaxis real gracias a Monaco Editor — el mismo motor que usa VS Code.

Cada nota se guarda como un archivo real en tu sistema de archivos, con su extensión correcta (`.js`, `.py`, `.ts`, etc.), lo que significa que puedes abrirlos desde cualquier editor externo.

---

## Características

- **Estructura jerárquica** — Módulos que contienen secciones de código
- **Monaco Editor** — Resaltado de sintaxis para 16 lenguajes de programación
- **Persistencia en archivos reales** — Cada sección es un archivo `.js`, `.py`, `.ts`, etc. en tu disco
- **Guardado inteligente** — Guardado parcial debounced (600ms) al escribir, guardado completo en cambios estructurales
- **Barra de título personalizada** — Ventana frameless con menús (Archivo, Ver, Herramientas) y controles de ventana
- **Dark mode** — Diseño minimalista oscuro con fuente JetBrains Mono
- **Atajos de teclado** — Crear módulos y secciones sin usar el ratón
- **IPC seguro** — `contextIsolation: true`, `nodeIntegration: false`, comunicación via `contextBridge`

---

## Stack tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Framework de escritorio | Electron | 42 |
| UI | React + TypeScript | 19 / 6 |
| Bundler | Vite | 8 |
| Estilos | Tailwind CSS | v4 |
| Editor de código | Monaco Editor | latest |
| Generación de IDs | uuid | 14 |

---

## Instalación y uso

### Requisitos

- Node.js 18 o superior
- npm 9 o superior

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/alof2003-art/BlocDev.git
cd BlocDev

# 2. Instalar dependencias
npm install

# 3. Ejecutar en modo desarrollo
npm run dev
```

### Scripts disponibles

```bash
npm run dev          # Desarrollo: Vite + Electron en paralelo
npm run build        # Build de producción completo
npm run build:electron  # Solo compilar el proceso Electron
npm run lint         # Ejecutar ESLint
```

---

## Cómo funciona `npm run dev`

```
1. vite              → Servidor de desarrollo en localhost:5173
2. wait-on           → Espera a que Vite esté listo
3. tsc (electron)    → Compila electron/main.ts y preload.ts → dist-electron/
4. rename-electron   → Renombra .js → .cjs (fix conflicto ESM/CJS)
5. electron .        → Lanza la app apuntando a dist-electron/main.cjs
```

---

## Estructura del proyecto

```
BlocDev/
├── electron/
│   ├── main.ts          # Proceso principal: ventana, IPC, persistencia
│   └── preload.ts       # contextBridge: notesAPI, windowAPI, menuAPI
│
├── src/
│   ├── types.ts         # Interfaces: NoteSection, Module, LANGUAGES
│   ├── store.ts         # Estado global (hook useNotesStore)
│   ├── electron.d.ts    # Tipos globales para window.notesAPI/windowAPI/menuAPI
│   ├── App.tsx          # Componente raíz + atajos de teclado globales
│   ├── index.css        # Tailwind + fuentes + Monaco background fix
│   └── components/
│       ├── TitleBar.tsx     # Barra de título: menús + controles de ventana
│       ├── Sidebar.tsx      # Panel izquierdo: módulos y secciones
│       └── EditorPanel.tsx  # Monaco Editor + toolbar
│
├── scripts/
│   └── rename-electron.mjs  # Renombra dist-electron/*.js → *.cjs
│
├── tsconfig.app.json        # TypeScript para el renderer (React)
├── tsconfig.electron.json   # TypeScript para Electron (CommonJS)
├── vite.config.ts           # Vite + Tailwind v4 plugin
└── package.json
```

---

## Modelo de datos

```typescript
interface NoteSection {
  id: string;       // UUID v4
  title: string;    // Nombre de la sección = nombre del archivo en disco
  content: string;  // Contenido del editor
  language: string; // Lenguaje para Monaco
}

interface Module {
  id: string;         // UUID v4
  moduleName: string; // Nombre del módulo = nombre de la carpeta en disco
  sections: NoteSection[];
}
```

---

## Persistencia en disco

Los datos se guardan en la carpeta de usuario del sistema operativo:

| Sistema | Ruta |
|---|---|
| Windows | `%APPDATA%\dev-notes\` |
| macOS | `~/Library/Application Support/dev-notes/` |
| Linux | `~/.config/dev-notes/` |

### Estructura de archivos generada

```
dev-notes/
├── index.json          ← Metadatos: orden, IDs, lenguaje, nombre de archivo
├── JavaScript/
│   ├── Closures.js
│   └── Promises & Async.js
├── TypeScript/
│   └── Generics.ts
└── Python/
    └── Decorators.py
```

`index.json` solo contiene metadatos — el contenido real vive en los archivos individuales. Esto permite abrir cualquier nota desde VS Code u otro editor externo.

### Estrategia de guardado

| Operación | Tipo | Comportamiento |
|---|---|---|
| Escribir en el editor | Parcial — debounced 600ms | Solo reescribe el archivo de esa sección |
| Crear / renombrar / borrar | Completo — inmediato | Reescribe `index.json` + todos los archivos |

Un garbage collector automático elimina carpetas y archivos huérfanos cuando se borra un módulo o sección.

---

## Interfaz de usuario

### Barra de título personalizada

Ventana frameless con tres zonas:

```
[ ⌘ BlocDev ]  [ Archivo ]  [ Ver ]  [ Herramientas ]  ···drag···  [ — ][ □ ][ ✕ ]
```

**Menú Archivo**
- Nuevo módulo — `Ctrl+M`
- Nueva sección — `Ctrl+Shift+N`
- Abrir carpeta de datos
- Cerrar aplicación

**Menú Ver**
- Buscar en editor — `Ctrl+F`
- Recargar
- Herramientas de desarrollo

**Menú Herramientas**
- Abrir carpeta de datos
- Herramientas de desarrollo
- Recargar ventana
- Acerca de BlocDev

### Sidebar

- Módulos colapsables con chevron animado
- Doble clic para renombrar inline
- Botón `+` en hover para añadir sección
- Botón `✕` en hover para eliminar
- Badge de lenguaje en cada sección (`JS`, `PY`, `TS`...)

### Editor Monaco

- Resaltado de sintaxis dinámico
- Fuente: JetBrains Mono → Fira Code → Cascadia Code → Consolas
- Ligaduras activadas, sin minimap, word wrap activado
- Bracket pair colorization
- Indicador de estado: `● Saved` / `◌ Saving…` / `○ Unsaved`
- Selector de lenguaje en toolbar
- Título editable inline

---

## Atajos de teclado

| Atajo | Acción |
|---|---|
| `Ctrl + M` | Nuevo módulo con sección vacía |
| `Ctrl + Shift + N` | Nueva sección en el módulo activo |
| `Ctrl + F` | Abrir Find/Replace de Monaco |
| Doble clic en módulo | Renombrar módulo inline |

---

## Lenguajes soportados

| Lenguaje | Extensión | Lenguaje | Extensión |
|---|---|---|---|
| JavaScript | `.js` | HTML | `.html` |
| TypeScript | `.ts` | CSS | `.css` |
| Python | `.py` | JSON | `.json` |
| Rust | `.rs` | Markdown | `.md` |
| Go | `.go` | SQL | `.sql` |
| Java | `.java` | Shell | `.sh` |
| C++ | `.cpp` | Plain Text | `.txt` |
| C | `.c` | C# | `.cs` |

---

## Seguridad IPC

```
Renderer (React)
      │
      │  window.notesAPI / window.windowAPI / window.menuAPI
      │  (solo funciones explícitamente expuestas)
      ▼
  preload.ts  ←  contextBridge  (contextIsolation: true, nodeIntegration: false)
      │
      │  ipcRenderer.invoke / ipcRenderer.send
      ▼
  main.ts  ←  ipcMain.handle / ipcMain.on
      │
      ▼
  Sistema de archivos / BrowserWindow
```

El renderer nunca tiene acceso directo a Node.js ni a las APIs de Electron.

---

## Soluciones técnicas destacadas

### Conflicto ESM / CommonJS

`package.json` tiene `"type": "module"` (requerido por Vite), pero Electron necesita CommonJS. La solución: compilar el proceso Electron con `"module": "CommonJS"` y renombrar los archivos de salida a `.cjs` mediante `scripts/rename-electron.mjs`. Node.js siempre trata los `.cjs` como CommonJS independientemente del campo `type`.

### Workers de Monaco en Electron

Monaco Editor usa Web Workers para el análisis de código. En Electron no puede cargarlos desde CDN. La solución es importarlos directamente con los imports `?worker` de Vite y configurar `self.MonacoEnvironment` antes de montar el editor:

```typescript
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
// ...

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'typescript' || label === 'javascript') return new tsWorker();
    return new editorWorker();
  },
};
loader.config({ monaco });
```

### Stale closures en el store

Los callbacks de React capturan el estado en el momento de su creación. Para evitar que `addModule` o `addSection` trabajen con datos desactualizados, el store mantiene un `useRef` (`modulesRef`) siempre sincronizado con el estado actual. Todas las mutaciones leen de `modulesRef.current` en lugar del estado de React.

---

## Licencia

MIT
