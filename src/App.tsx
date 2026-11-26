import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Activity,
  Bell,
  Boxes,
  Container,
  FolderOpen,
  HardDrive,
  Menu,
  Power,
  RotateCw,
  Sliders,
  X,
} from 'lucide-react';
import {AlertsMonitoringView} from './components/AlertsMonitoringView';
import {BackupsView} from './components/BackupsView';
import {ConfigPanelView} from './components/ConfigPanelView';
import {DeployDockerView} from './components/DeployDockerView';
import {FileManagerView} from './components/FileManagerView';
import {ModsPluginsView} from './components/ModsPluginsView';
import {OverviewView} from './components/OverviewView';
import type {
  AlertRules,
  AnomalyAlert,
  BackupSchedule,
  LoadProfile,
  ServerConfig,
  ServerStateSnapshot,
} from './types/server';

type NavSection =
  | 'overview'
  | 'mods'
  | 'files'
  | 'config'
  | 'backups'
  | 'deploy'
  | 'monitoring';

const NAV_ITEMS: {id: NavSection; label: string; icon: React.ComponentType<{className?: string}>}[] = [
  {id: 'overview', label: 'Resumen y Telemetría', icon: Activity},
  {id: 'mods', label: 'Mods y Rendimiento', icon: Boxes},
  {id: 'files', label: 'Gestor de Archivos', icon: FolderOpen},
  {id: 'config', label: 'Configuración Visual', icon: Sliders},
  {id: 'backups', label: 'Copias de Seguridad', icon: HardDrive},
  {id: 'deploy', label: 'Despliegue y Docker', icon: Container},
  {id: 'monitoring', label: 'Alertas y Reportes', icon: Bell},
];

