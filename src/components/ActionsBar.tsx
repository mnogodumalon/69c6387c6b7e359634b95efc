import { useState, useEffect, useRef, useMemo } from 'react';
import { IconPlayerPlay, IconCode, IconTrash, IconChevronDown, IconFile, IconFileTypePdf, IconPhoto, IconDownload } from '@tabler/icons-react';
import { useActions } from '@/context/ActionsContext';

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType === 'application/pdf') return <IconFileTypePdf size={14} className="shrink-0 text-red-500" />;
  if (mimeType.startsWith('image/')) return <IconPhoto size={14} className="shrink-0 text-blue-500" />;
  return <IconFile size={14} className="shrink-0 text-muted-foreground" />;
}

type FileSortMode = 'newest' | 'oldest' | 'az' | 'za';
const FILE_SORT_LABELS: Record<FileSortMode, string> = {
  newest: 'Neuste zuerst',
  oldest: 'Älteste zuerst',
  az: 'Name A→Z',
  za: 'Name Z→A',
};

export default function ActionsBar() {
  const { actions, runAction, showActionCode, deleteAction, devMode, files, downloadFile } = useActions();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [fileSort, setFileSort] = useState<FileSortMode>('newest');
  const [expandedAction, setExpandedAction] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) => {
      switch (fileSort) {
        case 'newest': return b.created_at.localeCompare(a.created_at);
        case 'oldest': return a.created_at.localeCompare(b.created_at);
        case 'az': return a.filename.localeCompare(b.filename);
        case 'za': return b.filename.localeCompare(a.filename);
      }
    });
  }, [files, fileSort]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setExpandedAction(null);
        setFilesOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (actions.length === 0 && files.length === 0) return null;

  return (
    <div ref={barRef} className="relative z-10 flex justify-end mb-3">
      {/* Desktop: show all action buttons + files */}
      <div className="hidden lg:flex flex-wrap gap-2 justify-end">
        {files.length > 0 && (
          <div className="relative">
            <button
              onClick={() => { setFilesOpen(!filesOpen); setExpandedAction(null); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                filesOpen ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary hover:bg-primary/20'
              }`}
            >
              <IconFile size={14} />
              Dateien ({files.length})
            </button>
            {filesOpen && (
              <div className="absolute top-full right-0 mt-1 z-30 bg-card border border-border rounded-xl shadow-lg min-w-64 max-w-80">
                <div className="flex flex-wrap gap-1 px-3 pt-3 pb-2">
                  {(['newest', 'oldest', 'az', 'za'] as FileSortMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setFileSort(mode)}
                      className={`px-2 py-1 rounded-lg text-xs transition-colors ${
                        fileSort === mode ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-accent'
                      }`}
                    >
                      {FILE_SORT_LABELS[mode]}
                    </button>
                  ))}
                </div>
                <div className="max-h-72 overflow-y-auto p-1.5 pt-0">
                  {sortedFiles.map(f => (
                    <button
                      key={f.identifier}
                      onClick={() => { void downloadFile(f.url, f.filename); setFilesOpen(false); }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-accent text-left transition-colors"
                    >
                      <FileIcon mimeType={f.mime_type} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{f.filename}</div>
                        <div className="text-xs text-muted-foreground truncate">{f.app_name}</div>
                      </div>
                      <IconDownload size={14} className="shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {actions.map(a => {
          const key = `${a.app_id}/${a.identifier}`;
          const isExpanded = expandedAction === key;
          return (
            <div key={key} className="relative">
              <button
                onClick={() => setExpandedAction(isExpanded ? null : key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                  isExpanded ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary hover:bg-primary/20'
                }`}
              >
                <IconPlayerPlay size={14} />
                {a.title || a.identifier}
              </button>
              {isExpanded && (
                <div className="absolute top-full left-0 mt-1 z-30 bg-card border border-border rounded-xl shadow-lg p-3 min-w-48">
                  <div className="text-sm font-medium text-foreground mb-0.5">{a.title || a.identifier}</div>
                  {devMode && <div className="text-xs text-muted-foreground font-mono mb-0.5">{a.identifier}</div>}
                  {a.description && <div className="text-xs text-muted-foreground mb-2">{a.description}</div>}
                  <div className="flex gap-1">
                    <button
                      onClick={() => { runAction(a); setExpandedAction(null); }}
                      className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                      title="Ausführen"
                    >
                      <IconPlayerPlay size={16} />
                    </button>
                    {devMode && (
                      <button
                        onClick={() => { showActionCode(a); setExpandedAction(null); }}
                        className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                        title="Quellcode"
                      >
                        <IconCode size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => { void deleteAction(a); setExpandedAction(null); }}
                      className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                      title="Löschen"
                    >
                      <IconTrash size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Mobile: combined dropdown for actions + files */}
      <div className="lg:hidden flex gap-2 relative">
        {files.length > 0 && (
          <button
            onClick={() => { setFilesOpen(!filesOpen); setDropdownOpen(false); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <IconFile size={14} />
            {files.length}
          </button>
        )}
        {actions.length > 0 && (
          <button
            onClick={() => { setDropdownOpen(o => !o); setFilesOpen(false); }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            Aktionen ({actions.length})
            <IconChevronDown size={14} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>
        )}
        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-[55]" onClick={() => setDropdownOpen(false)} />
            <div className="absolute right-0 top-full mt-1 z-[60] bg-card border border-border rounded-xl shadow-lg p-1.5 min-w-52 max-w-[calc(100vw-2rem)]">
              {actions.map(a => (
                <div
                  key={`${a.app_id}/${a.identifier}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{a.title || a.identifier}</div>
                    {devMode && <div className="text-xs text-muted-foreground font-mono truncate">{a.identifier}</div>}
                    {a.description && <div className="text-xs text-muted-foreground truncate">{a.description}</div>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => { runAction(a); setDropdownOpen(false); }}
                      className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                    >
                      <IconPlayerPlay size={14} />
                    </button>
                    {devMode && (
                      <button
                        onClick={() => { showActionCode(a); setDropdownOpen(false); }}
                        className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                      >
                        <IconCode size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => { void deleteAction(a); setDropdownOpen(false); }}
                      className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {filesOpen && files.length > 0 && (
          <>
            <div className="fixed inset-0 z-[55]" onClick={() => setFilesOpen(false)} />
            <div className="absolute right-0 top-full mt-1 z-[60] bg-card border border-border rounded-xl shadow-lg min-w-52 max-w-[calc(100vw-2rem)]">
              <div className="max-h-72 overflow-y-auto p-1.5">
                {sortedFiles.map(f => (
                  <button
                    key={f.identifier}
                    onClick={() => { void downloadFile(f.url, f.filename); setFilesOpen(false); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg hover:bg-accent text-left transition-colors"
                  >
                    <FileIcon mimeType={f.mime_type} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{f.filename}</div>
                      <div className="text-xs text-muted-foreground truncate">{f.app_name}</div>
                    </div>
                    <IconDownload size={14} className="shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
