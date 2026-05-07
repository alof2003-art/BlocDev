import { useState, useRef, useEffect } from 'react';
import type { Module } from '../types';

interface SidebarProps {
  modules: Module[];
  activeModuleId: string | null;
  activeSectionId: string | null;
  expandedModules: Set<string>;
  onToggleModule: (id: string) => void;
  onSelectSection: (moduleId: string, sectionId: string) => void;
  onAddModule: () => void;
  onAddSection: (moduleId: string) => void;
  onRenameModule: (moduleId: string, name: string) => void;
  onDeleteModule: (moduleId: string) => void;
  onDeleteSection: (moduleId: string, sectionId: string) => void;
}

// ─── Inline editable label ────────────────────────────────────────────────────

function EditableLabel({
  value,
  onSave,
  className,
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    else setDraft(value);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            setDraft(value);
            setEditing(false);
          }
        }}
        className="bg-transparent border-b border-indigo-400 outline-none text-sm w-full text-white"
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <span
      className={className}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
      title="Double-click to rename"
    >
      {value}
    </span>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar({
  modules,
  activeModuleId,
  activeSectionId,
  expandedModules,
  onToggleModule,
  onSelectSection,
  onAddModule,
  onAddSection,
  onRenameModule,
  onDeleteModule,
  onDeleteSection,
}: SidebarProps) {
  return (
    <aside className="w-64 min-w-[200px] max-w-xs flex flex-col bg-[#0d1117] border-r border-white/5 select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-indigo-400 text-lg">⌘</span>
          <span className="text-white font-semibold text-sm tracking-wide">DevNotes</span>
        </div>
        <button
          onClick={onAddModule}
          title="New module"
          className="text-white/40 hover:text-indigo-400 transition-colors text-lg leading-none"
        >
          +
        </button>
      </div>

      {/* Module list */}
      <nav className="flex-1 overflow-y-auto py-2 scrollbar-thin">
        {modules.length === 0 && (
          <p className="text-white/30 text-xs text-center mt-8 px-4">
            No modules yet.
            <br />
            Click + to create one.
          </p>
        )}

        {modules.map((mod) => {
          const isExpanded = expandedModules.has(mod.id);
          const isActiveModule = mod.id === activeModuleId;

          return (
            <div key={mod.id}>
              {/* Module row */}
              <div
                className={`group flex items-center gap-1 px-3 py-1.5 cursor-pointer rounded-md mx-1 transition-colors ${
                  isActiveModule && !activeSectionId
                    ? 'bg-white/5 text-white'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
                onClick={() => onToggleModule(mod.id)}
              >
                {/* Chevron */}
                <span
                  className={`text-xs transition-transform duration-150 ${
                    isExpanded ? 'rotate-90' : ''
                  } text-white/30`}
                >
                  ▶
                </span>

                {/* Module name */}
                <EditableLabel
                  value={mod.moduleName}
                  onSave={(name) => onRenameModule(mod.id, name)}
                  className="flex-1 text-sm font-medium truncate"
                />

                {/* Actions */}
                <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddSection(mod.id);
                    }}
                    title="Add section"
                    className="text-white/40 hover:text-indigo-400 text-sm px-0.5"
                  >
                    +
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete module "${mod.moduleName}"?`))
                        onDeleteModule(mod.id);
                    }}
                    title="Delete module"
                    className="text-white/40 hover:text-red-400 text-xs px-0.5"
                  >
                    ✕
                  </button>
                </span>
              </div>

              {/* Sections */}
              {isExpanded && (
                <ul className="ml-5 border-l border-white/5 pl-2 mb-1">
                  {mod.sections.length === 0 && (
                    <li className="text-white/20 text-xs py-1 px-2">
                      No sections
                    </li>
                  )}
                  {mod.sections.map((sec) => {
                    const isActive =
                      activeSectionId === sec.id && activeModuleId === mod.id;
                    return (
                      <li
                        key={sec.id}
                        className={`group flex items-center gap-1 px-2 py-1 rounded cursor-pointer text-sm transition-colors ${
                          isActive
                            ? 'bg-indigo-500/20 text-indigo-300'
                            : 'text-white/50 hover:text-white hover:bg-white/5'
                        }`}
                        onClick={() => onSelectSection(mod.id, sec.id)}
                      >
                        <span className="text-white/20 text-xs">›</span>
                        <span className="flex-1 truncate">{sec.title}</span>
                        <span className="text-[10px] text-white/20 font-mono shrink-0">
                          {sec.language.slice(0, 2).toUpperCase()}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete section "${sec.title}"?`))
                              onDeleteSection(mod.id, sec.id);
                          }}
                          title="Delete section"
                          className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 text-xs transition-opacity"
                        >
                          ✕
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-white/5 text-white/20 text-xs font-mono">
        {modules.length} module{modules.length !== 1 ? 's' : ''}
      </div>
    </aside>
  );
}