export default function App() {
  const [activeNav, setActiveNav] = useState<NavSection>('overview');
  const [state, setState] = useState<ServerStateSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [pushBanner, setPushBanner] = useState<AnomalyAlert | null>(null);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported',
  );

  const seenAlertIdsRef = useRef<Set<string>>(new Set());
  const initializedAlertsRef = useRef(false);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/state');
      if (!res.ok) return;
      const data = (await res.json()) as ServerStateSnapshot;
      setState(data);
      setLoading(false);

      // Trigger instant Push Notification for any brand-new unacknowledged anomaly
      if (!initializedAlertsRef.current) {
        data.alerts.forEach((a) => seenAlertIdsRef.current.add(a.id));
        initializedAlertsRef.current = true;
      } else {
        for (const alert of data.alerts) {
          if (!seenAlertIdsRef.current.has(alert.id) && !alert.acknowledged) {
            seenAlertIdsRef.current.add(alert.id);
            setPushBanner(alert);
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification(`ForgeOps 1.16.5 — ${alert.title}`, {
                  body: `${alert.message} (${alert.value})`,
                });
              } catch {
                // Ignore browser notification restrictions inside sandboxed iframes
              }
            }
          }
        }
      }
    } catch {
      // Transient fetch error during restart
    }
  }, []);

  useEffect(() => {
    void fetchState();
    const timer = setInterval(() => {
      void fetchState();
    }, 2000);
    return () => clearInterval(timer);
  }, [fetchState]);

  const handleServerPower = async (action: 'start' | 'stop' | 'restart') => {
    await fetch('/api/server/power', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({action}),
    });
    await fetchState();
  };

  const handleChangeLoadProfile = async (profile: LoadProfile) => {
    await fetch('/api/server/load-profile', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({profile}),
    });
    await fetchState();
  };

  const handleSendCommand = async (command: string) => {
    await fetch('/api/console/command', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({command}),
    });
    await fetchState();
  };

  const handlePlayerAction = async (playerId: string, action: 'kick' | 'toggle_op' | 'tp_spawn') => {
    await fetch('/api/players/action', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({playerId, action}),
    });
    await fetchState();
  };

  const handleToggleMod = async (id: string) => {
    await fetch('/api/mods/toggle', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({id}),
    });
    await fetchState();
  };

  const handleInstallMod = async (payload: {
    id?: string;
    customName?: string;
    customFileName?: string;
    customType?: 'mod' | 'performance_plugin';
  }) => {
    await fetch('/api/mods/install', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload),
    });
    await fetchState();
  };

  const handleDeleteMod = async (id: string) => {
    await fetch(`/api/mods/${encodeURIComponent(id)}`, {method: 'DELETE'});
    await fetchState();
  };

  const handleSaveConfig = async (updated: Partial<ServerConfig>) => {
    await fetch('/api/config', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(updated),
    });
    await fetchState();
  };

  const handleCreateBackup = async () => {
    await fetch('/api/backups/create', {method: 'POST'});
    await fetchState();
  };

  const handleUpdateBackupSchedule = async (next: Partial<BackupSchedule>) => {
    await fetch('/api/backups/schedule', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(next),
    });
    await fetchState();
  };

  const handleRestoreBackup = async (id: string) => {
    await fetch('/api/backups/restore', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({id}),
    });
    await fetchState();
  };

  const handleDeleteBackup = async (id: string) => {
    await fetch(`/api/backups/${encodeURIComponent(id)}`, {method: 'DELETE'});
    await fetchState();
  };

  const handleRequestPushPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPushPermission('unsupported');
      return;
    }
    const perm = await Notification.requestPermission();
    setPushPermission(perm);
    if (perm === 'granted') {
      await fetch('/api/alerts/rules', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({browserPushEnabled: true}),
      });
      await fetchState();
    }
  };

  const handleUpdateAlertRules = async (next: Partial<AlertRules>) => {
    await fetch('/api/alerts/rules', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(next),
    });
    await fetchState();
  };

  const handleAcknowledgeAll = async () => {
    await fetch('/api/alerts/acknowledge', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({}),
    });
    setPushBanner(null);
    await fetchState();
  };

  const handleTriggerTestAnomaly = async () => {
    await fetch('/api/alerts/test-anomaly', {method: 'POST'});
    await fetchState();
  };

  const handleTestWebhook = async (url: string) => {
    const res = await fetch('/api/alerts/test-webhook', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({url}),
    });
    const data = (await res.json()) as {ok?: boolean; error?: string};
    return {ok: Boolean(data.ok), error: data.error};
  };

  const formatUptime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  };

  const activeItem = NAV_ITEMS.find((n) => n.id === activeNav) ?? NAV_ITEMS[0];
  const unackAlertsCount = state ? state.alerts.filter((a) => !a.acknowledged).length : 0;

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex">
      {/* Sidebar Navigation (248px desktop) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[248px] bg-[#0E131D] border-r border-slate-800/90 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-5 py-5 border-b border-slate-800/90 flex items-center justify-between">
          <div>
            <div className="text-base font-bold tracking-tight text-white font-display">ForgeOps</div>
            <div className="text-xs text-slate-400 mt-0.5 font-mono">
              Java Forge {state?.minecraftVersion ?? '1.16.5'}
            </div>
          </div>
          <button
            onClick={() => setMobileNavOpen(false)}
            className="lg:hidden p-1 text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveNav(item.id);
                  setMobileNavOpen(false);
                }}
                className={`w-full px-3 py-2.5 rounded-md text-xs font-medium flex items-center justify-between transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-slate-800/90 text-white'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/40'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <span className="truncate">{item.label}</span>
                </span>
                {item.id === 'monitoring' && unackAlertsCount > 0 && (
                  <span className="font-mono tabular-nums text-[11px] text-rose-400 font-semibold">
                    {unackAlertsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800/90 text-xs text-slate-400 space-y-1 font-mono tabular-nums">
          <div className="flex justify-between">
            <span>Estado</span>
            <span
              className={
                state?.status === 'running'
                  ? 'text-emerald-400'
                  : state?.status === 'stopped'
                    ? 'text-slate-400'
                    : 'text-amber-400'
              }
            >
              {state?.status === 'running'
                ? 'En línea'
                : state?.status === 'stopped'
                  ? 'Detenido'
                  : 'Reiniciando'}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span>Dirección IP</span>
            <span className="text-emerald-300 truncate">
              {state?.config.serverIp ?? '148.251.72.184'}:{state?.config.serverPort ?? 25565}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Forge</span>
            <span className="text-slate-200">{state?.forgeVersion ?? '36.2.42'}</span>
          </div>
          <div className="flex justify-between">
            <span>Actividad</span>
            <span className="text-slate-200">{formatUptime(state?.uptimeSeconds ?? 0)}</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract */}
        <header className="h-16 px-4 sm:px-6 border-b border-slate-800/90 bg-[#0E131D] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 -ml-1 text-slate-400 hover:text-white cursor-pointer"
              aria-label="Abrir menú"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-xs sm:text-sm text-slate-400 truncate">
              <span>Infraestructura</span>
              <span className="mx-2 text-slate-600">/</span>
              <span>Forge 1.16.5</span>
              <span className="mx-2 text-slate-600">/</span>
              <span className="text-slate-100 font-medium">{activeItem.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => void handleServerPower('restart')}
              className="px-3.5 py-2 text-xs font-medium bg-[#111827] border border-slate-700 hover:border-slate-500 text-slate-200 rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
              Reiniciar
            </button>
            {state?.status === 'stopped' ? (
              <button
                onClick={() => void handleServerPower('start')}
                className="px-4 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Power className="w-3.5 h-3.5" />
                Iniciar Servidor
              </button>
            ) : (
              <button
                onClick={() => void handleServerPower('stop')}
                className="px-4 py-2 text-xs font-medium bg-rose-600 hover:bg-rose-500 text-white rounded-md flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Power className="w-3.5 h-3.5" />
                Detener
              </button>
            )}
          </div>
        </header>

        {/* Instant Push Anomaly Notification Toast */}
        {pushBanner && (
          <div className="mx-4 sm:mx-6 mt-4 bg-[#1B1318] border border-rose-500/50 rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs">
              <span className="font-semibold text-rose-400">Alerta Push Instantánea · {pushBanner.title}: </span>
              <span className="text-slate-200">{pushBanner.message}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => {
                  setActiveNav('monitoring');
                  setPushBanner(null);
                }}
                className="text-xs font-medium text-rose-300 hover:text-white cursor-pointer"
              >
                Ver Diagnóstico
              </button>
              <button
                onClick={() => setPushBanner(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
                aria-label="Cerrar notificación"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Viewport Content */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {loading || !state ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((idx) => (
                <div key={idx} className="h-28 bg-[#111827] border border-slate-800/80 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {activeNav === 'overview' && (
                <OverviewView
                  state={state}
                  onChangeLoadProfile={handleChangeLoadProfile}
                  onSendCommand={handleSendCommand}
                  onPlayerAction={handlePlayerAction}
                />
              )}
              {activeNav === 'mods' && (
                <ModsPluginsView
                  mods={state.mods}
                  onToggleMod={handleToggleMod}
                  onInstallMod={handleInstallMod}
                  onDeleteMod={handleDeleteMod}
                />
              )}
              {activeNav === 'files' && <FileManagerView onConfigSynced={fetchState} />}
              {activeNav === 'config' && (
                <ConfigPanelView config={state.config} onSaveConfig={handleSaveConfig} />
              )}
              {activeNav === 'backups' && (
                <BackupsView
                  backups={state.backups}
                  schedule={state.backupSchedule}
                  onCreateBackup={handleCreateBackup}
                  onUpdateSchedule={handleUpdateBackupSchedule}
                  onRestoreBackup={handleRestoreBackup}
                  onDeleteBackup={handleDeleteBackup}
                />
              )}
              {activeNav === 'deploy' && (
                <DeployDockerView
                  config={state.config}
                  modsCount={state.mods.filter((m) => m.installed && m.enabled).length}
                />
              )}
              {activeNav === 'monitoring' && (
                <AlertsMonitoringView
                  alerts={state.alerts}
                  rules={state.alertRules}
                  pushPermission={pushPermission}
                  onRequestPushPermission={handleRequestPushPermission}
                  onUpdateRules={handleUpdateAlertRules}
                  onAcknowledgeAll={handleAcknowledgeAll}
                  onTriggerTestAnomaly={handleTriggerTestAnomaly}
                  onTestWebhook={handleTestWebhook}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
