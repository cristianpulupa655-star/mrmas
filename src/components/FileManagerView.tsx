import React, {useCallback, useEffect, useState} from 'react';
import {
  ChevronRight,
  Download,
  FileText,
  Folder,
  FolderPlus,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import type {FileEntry} from '../types/server';

interface FileManagerViewProps {
  onConfigSynced: () => Promise<void>;
}

export const FileManagerView: React.FC<FileManagerViewProps> = ({onConfigSynced}) => {
  const [currentPath, setCurrentPath] = useState('');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [dirty, setDirty] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemMode, setNewItemMode] = useState<'file' | 'dir' | null>(null);

  const loadDirectory = useCallback(async (dirPath: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(dirPath)}`);
      if (!res.ok) throw new Error('Error cargando directorio');
      const data = (await res.json()) as {path: string; entries: FileEntry[]};
      setCurrentPath(data.path);
      setEntries(data.entries);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDirectory('');
  }, [loadDirectory]);

  const openFile = async (entry: FileEntry) => {
    if (entry.isDirectory) {
      setSelectedFile(null);
      setDirty(false);
      await loadDirectory(entry.path);
      return;
    }
    const res = await fetch(`/api/files/content?path=${encodeURIComponent(entry.path)}`);
    if (!res.ok) return;
    const data = (await res.json()) as {path: string; content: string};
    setSelectedFile(data.path);
    setFileContent(data.content);
    setDirty(false);
    setStatusMsg(null);
  };

  const handleSaveFile = async () => {
    if (!selectedFile) return;
    const res = await fetch('/api/files/save', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({path: selectedFile, content: fileContent}),
    });
    if (res.ok) {
      setDirty(false);
      setStatusMsg('Archivo guardado en disco');
      await onConfigSynced();
      await loadDirectory(currentPath);
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemMode) return;
    const res = await fetch('/api/files/create', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        parentPath: currentPath,
        name: newItemName.trim(),
        isDirectory: newItemMode === 'dir',
        content: newItemMode === 'file' ? '# Nuevo archivo de configuración Forge 1.16.5\n' : undefined,
      }),
    });
    if (res.ok) {
      setNewItemName('');
      setNewItemMode(null);
      await loadDirectory(currentPath);
    }
  };

  const handleDelete = async (entry: FileEntry) => {
    const res = await fetch(`/api/files?path=${encodeURIComponent(entry.path)}`, {method: 'DELETE'});
    if (res.ok) {
      if (selectedFile === entry.path) {
        setSelectedFile(null);
        setFileContent('');
      }
      await loadDirectory(currentPath);
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const targetPath = currentPath ? `${currentPath}/${file.name}` : file.name;
    await fetch('/api/files/save', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({path: targetPath, content: text}),
    });
    await loadDirectory(currentPath);
    e.target.value = '';
  };

  const pathSegments = currentPath ? currentPath.split('/') : [];

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <div className="bg-[#111827] border border-slate-800/90 rounded-lg px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <button
            onClick={() => void loadDirectory('')}
            className="text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer"
          >
            /mc-forge-1.16.5
          </button>
          {pathSegments.map((seg, i) => {
            const target = pathSegments.slice(0, i + 1).join('/');
            return (
              <React.Fragment key={target}>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                <button
                  onClick={() => void loadDirectory(target)}
                  className="text-slate-200 hover:text-white cursor-pointer"
                >
                  {seg}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setNewItemMode('file')}
            className="px-3 py-1.5 text-xs font-medium bg-[#0B0F17] border border-slate-800 hover:border-slate-700 text-slate-200 rounded flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo Archivo
          </button>
          <button
            onClick={() => setNewItemMode('dir')}
            className="px-3 py-1.5 text-xs font-medium bg-[#0B0F17] border border-slate-800 hover:border-slate-700 text-slate-200 rounded flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            Nueva Carpeta
          </button>
          <label className="px-3 py-1.5 text-xs font-medium bg-[#0B0F17] border border-slate-800 hover:border-slate-700 text-slate-200 rounded flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
            <Upload className="w-3.5 h-3.5" />
            Subir Archivo
            <input type="file" onChange={handleUploadFile} className="hidden" />
          </label>
          <button
            onClick={() => void loadDirectory(currentPath)}
            title="Recargar directorio"
            className="p-1.5 bg-[#0B0F17] border border-slate-800 hover:border-slate-700 text-slate-300 rounded cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {newItemMode && (
        <form
          onSubmit={handleCreateItem}
          className="bg-[#111827] border border-slate-700 rounded-lg px-5 py-3 flex flex-wrap items-center gap-3"
        >
          <span className="text-xs text-slate-300">
            {newItemMode === 'dir' ? 'Nombre de la carpeta:' : 'Nombre del archivo:'}
          </span>
          <input
            type="text"
            autoFocus
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder={newItemMode === 'dir' ? 'datapacks' : 'custom-rules.toml'}
            className="flex-1 min-w-[200px] bg-[#0B0F17] border border-slate-800 rounded px-3 py-1.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            className="px-4 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer"
          >
            Crear
          </button>
          <button
            type="button"
            onClick={() => {
              setNewItemMode(null);
              setNewItemName('');
            }}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            Cancelar
          </button>
        </form>
      )}

      {/* 2-Column Split: File Tree List + Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <div className="lg:col-span-5 bg-[#111827] border border-slate-800/90 rounded-lg overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-800 text-xs font-medium text-slate-400 flex justify-between">
            <span>Archivos del Servidor</span>
            <span className="font-mono tabular-nums">{entries.length} elementos</span>
          </div>

          <div className="divide-y divide-slate-800/70 max-h-[540px] overflow-y-auto">
            {currentPath && (
              <button
                onClick={() => {
                  const parent = pathSegments.slice(0, -1).join('/');
                  void loadDirectory(parent);
                }}
                className="w-full px-4 py-2.5 text-left text-xs font-mono text-slate-400 hover:bg-slate-800/40 flex items-center gap-2 cursor-pointer"
              >
                <Folder className="w-4 h-4 text-slate-500" />
                .. (Subir nivel)
              </button>
            )}

            {entries.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">Directorio vacío</div>
            ) : (
              entries.map((entry) => {
                const active = selectedFile === entry.path;
                return (
                  <div
                    key={entry.path}
                    className={`px-4 py-2.5 flex items-center justify-between gap-2 transition-colors ${
                      active ? 'bg-emerald-500/10' : 'hover:bg-slate-800/35'
                    }`}
                  >
                    <button
                      onClick={() => void openFile(entry)}
                      className="flex-1 flex items-center gap-2.5 text-left min-w-0 cursor-pointer"
                    >
                      {entry.isDirectory ? (
                        <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span className="text-xs font-mono text-slate-200 truncate">{entry.name}</span>
                    </button>

                    <div className="flex items-center gap-2 shrink-0">
                      {!entry.isDirectory && (
                        <span className="text-[11px] font-mono tabular-nums text-slate-500">
                          {formatBytes(entry.sizeBytes)}
                        </span>
                      )}
                      {!entry.isDirectory && (
                        <a
                          href={`/api/files/download?path=${encodeURIComponent(entry.path)}`}
                          title="Descargar archivo"
                          className="p-1 text-slate-400 hover:text-slate-100"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        onClick={() => void handleDelete(entry)}
                        title="Eliminar"
                        className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Editor Panel */}
        <div className="lg:col-span-7 bg-[#111827] border border-slate-800/90 rounded-lg overflow-hidden flex flex-col">
          <div className="px-5 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs font-mono text-slate-200 truncate">
                {selectedFile ? selectedFile : 'Selecciona un archivo para editar'}
              </div>
              {statusMsg && <div className="text-[11px] text-emerald-400 mt-0.5">{statusMsg}</div>}
            </div>

            {selectedFile && (
              <button
                onClick={() => void handleSaveFile()}
                disabled={!dirty}
                className="px-3.5 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Save className="w-3.5 h-3.5" />
                Guardar Cambios
              </button>
            )}
          </div>

          {selectedFile ? (
            <textarea
              value={fileContent}
              onChange={(e) => {
                setFileContent(e.target.value);
                setDirty(true);
                setStatusMsg(null);
              }}
              spellCheck={false}
              className="flex-1 min-h-[480px] w-full bg-[#080C12] p-4 font-mono text-xs text-slate-200 leading-relaxed focus:outline-none resize-none"
            />
          ) : (
            <div className="flex-1 min-h-[480px] flex flex-col items-center justify-center p-8 text-center text-xs text-slate-500">
              <p className="text-slate-300 font-medium mb-1">Editor Web Integrado</p>
              <p className="max-w-sm">
                Haz clic en <span className="font-mono text-slate-300">server.properties</span>,{' '}
                <span className="font-mono text-slate-300">jvm_args.txt</span> o cualquier archivo en{' '}
                <span className="font-mono text-slate-300">config/</span> para editarlo directamente en disco.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
