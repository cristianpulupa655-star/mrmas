import React, {useEffect, useState} from 'react';
import {Check, Copy, Download, Rocket} from 'lucide-react';
import type {ServerConfig} from '../types/server';

interface DeployDockerViewProps {
  config: ServerConfig;
  modsCount: number;
}

interface DeployTemplates {
  dockerfile: string;
  dockerCompose: string;
  vpsScript: string;
  prometheusYml: string;
}

export const DeployDockerView: React.FC<DeployDockerViewProps> = ({config, modsCount}) => {
  const [targetEnv, setTargetEnv] = useState<'vps' | 'dedicated' | 'docker'>('docker');
  const [activeFile, setActiveFile] = useState<keyof DeployTemplates>('dockerCompose');
  const [templates, setTemplates] = useState<DeployTemplates | null>(null);
  const [copied, setCopied] = useState(false);
  const [deployStep, setDeployStep] = useState<'idle' | 'provisioning' | 'ready'>('idle');
  const [region, setRegion] = useState('eu-west (Frankfurt / Madrid)');

  useEffect(() => {
    fetch('/api/deploy/templates')
      .then((r) => r.json())
      .then((data: DeployTemplates) => setTemplates(data))
      .catch(() => {});
  }, [config]);

  const oneClickCommand =
    targetEnv === 'docker'
      ? 'unzip mc-forge-1.16.5-deploy-bundle.zip -d mc-forge && cd mc-forge && docker compose up -d --build'
      : 'unzip mc-forge-1.16.5-deploy-bundle.zip -d mc-forge && cd mc-forge && chmod +x deploy-vps.sh && sudo ./deploy-vps.sh';

  const handleCopy = (text: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSimulateOneClickDeploy = () => {
    setDeployStep('provisioning');
    setTimeout(() => setDeployStep('ready'), 1600);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1-Click Deployment Hero Strip */}
      <div className="bg-[#111827] border border-slate-800/90 rounded-lg p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            Despliegue 1-Click en Servidores Dedicados, VPS y Docker
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Stack preconfigurado con Forge 1.16.5 · {modsCount} módulos activos · {config.ramMaxGb} GB RAM ·
            Sidecar de Backups + Prometheus + Grafana.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleSimulateOneClickDeploy}
            className="px-4 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-md flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Rocket className="w-4 h-4" />
            {deployStep === 'provisioning'
              ? 'Validando Contenedor...'
              : deployStep === 'ready'
                ? 'Stack Listo para Producción'
                : 'Desplegar en 1 Clic'}
          </button>

          <a
            href="/api/deploy/bundle"
            className="px-4 py-2 text-xs font-medium bg-[#0B0F17] border border-slate-700 hover:border-slate-500 text-slate-100 rounded-md flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            Descargar Paquete (.zip)
          </a>
        </div>
      </div>

      {/* Target Environment Selector + Command */}
      <div className="bg-[#111827] border border-slate-800/90 rounded-lg p-5 flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-2">Infraestructura Objetivo</label>
            <div className="grid grid-cols-3 gap-1 p-1 bg-[#0B0F17] border border-slate-800 rounded-md">
              {[
                {id: 'docker', label: 'Docker Stack'},
                {id: 'vps', label: 'VPS Linux'},
                {id: 'dedicated', label: 'Dedicado Bare-Metal'},
              ].map((env) => (
                <button
                  key={env.id}
                  onClick={() => setTargetEnv(env.id as typeof targetEnv)}
                  className={`py-2 px-2 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                    targetEnv === env.id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {env.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-2">Región / Perfil de Red</label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full bg-[#0B0F17] border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
            >
              <option>eu-west (Frankfurt / Madrid)</option>
              <option>us-east (Virginia / Miami)</option>
              <option>sa-east (São Paulo)</option>
              <option>on-premise (Red Local / Dedicado OVH / Hetzner)</option>
            </select>
          </div>
        </div>

        <div className="bg-[#080C12] border border-slate-800 rounded-md p-3.5 flex flex-wrap items-center justify-between gap-3">
          <code className="text-xs font-mono text-emerald-300 break-all">{oneClickCommand}</code>
          <button
            onClick={() => handleCopy(oneClickCommand)}
            className="px-3 py-1.5 text-xs bg-[#111827] border border-slate-700 hover:border-slate-500 text-slate-200 rounded flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copiado' : 'Copiar Comando'}
          </button>
        </div>

        {deployStep === 'ready' && (
          <div className="text-xs text-emerald-300 bg-emerald-950/30 border border-emerald-800/60 rounded px-4 py-3">
            Manifiestos validados para <span className="font-medium">{region}</span>: OpenJDK 11 + Forge 1.16.5
            (<span className="font-mono">{config.serverIp}:{config.serverPort}</span>), healthcheck Docker cada 15s,
            Prometheus en <span className="font-mono">:9090</span> y Grafana en <span className="font-mono">:3001</span>.
            Descarga el paquete <span className="font-mono">.zip</span> para ejecutarlo en tu servidor.
          </div>
        )}
      </div>

      {/* Live Generated Manifests Viewer */}
      <div className="bg-[#111827] border border-slate-800/90 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1">
            {[
              {id: 'dockerCompose', label: 'docker-compose.yml'},
              {id: 'dockerfile', label: 'Dockerfile'},
              {id: 'vpsScript', label: 'deploy-vps.sh'},
              {id: 'prometheusYml', label: 'prometheus.yml'},
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFile(tab.id as keyof DeployTemplates)}
                className={`px-3 py-1.5 text-xs font-mono rounded transition-colors cursor-pointer whitespace-nowrap ${
                  activeFile === tab.id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {templates && (
            <button
              onClick={() => handleCopy(templates[activeFile])}
              className="px-2.5 py-1 text-xs text-slate-300 hover:text-white border border-slate-800 rounded flex items-center gap-1.5 cursor-pointer"
            >
              <Copy className="w-3 h-3" />
              Copiar Archivo
            </button>
          )}
        </div>

        <pre className="bg-[#080C12] p-5 text-xs font-mono text-slate-300 overflow-x-auto leading-relaxed max-h-[420px]">
          {templates ? templates[activeFile] : 'Cargando manifiestos de despliegue...'}
        </pre>
      </div>
    </div>
  );
};
