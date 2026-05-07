import { useState, useEffect, useRef, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MenuItem {
  label: string;
  shortcut?: string;
  action?: () => void;
  separator?: false;
}
interface MenuSeparator {
  separator: true;
}
type MenuEntry = MenuItem | MenuSeparator;

interface MenuDef {
  label: string;
  items: MenuEntry[];
}

// ─── Dropdown ─────────────────────────────────────────────────────────────────

function Dropdown({
  items,
  onClose,
}: {
  items: MenuEntry[];
  onClose: () => void;
}) {
  return (
    <div className="absolute top-full left-0 mt-0.5 min-w-[200px] bg-[#1c2128] border border-white/10 rounded shadow-2xl z-[200] py-1">
      {items.map((item, i) => {
        if ('separator' in item && item.separator) {
          return <div key={i} className="my-1 border-t border-white/10" />;
        }
        const mi = item as MenuItem;
        return (
          <button
            key={i}
            className="w-full flex items-center justify-between px-4 py-1.5 text-sm text-white/70 hover:bg-indigo-500/20 hover:text-white transition-colors text-left"
            onClick={() => {
              mi.action?.();
              onClose();
            }}
          >
            <span>{mi.label}</span>
            {mi.shortcut && (
              <span className="ml-8 text-xs text-white/30 font-mono">{mi.shortcut}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── TitleBar ─────────────────────────────────────────────────────────────────

interface TitleBarProps {
  onAddModule: () => void;
  onAddSection: () => void;
  onFind: () => void;
}

export function TitleBar({ onAddModule, onAddSection, onFind }: TitleBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  // Sync maximize state on mount and listen for changes
  useEffect(() => {
    window.windowAPI?.isMaximized().then(setIsMaximized);
    const unsub = window.windowAPI?.onMaximizeChange(setIsMaximized);
    return () => unsub?.();
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    if (!openMenu) return;
    const handler = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenu]);

  const toggle = useCallback((name: string) => {
    setOpenMenu((prev) => (prev === name ? null : name));
  }, []);

  // ── Menu definitions ────────────────────────────────────────────────────────

  const menus: MenuDef[] = [
    {
      label: 'Archivo',
      items: [
        {
          label: 'Nuevo módulo',
          shortcut: 'Ctrl+M',
          action: () => { onAddModule(); },
        },
        {
          label: 'Nueva sección',
          shortcut: 'Ctrl+Shift+N',
          action: () => { onAddSection(); },
        },
        { separator: true },
        {
          label: 'Abrir carpeta de datos',
          action: () => window.menuAPI?.openDataFolder(),
        },
        { separator: true },
        {
          label: 'Cerrar aplicación',
          shortcut: 'Alt+F4',
          action: () => window.windowAPI?.close(),
        },
      ],
    },
    {
      label: 'Ver',
      items: [
        {
          label: 'Buscar en editor',
          shortcut: 'Ctrl+F',
          action: () => { onFind(); },
        },
        { separator: true },
        {
          label: 'Recargar',
          shortcut: 'Ctrl+R',
          action: () => window.menuAPI?.reload(),
        },
        {
          label: 'Herramientas de desarrollo',
          shortcut: 'F12',
          action: () => window.menuAPI?.devtools(),
        },
      ],
    },
    {
      label: 'Herramientas',
      items: [
        {
          label: 'Abrir carpeta de datos',
          action: () => window.menuAPI?.openDataFolder(),
        },
        { separator: true },
        {
          label: 'Herramientas de desarrollo',
          shortcut: 'F12',
          action: () => window.menuAPI?.devtools(),
        },
        {
          label: 'Recargar ventana',
          shortcut: 'Ctrl+R',
          action: () => window.menuAPI?.reload(),
        },
        { separator: true },
        {
          label: 'Acerca de DevNotes',
          action: () => window.menuAPI?.about(),
        },
      ],
    },
  ];

  return (
    <div
      ref={barRef}
      className="absolute top-0 left-0 right-0 h-9 flex items-stretch z-[100] bg-[#0d1117] border-b border-white/5 select-none"
      // The drag region covers the whole bar; buttons use no-drag to be clickable
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* ── App icon + name ── */}
      <div
        className="flex items-center gap-2 px-3 shrink-0"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <span className="text-indigo-400 text-base leading-none">⌘</span>
        <span className="text-white/60 text-xs font-semibold tracking-wide">DevNotes</span>
      </div>

      {/* ── Menu bar ── */}
      <div
        className="flex items-stretch"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {menus.map((menu) => (
          <div key={menu.label} className="relative flex items-stretch">
            <button
              className={`px-3 text-xs font-medium transition-colors h-full ${
                openMenu === menu.label
                  ? 'bg-white/10 text-white'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              }`}
              onClick={() => toggle(menu.label)}
            >
              {menu.label}
            </button>
            {openMenu === menu.label && (
              <Dropdown
                items={menu.items}
                onClose={() => setOpenMenu(null)}
              />
            )}
          </div>
        ))}
      </div>

      {/* ── Spacer (draggable) ── */}
      <div className="flex-1" />

      {/* ── Window controls ── */}
      <div
        className="flex items-stretch shrink-0"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {/* Minimize */}
        <button
          onClick={() => window.windowAPI?.minimize()}
          title="Minimizar"
          className="w-11 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        >
          <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
            <rect width="10" height="1" />
          </svg>
        </button>

        {/* Maximize / Restore */}
        <button
          onClick={() => window.windowAPI?.maximize()}
          title={isMaximized ? 'Restaurar' : 'Maximizar'}
          className="w-11 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        >
          {isMaximized ? (
            /* Restore icon — two overlapping squares */
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="2" y="0" width="8" height="8" />
              <polyline points="0,2 0,10 8,10" />
            </svg>
          ) : (
            /* Maximize icon — single square */
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="0" y="0" width="10" height="10" />
            </svg>
          )}
        </button>

        {/* Close */}
        <button
          onClick={() => window.windowAPI?.close()}
          title="Cerrar"
          className="w-11 flex items-center justify-center text-white/40 hover:text-white hover:bg-red-500 transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
            <line x1="0" y1="0" x2="10" y2="10" />
            <line x1="10" y1="0" x2="0" y2="10" />
          </svg>
        </button>
      </div>
    </div>
  );
}
