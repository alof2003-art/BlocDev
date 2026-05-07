import { useState, useEffect, useRef } from 'react';
import type { Module } from '../types';

interface QuickOpenProps {
  modules: Module[];
  onSelect: (moduleId: string, sectionId: string) => void;
  onClose: () => void;
}

export function QuickOpen({ modules, onSelect, onClose }: QuickOpenProps) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Flatten all sections into a searchable list
  const allSections = modules.flatMap((mod) =>
    mod.sections.map((sec) => ({
      moduleId:   mod.id,
      moduleName: mod.moduleName,
      sectionId:  sec.id,
      title:      sec.title,
      language:   sec.language,
    })),
  );

  const filtered = query.trim()
    ? allSections.filter(
        (s) =>
          s.title.toLowerCase().includes(query.toLowerCase()) ||
          s.moduleName.toLowerCase().includes(query.toLowerCase()),
      )
    : allSections;

  // Reset cursor when results change
  useEffect(() => { setCursor(0); }, [query]);

  // Focus input on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Close on Escape, navigate with arrows, select with Enter
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    if (e.key === 'Enter' && filtered[cursor]) {
      onSelect(filtered[cursor].moduleId, filtered[cursor].sectionId);
      onClose();
    }
  };

  const LANG_COLOR: Record<string, string> = {
    javascript: 'text-yellow-400', typescript: 'text-blue-400',
    python: 'text-green-400',      rust: 'text-orange-400',
    go: 'text-cyan-400',           default: 'text-white/30',
  };

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-[500] flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg bg-[#1c2128] border border-white/10 rounded-lg shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <span className="text-white/30 text-sm">🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar sección…"
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-white/30 font-mono"
          />
          <kbd className="text-[10px] text-white/20 font-mono border border-white/10 rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <ul className="max-h-72 overflow-y-auto py-1 scrollbar-thin">
          {filtered.length === 0 && (
            <li className="px-4 py-3 text-sm text-white/30 text-center">
              Sin resultados
            </li>
          )}
          {filtered.map((item, i) => (
            <li
              key={item.sectionId}
              className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ${
                i === cursor ? 'bg-indigo-500/20' : 'hover:bg-white/5'
              }`}
              onMouseEnter={() => setCursor(i)}
              onClick={() => { onSelect(item.moduleId, item.sectionId); onClose(); }}
            >
              <span className={`text-xs font-mono w-6 shrink-0 ${LANG_COLOR[item.language] ?? LANG_COLOR.default}`}>
                {item.language.slice(0, 2).toUpperCase()}
              </span>
              <span className="flex-1 min-w-0">
                <span className="text-white text-sm truncate block">{item.title}</span>
                <span className="text-white/30 text-xs truncate block">{item.moduleName}</span>
              </span>
            </li>
          ))}
        </ul>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-white/5 flex gap-4 text-[10px] text-white/20 font-mono">
          <span>↑↓ navegar</span>
          <span>↵ abrir</span>
          <span>ESC cerrar</span>
        </div>
      </div>
    </div>
  );
}
