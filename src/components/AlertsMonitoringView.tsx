import React, {useState} from 'react';
import {Bell, CheckCheck, Download, ExternalLink, FileSpreadsheet, Send, Zap} from 'lucide-react';
import type {AlertRules, AnomalyAlert} from '../types/server';

interface AlertsMonitoringViewProps {
  alerts: AnomalyAlert[];
  rules: AlertRules;
  pushPermission: NotificationPermission | 'unsupported';
  onRequestPushPermission: () => Promise<void>;
  onUpdateRules: (next: Partial<AlertRules>) => Promise<void>;
  onAcknowledgeAll: () => Promise<void>;
  onTriggerTestAnomaly: () => Promise<void>;
  onTestWebhook: (url: string) => Promise<{ok: boolean; error?: string}>;
}

export const AlertsMonitoringView: React.FC<AlertsMonitoringViewProps> = ({
  alerts,
  rules,
  pushPermission,
  onRequestPushPermission,
  onUpdateRules,
  onAcknowledgeAll,
  onTriggerTestAnomaly,
  onTestWebhook,
}) => {
  const [webhookDraft, setWebhookDraft] = useState(rules.webhookUrl);
  const [webhookStatus, setWebhookStatus] = useState<string | null>(null);
  const [tpsMin, setTpsMin] = useState(rules.tpsMin);
  const [msptMax, setMsptMax] = useState(rules.msptMax);
  const [ramMax, setRamMax] = useState(rules.ramMaxPercent);
  const [cpuMax, setCpuMax] = useState(rules.cpuMaxPercent);

  const handleSaveThresholds = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateRules({
      tpsMin,
      msptMax,
      ramMaxPercent: ramMax,
      cpuMaxPercent: cpuMax,
      webhookUrl: webhookDraft,
      webhookEnabled: Boolean(webhookDraft.trim()),
    });
    setWebhookStatus('Reglas de anomalía actualizadas.');
  };

  const handleWebhookPing = async () => {
    setWebhookStatus('Enviando prueba...');
    const res = await onTestWebhook(webhookDraft);
    setWebhookStatus(res.ok ? 'Webhook respondió correctamente.' : res.error || 'Error enviando webhook.');
  };

  const unackCount = alerts.filter((a) => !a.acknowledged).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Instant Push & Anomaly Test Bar */}
      <div className="bg-[#111827] border border-slate-800/90 rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            Notificaciones Push, Monitoreo Externo y Reportes
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {unackCount} anomalías sin revisar · Estado Push del Navegador:{' '}
            <span className="text-slate-200 font-medium">
              {pushPermission === 'granted'
                ? 'Habilitado'
                : pushPermission === 'denied'
                  ? 'Bloqueado por navegador'
                  : pushPermission === 'unsupported'
                    ? 'No soportado'
                    : 'Pendiente de activar'}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {pushPermission !== 'granted' && pushPermission !== 'unsupported' && (
            <button
              onClick={() => void onRequestPushPermission()}
              className="px-4 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-md flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              Activar Push Instantáneas
            </button>
          )}
          <button
            onClick={() => void onTriggerTestAnomaly()}
            className="px-4 py-2 text-xs font-medium bg-[#0B0F17] border border-amber-600/50 hover:border-amber-500 text-amber-300 rounded-md flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Zap className="w-4 h-4" />
            Probar Alerta de Anomalía
          </button>
        </div>
      </div>

      {/* Exportable Reports + External Prometheus / Grafana */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#111827] border border-slate-800/90 rounded-lg p-5 flex flex-col justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Reportes Automáticos Exportables (Forge 1.16.5)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Genera auditorías técnicas con historial de TPS, MSPT, carga JVM, plugins activos y registro de anomalías bajo carga elevada.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <a
              href="/api/reports/generate?format=csv"
              className="px-3.5 py-2.5 text-xs font-medium bg-[#0B0F17] border border-slate-800 hover:border-emerald-500/60 text-slate-200 rounded-md flex items-center justify-center gap-2 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              Exportar CSV
            </a>
            <a
              href="/api/reports/generate?format=json"
              className="px-3.5 py-2.5 text-xs font-medium bg-[#0B0F17] border border-slate-800 hover:border-emerald-500/60 text-slate-200 rounded-md flex items-center justify-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4 text-sky-400" />
              Exportar JSON
            </a>
            <a
              href="/api/reports/generate?format=markdown"
              className="px-3.5 py-2.5 text-xs font-medium bg-[#0B0F17] border border-slate-800 hover:border-emerald-500/60 text-slate-200 rounded-md flex items-center justify-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4 text-amber-400" />
              Informe Markdown
            </a>
          </div>
        </div>

        <div className="bg-[#111827] border border-slate-800/90 rounded-lg p-5 flex flex-col justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Monitoreo Externo (Prometheus / Grafana / Healthcheck)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Endpoints activos listos para scrapeo continuo desde Prometheus, Grafana o balanceadores Docker.
            </p>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between bg-[#0B0F17] border border-slate-800 rounded px-3 py-2">
              <span className="text-slate-300">GET /metrics (OpenMetrics Prometheus)</span>
              <a
                href="/metrics"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
              >
                Abrir <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="flex items-center justify-between bg-[#0B0F17] border border-slate-800 rounded px-3 py-2">
              <span className="text-slate-300">GET /api/health (Docker HEALTHCHECK)</span>
              <a
                href="/api/health"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
              >
                Abrir <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Anomaly Rules + Webhook Config */}
      <form
        onSubmit={handleSaveThresholds}
        className="bg-[#111827] border border-slate-800/90 rounded-lg p-5 flex flex-col gap-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-slate-100">
            Umbrales de Detección Proactiva y Webhooks (Discord / Slack)
          </h3>
          {webhookStatus && <span className="text-xs text-emerald-400">{webhookStatus}</span>}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">TPS Mínimo</label>
            <input
              type="number"
              step="0.5"
              min={5}
              max={19.5}
              value={tpsMin}
              onChange={(e) => setTpsMin(Number(e.target.value))}
              className="w-full bg-[#0B0F17] border border-slate-800 rounded px-3 py-2 text-xs font-mono tabular-nums text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">MSPT Máximo (ms)</label>
            <input
              type="number"
              min={20}
              max={200}
              value={msptMax}
              onChange={(e) => setMsptMax(Number(e.target.value))}
              className="w-full bg-[#0B0F17] border border-slate-800 rounded px-3 py-2 text-xs font-mono tabular-nums text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">RAM Heap Máxima (%)</label>
            <input
              type="number"
              min={50}
              max={99}
              value={ramMax}
              onChange={(e) => setRamMax(Number(e.target.value))}
              className="w-full bg-[#0B0F17] border border-slate-800 rounded px-3 py-2 text-xs font-mono tabular-nums text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">CPU Máxima (%)</label>
            <input
              type="number"
              min={50}
              max={99}
              value={cpuMax}
              onChange={(e) => setCpuMax(Number(e.target.value))}
              className="w-full bg-[#0B0F17] border border-slate-800 rounded px-3 py-2 text-xs font-mono tabular-nums text-slate-100"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[260px]">
            <label className="block text-xs text-slate-400 mb-1.5">URL de Webhook Externo (Opcional)</label>
            <input
              type="url"
              value={webhookDraft}
              onChange={(e) => setWebhookDraft(e.target.value)}
              placeholder="https://discord.com/api/webhooks/..."
              className="w-full bg-[#0B0F17] border border-slate-800 rounded px-3 py-2 text-xs font-mono text-slate-100 placeholder:text-slate-600"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleWebhookPing()}
            className="px-3.5 py-2 text-xs font-medium bg-[#0B0F17] border border-slate-700 hover:border-slate-500 text-slate-200 rounded flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            Probar Webhook
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer"
          >
            Guardar Reglas
          </button>
        </div>
      </form>

      {/* Alerts Log Table */}
      <div className="bg-[#111827] border border-slate-800/90 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-100">Historial de Anomalías del Sistema</h3>
          {unackCount > 0 && (
            <button
              onClick={() => void onAcknowledgeAll()}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Marcar todo como revisado
            </button>
          )}
        </div>

        <div className="divide-y divide-slate-800/80">
          {alerts.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No se han registrado anomalías. El entorno opera dentro de los umbrales nominales.
            </div>
          ) : (
            alerts.map((a) => (
              <div
                key={a.id}
                className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-800/25"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className={`font-semibold ${
                        a.severity === 'critical'
                          ? 'text-rose-400'
                          : a.severity === 'warning'
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                      }`}
                    >
                      {a.severity === 'critical' ? 'Crítica' : a.severity === 'warning' ? 'Advertencia' : 'Info'}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-200 font-medium">{a.title}</span>
                    <span className="text-slate-600">·</span>
                    <span className="font-mono text-slate-400">{a.metric}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{a.message}</p>
                </div>

                <div className="text-right font-mono tabular-nums text-xs shrink-0">
                  <div className="text-slate-200 font-medium">{a.value}</div>
                  <div className="text-[11px] text-slate-500">
                    {new Date(a.timestamp).toLocaleTimeString('es-ES')} · {a.acknowledged ? 'Revisada' : 'Pendiente'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
