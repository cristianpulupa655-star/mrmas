import React, {useState} from 'react';
import {Download, HardDrive, RotateCcw, Trash2} from 'lucide-react';
import type {BackupEntry, BackupSchedule} from '../types/server';

interface BackupsViewProps {
  backups: BackupEntry[];
  schedule: BackupSchedule;
  onCreateBackup: () => Promise<void>;
  onUpdateSchedule: (next: Partial<BackupSchedule>) => Promise<void>;
  onRestoreBackup: (id: string) => Promise<void>;
  onDeleteBackup: (id: string) => Promise<void>;
}

export const BackupsView: React.FC<BackupsViewProps> = ({
  backups,
  schedule,
  onCreateBackup,
  onUpdateSchedule,
  onRestoreBackup,
  onDeleteBackup,
}) => {
  const [creating, setCreating] = useState(false);
  const [restoredId, setRestoredId] = useState<string | null>(null);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await onCreateBackup();
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (id: string) => {
    await onRestoreBackup(id);
    setRestoredId(id);
    setTimeout(() => setRestoredId(null), 3000);
  };

  const totalSizeMb = backups.reduce((s, b) => s + b.sizeMb, 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Manual Backup CTA */}
      <div className="bg-[#111827] border border-slate-800/90 rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            Copias de Seguridad Automáticas e Integridad
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {backups.length} snapshots verificados · Espacio ocupado:{' '}
            <span className="font-mono tabular-nums text-slate-200">{(totalSizeMb / 1024).toFixed(2)} GB</span> ·
            Próxima automática:{' '}
            <span className="font-mono tabular-nums text-slate-200">
              {new Date(schedule.nextBackupAt).toLocaleTimeString('es-ES')}
            </span>
          </p>
        </div>

        <button
          onClick={() => void handleCreate()}
          disabled={creating}
          className="px-4 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-md flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <HardDrive className="w-4 h-4" />
          {creating ? 'Generando snapshot...' : 'Crear Copia Ahora'}
        </button>
      </div>

      {/* Automated Schedule Policy */}
      <div className="bg-[#111827] border border-slate-800/90 rounded-lg p-5 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Programación Automática</label>
          <button
            type="button"
            onClick={() => void onUpdateSchedule({enabled: !schedule.enabled})}
            className={`w-full px-3 py-2 text-xs font-medium rounded border text-left transition-colors cursor-pointer ${
              schedule.enabled
                ? 'bg-emerald-600/20 border-emerald-500/60 text-emerald-300'
                : 'bg-[#0B0F17] border-slate-800 text-slate-400'
            }`}
          >
            {schedule.enabled ? 'Programador Activo' : 'Programador Pausado'}
          </button>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Frecuencia de Respaldo</label>
          <select
            value={schedule.intervalMinutes}
            onChange={(e) => void onUpdateSchedule({intervalMinutes: Number(e.target.value)})}
            className="w-full bg-[#0B0F17] border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
          >
            <option value={30}>Cada 30 minutos</option>
            <option value={60}>Cada 1 hora</option>
            <option value={360}>Cada 6 horas</option>
            <option value={720}>Cada 12 horas</option>
            <option value={1440}>Cada 24 horas</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Retención Máxima (Rotación)</label>
          <select
            value={schedule.maxRetention}
            onChange={(e) => void onUpdateSchedule({maxRetention: Number(e.target.value)})}
            className="w-full bg-[#0B0F17] border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
          >
            <option value={5}>Conservar últimos 5</option>
            <option value={12}>Conservar últimos 12</option>
            <option value={24}>Conservar últimos 24</option>
            <option value={48}>Conservar últimos 48</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Respaldo Previo a Mods</label>
          <button
            type="button"
            onClick={() => void onUpdateSchedule({backupBeforeModInstall: !schedule.backupBeforeModInstall})}
            className={`w-full px-3 py-2 text-xs font-medium rounded border text-left transition-colors cursor-pointer ${
              schedule.backupBeforeModInstall
                ? 'bg-emerald-600/20 border-emerald-500/60 text-emerald-300'
                : 'bg-[#0B0F17] border-slate-800 text-slate-400'
            }`}
          >
            {schedule.backupBeforeModInstall ? 'Sí, antes de instalar mods' : 'Solo programado'}
          </button>
        </div>
      </div>

      {/* Backups Table */}
      <div className="bg-[#111827] border border-slate-800/90 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400 font-medium">
                <th className="py-3 px-5">Archivo Snapshot</th>
                <th className="py-3 px-4">Origen</th>
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4 text-right">Tamaño</th>
                <th className="py-3 px-4">SHA-256</th>
                <th className="py-3 px-5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-xs">
              {backups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-400">
                    No existen copias de seguridad almacenadas. Crea la primera ahora.
                  </td>
                </tr>
              ) : (
                backups.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-5 font-mono text-slate-100">{b.name}</td>
                    <td className="py-3.5 px-4 text-slate-300">{b.trigger}</td>
                    <td className="py-3.5 px-4 font-mono tabular-nums text-slate-400">
                      {new Date(b.createdAt).toLocaleString('es-ES')}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-200">
                      {b.sizeMb.toFixed(1)} MB
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                      {b.sha256.slice(0, 12)}... · <span className="text-emerald-400">{b.status}</span>
                    </td>
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => void handleRestore(b.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-slate-700 hover:border-emerald-500/60 text-slate-200 hover:text-emerald-300 rounded transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          {restoredId === b.id ? 'Restaurado' : 'Restaurar'}
                        </button>
                        <a
                          href={`/api/backups/${b.id}/download`}
                          title="Descargar snapshot"
                          className="p-1.5 border border-slate-800 text-slate-400 hover:text-slate-100 rounded transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <button
                          onClick={() => void onDeleteBackup(b.id)}
                          title="Eliminar copia"
                          className="p-1.5 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/40 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
