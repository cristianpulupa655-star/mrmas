import React, {useMemo, useState} from 'react';
import {Download, Plus, Search, Trash2, Upload} from 'lucide-react';
import type {ModOrPluginItem} from '../types/server';

interface ModsPluginsViewProps {
  mods: ModOrPluginItem[];
  onToggleMod: (id: string) => Promise<void>;
  onInstallMod: (payload: {
    id?: string;
    customName?: string;
    customFileName?: string;
    customType?: 'mod' | 'performance_plugin';
  }) => Promise<void>;
  onDeleteMod: (id: string) => Promise<void>;
}

export const ModsPluginsView: React.FC<ModsPluginsViewProps> = ({
  mods,
  onToggleMod,
  onInstallMod,
  onDeleteMod,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'performance_plugin' | 'mod'>('all');
  const [search, setSearch] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customFileName, setCustomFileName] = useState('');
  const [customType, setCustomType] = useState<'mod' | 'performance_plugin'>('mod');
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return mods.filter((m) => {
      if (filterType !== 'all' && m.type !== filterType) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          m.name.toLowerCase().includes(q) ||
          m.category.toLowerCase().includes(q) ||
          m.fileName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [mods, filterType, search]);

  const installedCount = mods.filter((m) => m.installed).length;
  const activePerfCount = mods.filter((m) => m.installed && m.enabled && m.type === 'performance_plugin').length;
  const netRamSaved = mods
    .filter((m) => m.installed && m.enabled && m.ramImpactMb < 0)
    .reduce((sum, m) => sum + Math.abs(m.ramImpactMb), 0);

  const handleToggle = async (id: string) => {
    setBusyId(id);
    try {
      await onToggleMod(id);
    } finally {
      setBusyId(null);
    }
  };

  const handleInstall = async (id: string) => {
    setBusyId(id);
    try {
      await onInstallMod({id});
    } finally {
      setBusyId(null);
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim() || !customFileName.trim()) return;
    await onInstallMod({customName: customName.trim(), customFileName: customFileName.trim(), customType});
    setCustomName('');
    setCustomFileName('');
    setShowCustomForm(false);
  };

  const handleFilePicker = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCustomFileName(file.name);
    if (!customName) {
      setCustomName(file.name.replace(/\.jar$/i, ''));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Summary Strip */}
      <div className="bg-[#111827] border border-slate-800/90 rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            Mods Forge 1.16.5 y Plugins de Rendimiento
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {installedCount} módulos instalados en <span className="font-mono text-slate-300">/mods/</span> ·{' '}
            {activePerfCount} optimizadores activos · Ahorro estimado de RAM:{' '}
            <span className="font-mono tabular-nums text-emerald-400">{netRamSaved} MB</span>
          </p>
        </div>

        <button
          onClick={() => setShowCustomForm((v) => !v)}
          className="px-4 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-md flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Subir Mod / Plugin (.jar)
        </button>
      </div>

      {/* Custom .jar Upload Drawer */}
      {showCustomForm && (
        <form
          onSubmit={handleCustomSubmit}
          className="bg-[#111827] border border-slate-700/80 rounded-lg p-5 grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
        >
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Nombre del Mod o Plugin</label>
            <input
              type="text"
              required
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Ej. Mekanism"
              className="w-full bg-[#0B0F17] border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Archivo .jar (o seleccionar local)</label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={customFileName}
                onChange={(e) => setCustomFileName(e.target.value)}
                placeholder="Mekanism-1.16.5-10.1.2.jar"
                className="flex-1 bg-[#0B0F17] border border-slate-800 rounded px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
              />
              <label className="px-2.5 py-2 bg-[#0B0F17] border border-slate-800 rounded text-slate-300 hover:text-white cursor-pointer flex items-center">
                <Upload className="w-3.5 h-3.5" />
                <input type="file" accept=".jar" onChange={handleFilePicker} className="hidden" />
              </label>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Tipo de Módulo</label>
            <select
              value={customType}
              onChange={(e) => setCustomType(e.target.value as 'mod' | 'performance_plugin')}
              className="w-full bg-[#0B0F17] border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
            >
              <option value="mod">Mod de Contenido Forge 1.16.5</option>
              <option value="performance_plugin">Plugin / Mod de Rendimiento</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer whitespace-nowrap"
            >
              Instalar en /mods/
            </button>
            <button
              type="button"
              onClick={() => setShowCustomForm(false)}
              className="px-3 py-2 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-[#111827] border border-slate-800 rounded-md">
          {[
            {id: 'all', label: 'Todos'},
            {id: 'performance_plugin', label: 'Plugins de Rendimiento'},
            {id: 'mod', label: 'Mods Forge 1.16.5'},
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id as typeof filterType)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filterType === tab.id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar mod, plugin o archivo .jar..."
            className="w-full bg-[#111827] border border-slate-800 rounded-md pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* High-density Table */}
      <div className="bg-[#111827] border border-slate-800/90 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400 font-medium">
                <th className="py-3 px-5">Módulo y Archivo</th>
                <th className="py-3 px-4">Categoría</th>
                <th className="py-3 px-4 text-right">Impacto TPS</th>
                <th className="py-3 px-4 text-right">Impacto RAM</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-5 text-right">Gestión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-xs">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    No se encontraron mods o plugins con ese criterio.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-5 max-w-md">
                      <div className="font-medium text-slate-100">
                        {item.name}{' '}
                        <span className="text-slate-400 font-normal font-mono">v{item.version}</span>
                      </div>
                      <div className="text-slate-400 mt-0.5 line-clamp-1">{item.description}</div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {item.fileName} · {item.author} · {item.sizeKb} KB
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                      {item.type === 'performance_plugin' ? 'Optimización' : 'Mod'} · {item.category}
                    </td>
                    <td
                      className={`py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap ${
                        item.impactTps.startsWith('+') || item.impactTps.includes('Estabiliza')
                          ? 'text-emerald-400'
                          : item.impactTps.startsWith('-')
                            ? 'text-amber-400'
                            : 'text-slate-400'
                      }`}
                    >
                      {item.impactTps}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums whitespace-nowrap text-slate-300">
                      {item.ramImpactMb < 0 ? `${item.ramImpactMb} MB` : `+${item.ramImpactMb} MB`}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {!item.installed ? (
                        <span className="text-slate-500">No instalado</span>
                      ) : item.enabled ? (
                        <span className="text-emerald-400 font-medium">Activo</span>
                      ) : (
                        <span className="text-amber-400">Desactivado</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      {!item.installed ? (
                        <button
                          onClick={() => void handleInstall(item.id)}
                          disabled={busyId === item.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Instalar
                        </button>
                      ) : (
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => void handleToggle(item.id)}
                            disabled={busyId === item.id}
                            className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors cursor-pointer ${
                              item.enabled
                                ? 'border-slate-700 text-slate-200 hover:bg-slate-800'
                                : 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10'
                            }`}
                          >
                            {item.enabled ? 'Desactivar' : 'Activar'}
                          </button>
                          <button
                            onClick={() => void onDeleteMod(item.id)}
                            title="Desinstalar archivo .jar"
                            className="p-1.5 rounded border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/40 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
