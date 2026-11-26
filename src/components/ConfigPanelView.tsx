import React, {useEffect, useState} from 'react';
import {Check, Save} from 'lucide-react';
import type {ServerConfig} from '../types/server';

interface ConfigPanelViewProps {
  config: ServerConfig;
  onSaveConfig: (updated: Partial<ServerConfig>) => Promise<void>;
}

export const ConfigPanelView: React.FC<ConfigPanelViewProps> = ({config, onSaveConfig}) => {
  const [draft, setDraft] = useState<ServerConfig>(config);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    setDraft(config);
  }, [config]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSaveConfig(draft);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const ToggleRow: React.FC<{
    label: string;
    description: string;
    checked: boolean;
    onChange: (val: boolean) => void;
  }> = ({label, description, checked, onChange}) => (
    <div className="py-3.5 flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-medium text-slate-100">{label}</div>
        <div className="text-xs text-slate-400 mt-0.5">{description}</div>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`px-3 py-1.5 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          checked
            ? 'bg-emerald-600/20 border-emerald-500/60 text-emerald-300'
            : 'bg-[#0B0F17] border-slate-800 text-slate-400'
        }`}
      >
        {checked ? 'Activado' : 'Desactivado'}
      </button>
    </div>
  );

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-6">
      <div className="bg-[#111827] border border-slate-800/90 rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            Configuración Visual sin Comandos
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Sincronización directa con <span className="font-mono text-slate-300">server.properties</span>,{' '}
            <span className="font-mono text-slate-300">jvm_args.txt</span> y{' '}
            <span className="font-mono text-slate-300">config/forge-common.toml</span>.
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-md flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {savedNotice ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {savedNotice ? 'Sincronizado en disco' : saving ? 'Guardando...' : 'Aplicar y Sincronizar'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mundo y Reglas */}
        <div className="bg-[#111827] border border-slate-800/90 rounded-lg p-5 flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-slate-100 pb-3 border-b border-slate-800">
            Mundo, Jugabilidad y Red
          </h3>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Mensaje del Servidor (MOTD)</label>
            <input
              type="text"
              value={draft.motd}
              onChange={(e) => setDraft({...draft, motd: e.target.value})}
              className="w-full bg-[#0B0F17] border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Modo de Juego</label>
              <select
                value={draft.gamemode}
                onChange={(e) => setDraft({...draft, gamemode: e.target.value as ServerConfig['gamemode']})}
                className="w-full bg-[#0B0F17] border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="survival">Supervivencia</option>
                <option value="creative">Creativo</option>
                <option value="adventure">Aventura</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Dificultad</label>
              <select
                value={draft.difficulty}
                onChange={(e) => setDraft({...draft, difficulty: e.target.value as ServerConfig['difficulty']})}
                className="w-full bg-[#0B0F17] border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                <option value="peaceful">Pacífico</option>
                <option value="easy">Fácil</option>
                <option value="normal">Normal</option>
                <option value="hard">Difícil</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex justify-between text-xs text-slate-400 mb-1.5">
                <span>Máximo de Jugadores</span>
                <span className="font-mono tabular-nums text-slate-200">{draft.maxPlayers}</span>
              </label>
              <input
                type="range"
                min={10}
                max={200}
                step={5}
                value={draft.maxPlayers}
                onChange={(e) => setDraft({...draft, maxPlayers: Number(e.target.value)})}
                className="w-full accent-emerald-500"
              />
            </div>
            <div>
              <label className="flex justify-between text-xs text-slate-400 mb-1.5">
                <span>Distancia de Visión (Chunks)</span>
                <span className="font-mono tabular-nums text-slate-200">{draft.viewDistance}</span>
              </label>
              <input
                type="range"
                min={4}
                max={16}
                step={1}
                value={draft.viewDistance}
                onChange={(e) => setDraft({...draft, viewDistance: Number(e.target.value)})}
                className="w-full accent-emerald-500"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-800/80 border-t border-slate-800/80 mt-1">
            <ToggleRow
              label="Combate entre Jugadores (PvP)"
              description="Permite daño directo entre usuarios conectados."
              checked={draft.pvp}
              onChange={(v) => setDraft({...draft, pvp: v})}
            />
            <ToggleRow
              label="Lista Blanca (Whitelist)"
              description="Restringe el acceso únicamente a UUIDs autorizados."
              checked={draft.whiteList}
              onChange={(v) => setDraft({...draft, whiteList: v})}
            />
            <ToggleRow
              label="Autenticación Mojang (Online Mode)"
              description="Verifica cuentas oficiales de Minecraft Java Edition."
              checked={draft.onlineMode}
              onChange={(v) => setDraft({...draft, onlineMode: v})}
            />
          </div>
        </div>

        {/* Motor Forge 1.16.5 y JVM */}
        <div className="bg-[#111827] border border-slate-800/90 rounded-lg p-5 flex flex-col gap-4">
          <h3 className="text-sm font-semibold text-slate-100 pb-3 border-b border-slate-800">
            Motor Java Forge 1.16.5 y Memoria JVM
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex justify-between text-xs text-slate-400 mb-1.5">
                <span>RAM Mínima (-Xms)</span>
                <span className="font-mono tabular-nums text-slate-200">{draft.ramMinGb} GB</span>
              </label>
              <input
                type="range"
                min={2}
                max={draft.ramMaxGb}
                step={1}
                value={draft.ramMinGb}
                onChange={(e) => setDraft({...draft, ramMinGb: Number(e.target.value)})}
                className="w-full accent-emerald-500"
              />
            </div>
            <div>
              <label className="flex justify-between text-xs text-slate-400 mb-1.5">
                <span>RAM Máxima (-Xmx)</span>
                <span className="font-mono tabular-nums text-slate-200">{draft.ramMaxGb} GB</span>
              </label>
              <input
                type="range"
                min={4}
                max={64}
                step={2}
                value={draft.ramMaxGb}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    ramMaxGb: Number(e.target.value),
                    ramMinGb: Math.min(draft.ramMinGb, Number(e.target.value)),
                  })
                }
                className="w-full accent-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">
              Recolector de Basura (Garbage Collector JVM)
            </label>
            <select
              value={draft.gcProfile}
              onChange={(e) => setDraft({...draft, gcProfile: e.target.value as ServerConfig['gcProfile']})}
              className="w-full bg-[#0B0F17] border border-slate-800 rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
            >
              <option value="aikar">Aikar&apos;s Flags (Recomendado para Mods y 40+ Jugadores)</option>
              <option value="g1gc_tuned">G1GC Baja Latencia (Pausas &lt; 120ms)</option>
              <option value="zgc">ZGC Experimental (Para 16GB+ RAM)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Dirección IP / Host (server-ip)</label>
              <input
                type="text"
                value={draft.serverIp}
                onChange={(e) => setDraft({...draft, serverIp: e.target.value})}
                placeholder="148.251.72.184 o 0.0.0.0"
                className="w-full bg-[#0B0F17] border border-slate-800 rounded px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Puerto del Servidor</label>
              <input
                type="number"
                value={draft.serverPort}
                onChange={(e) => setDraft({...draft, serverPort: Number(e.target.value)})}
                className="w-full bg-[#0B0F17] border border-slate-800 rounded px-3 py-2 text-xs font-mono tabular-nums text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Watchdog Max Tick (ms)</label>
              <input
                type="number"
                value={draft.maxTickTime}
                onChange={(e) => setDraft({...draft, maxTickTime: Number(e.target.value)})}
                className="w-full bg-[#0B0F17] border border-slate-800 rounded px-3 py-2 text-xs font-mono tabular-nums text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-800/80 border-t border-slate-800/80 mt-1">
            <ToggleRow
              label="Procesamiento Multihilo de Chunks (Forge)"
              description="Distribuye la carga de regiones en varios núcleos CPU."
              checked={draft.forgeChunkThreading}
              onChange={(v) => setDraft({...draft, forgeChunkThreading: v})}
            />
            <ToggleRow
              label="IA Asíncrona de Entidades"
              description="Reduce el bloqueo del hilo principal bajo granjas o alta población."
              checked={draft.forgeAsyncEntityAi}
              onChange={(v) => setDraft({...draft, forgeAsyncEntityAi: v})}
            />
          </div>
        </div>
      </div>
    </form>
  );
};
