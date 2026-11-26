import React, {useRef, useState} from 'react';
import {Check, Copy, Navigation, Send, Shield, Terminal, UserMinus} from 'lucide-react';
import type {LoadProfile, ServerStateSnapshot} from '../types/server';
import {TimeSeriesChart} from './TelemetryCharts';

interface OverviewViewProps {
  state: ServerStateSnapshot;
  onChangeLoadProfile: (profile: LoadProfile) => Promise<void>;
  onSendCommand: (cmd: string) => Promise<void>;
  onPlayerAction: (playerId: string, action: 'kick' | 'toggle_op' | 'tp_spawn') => Promise<void>;
}

const LOAD_PROFILES: {id: LoadProfile; label: string}[] = [
  {id: 'normal', label: 'Carga Normal'},
  {id: 'high_players', label: '60+ Jugadores'},
  {id: 'chunk_gen', label: 'Generación Chunks'},
  {id: 'anomaly_spike', label: 'Simular Anomalía'},
];

export const OverviewView: React.FC<OverviewViewProps> = ({
  state,
  onChangeLoadProfile,
  onSendCommand,
  onPlayerAction,
}) => {
  const [commandInput, setCommandInput] = useState('');
  const [sending, setSending] = useState(false);
  const [copiedIp, setCopiedIp] = useState(false);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  const {current, history, players, config, console: logs} = state;
  const serverAddress = `${config.serverIp}:${config.serverPort}`;

  const handleCopyIp = () => {
    void navigator.clipboard.writeText(serverAddress);
    setCopiedIp(true);
    setTimeout(() => setCopiedIp(false), 2000);
  };
  const ramPct = current.ramAllocatedMb > 0 ? (current.ramUsedMb / current.ramAllocatedMb) * 100 : 0;

  const tpsHealthLabel =
    state.status === 'stopped'
      ? 'Detenido'
      : current.tps >= 18.5
        ? 'Óptimo'
        : current.tps >= 16.5
          ? 'Moderado'
          : 'Crítico';

  const tpsTextColor =
    state.status === 'stopped'
      ? 'text-slate-400'
      : current.tps >= 18.5
        ? 'text-emerald-400'
        : current.tps >= 16.5
          ? 'text-amber-400'
          : 'text-rose-400';

  const handleConsoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim() || sending) return;
    setSending(true);
    try {
      await onSendCommand(commandInput.trim());
      setCommandInput('');
      setTimeout(() => consoleEndRef.current?.scrollIntoView({behavior: 'smooth'}), 60);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Top KPI Strip (4 equal columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-[#111827] border border-slate-800/90 rounded-lg p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Rendimiento de Ticks (TPS)</span>
            <span className={`font-medium ${tpsTextColor}`}>{tpsHealthLabel}</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono tabular-nums text-slate-100">
              {current.tps.toFixed(2)}
            </span>
            <span className="text-xs font-mono text-slate-500">/ 20.00 TPS</span>
          </div>
          <p className="mt-2 text-xs text-slate-400 font-mono tabular-nums">
            MSPT: {current.mspt.toFixed(1)} ms · Objetivo &lt; 50 ms
          </p>
        </div>

        <div className="bg-[#111827] border border-slate-800/90 rounded-lg p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Memoria JVM Heap</span>
            <span className="font-mono tabular-nums text-slate-300">{ramPct.toFixed(1)}%</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono tabular-nums text-slate-100">
              {(current.ramUsedMb / 1024).toFixed(2)} GB
            </span>
            <span className="text-xs font-mono text-slate-500">/ {config.ramMaxGb} GB</span>
          </div>
          <div className="mt-2.5 h-1.5 w-full bg-slate-800 rounded-sm overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                ramPct > 88 ? 'bg-rose-500' : ramPct > 75 ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{width: `${Math.min(100, ramPct)}%`}}
            />
          </div>
        </div>

        <div className="bg-[#111827] border border-slate-800/90 rounded-lg p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Jugadores y Conexión</span>
            <button
              type="button"
              onClick={handleCopyIp}
              title="Copiar dirección IP del servidor"
              className="inline-flex items-center gap-1 font-mono tabular-nums text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
            >
              <span>{serverAddress}</span>
              {copiedIp ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono tabular-nums text-slate-100">
              {current.playersOnline}
            </span>
            <span className="text-xs font-mono text-slate-500">/ {config.maxPlayers} máx.</span>
          </div>
          <p className="mt-2 text-xs text-slate-400 font-mono tabular-nums">
            Red: {current.networkInMbps}↓ / {current.networkOutMbps}↑ Mbps
          </p>
        </div>

        <div className="bg-[#111827] border border-slate-800/90 rounded-lg p-5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>CPU y Mundo Forge 1.16.5</span>
            <span className="font-mono tabular-nums text-slate-300">{current.cpuPercent}% CPU</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono tabular-nums text-slate-100">
              {current.chunksLoaded.toLocaleString('es-ES')}
            </span>
            <span className="text-xs font-mono text-slate-500">chunks</span>
          </div>
          <p className="mt-2 text-xs text-slate-400 font-mono tabular-nums">
            Entidades: {current.entitiesCount.toLocaleString('es-ES')} · Disco I/O: {current.diskIoMbps} MB/s
          </p>
        </div>
      </div>

      {/* Load Stress Test Bar */}
      <div className="bg-[#111827] border border-slate-800/90 rounded-lg px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Simulador de Carga y Estabilidad Operativa</h2>
          <p className="text-xs text-slate-400">
            Evalúa el comportamiento del entorno Forge 1.16.5 y activa alertas push ante caídas de TPS o picos JVM.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#0B0F17] border border-slate-800 rounded-md">
          {LOAD_PROFILES.map((item) => {
            const active = state.loadProfile === item.id;
            return (
              <button
                key={item.id}
                onClick={() => void onChangeLoadProfile(item.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? item.id === 'anomaly_spike'
                      ? 'bg-rose-600 text-white'
                      : 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Telemetry Graphs (2-column split) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TimeSeriesChart
          title="Estabilidad de Ticks (TPS y MSPT)"
          subtitle="Muestreo continuo cada 2s del hilo principal de Forge 1.16.5"
          data={history}
          thresholdValue={state.alertRules.tpsMin}
          thresholdLabel={`Umbral mínimo ${state.alertRules.tpsMin} TPS`}
          series={[
            {key: 'tps', label: 'TPS', unit: '', color: '#10b981', maxValue: 20},
            {key: 'mspt', label: 'MSPT', unit: 'ms', color: '#f59e0b'},
          ]}
        />
        <TimeSeriesChart
          title="Consumo de CPU y Memoria JVM Heap"
          subtitle={`Asignación actual: -Xms${config.ramMinGb}G -Xmx${config.ramMaxGb}G (${config.gcProfile.toUpperCase()})`}
          data={history}
          thresholdValue={state.alertRules.cpuMaxPercent}
          thresholdLabel={`Alerta CPU ${state.alertRules.cpuMaxPercent}%`}
          series={[
            {key: 'cpuPercent', label: 'CPU', unit: '%', color: '#38bdf8', maxValue: 100},
            {key: 'networkOutMbps', label: 'Red Salida', unit: ' Mbps', color: '#a78bfa'},
          ]}
        />
      </div>

      {/* Live Console + Connected Players Split */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Console */}
        <div className="xl:col-span-7 bg-[#111827] border border-slate-800/90 rounded-lg flex flex-col overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-800/90 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-100">Consola RCON y Logs en Vivo</h3>
            </div>
            <div className="flex items-center gap-2">
              {['forge tps', 'save-all', 'clearlag', 'list'].map((quick) => (
                <button
                  key={quick}
                  onClick={() => void onSendCommand(quick)}
                  className="px-2.5 py-1 text-[11px] font-mono text-slate-300 bg-[#0B0F17] border border-slate-800 rounded hover:border-slate-700 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  /{quick}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#080C12] p-4 h-72 overflow-y-auto font-mono text-xs space-y-1.5">
            {logs.map((line) => (
              <div key={line.id} className="leading-relaxed break-words">
                <span className="text-slate-500 tabular-nums">[{line.time}]</span>{' '}
                <span
                  className={
                    line.level === 'ERROR'
                      ? 'text-rose-400'
                      : line.level === 'WARN'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                  }
                >
                  [{line.thread}/{line.level}]
                </span>
                <span className="text-slate-300">: {line.message}</span>
              </div>
            ))}
            <div ref={consoleEndRef} />
          </div>

          <form onSubmit={handleConsoleSubmit} className="p-3 border-t border-slate-800/90 flex items-center gap-2 bg-[#0E141F]">
            <input
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              placeholder="Escribe un comando (ej. forge tps, say Hola, kick usuario)..."
              className="flex-1 bg-[#080C12] border border-slate-800 rounded px-3 py-2 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={sending || !commandInput.trim()}
              className="px-4 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              Ejecutar
            </button>
          </form>
        </div>

        {/* Active Players Table */}
        <div className="xl:col-span-5 bg-[#111827] border border-slate-800/90 rounded-lg flex flex-col overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-800/90 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Jugadores Conectados</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {players.length} sesiones activas · Latencia media{' '}
                <span className="font-mono tabular-nums">
                  {players.length ? Math.round(players.reduce((s, p) => s + p.pingMs, 0) / players.length) : 0} ms
                </span>
              </p>
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            {players.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No hay jugadores conectados en este momento.
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/80 text-[11px] text-slate-400 font-medium">
                    <th className="py-2.5 px-4">Jugador</th>
                    <th className="py-2.5 px-3">Dimensión</th>
                    <th className="py-2.5 px-3 text-right">Ping</th>
                    <th className="py-2.5 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-xs">
                  {players.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-100">
                          {p.username}
                          {p.isOp && <span className="text-amber-400 font-normal"> · OP</span>}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono tabular-nums">{p.coords}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">{p.dimension}</td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-400">
                        {p.pingMs} ms
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => void onPlayerAction(p.id, 'toggle_op')}
                            title={p.isOp ? 'Revocar OP' : 'Hacer Operador'}
                            className={`p-1.5 rounded border transition-colors cursor-pointer ${
                              p.isOp
                                ? 'border-amber-500/40 text-amber-400 bg-amber-500/10'
                                : 'border-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <Shield className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => void onPlayerAction(p.id, 'tp_spawn')}
                            title="Teletransportar al Spawn"
                            className="p-1.5 rounded border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                          >
                            <Navigation className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => void onPlayerAction(p.id, 'kick')}
                            title="Expulsar jugador"
                            className="p-1.5 rounded border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/40 transition-colors cursor-pointer"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
