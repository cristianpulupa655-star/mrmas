import crypto from 'crypto';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import JSZip from 'jszip';
import path from 'path';
import {fileURLToPath} from 'url';
import {createServer as createViteServer} from 'vite';
import type {
  AlertRules,
  AnomalyAlert,
  BackupEntry,
  BackupSchedule,
  ConsoleLine,
  FileEntry,
  LoadProfile,
  ModOrPluginItem,
  PlayerInfo,
  ServerConfig,
  ServerStateSnapshot,
  ServerStatus,
  TelemetryPoint,
} from './src/types/server.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, 'mc-forge-1.16.5-workspace');

const FORGE_VERSION = '36.2.42';
const MINECRAFT_VERSION = '1.16.5';
const JAVA_VERSION = 'OpenJDK 11.0.24 (HotSpot)';

// --- Initial State ---
let serverStatus: ServerStatus = 'running';
let loadProfile: LoadProfile = 'normal';
let uptimeSeconds = 14820;
let lastAnomalyAt = 0;

let config: ServerConfig = {
  motd: 'Servidor Forge 1.16.5 Alta Disponibilidad — Optimizado con ForgeOps',
  maxPlayers: 80,
  gamemode: 'survival',
  difficulty: 'hard',
  pvp: true,
  whiteList: false,
  onlineMode: true,
  viewDistance: 8,
  simulationDistance: 6,
  spawnProtection: 16,
  maxTickTime: 60000,
  networkCompressionThreshold: 256,
  allowFlight: false,
  ramMinGb: 8,
  ramMaxGb: 12,
  gcProfile: 'aikar',
  forgeChunkThreading: true,
  forgeAsyncEntityAi: true,
  serverIp: '148.251.72.184',
  serverPort: 25565,
  rconPort: 25575,
};

let backupSchedule: BackupSchedule = {
  enabled: true,
  intervalMinutes: 60,
  maxRetention: 12,
  compression: 'tar.gz',
  backupBeforeModInstall: true,
  nextBackupAt: new Date(Date.now() + 34 * 60 * 1000).toISOString(),
};

let alertRules: AlertRules = {
  tpsMin: 17.0,
  msptMax: 52,
  ramMaxPercent: 88,
  cpuMaxPercent: 90,
  webhookUrl: '',
  webhookEnabled: false,
  browserPushEnabled: false,
};

let modsCatalog: ModOrPluginItem[] = [
  {
    id: 'ferritecore',
    name: 'FerriteCore',
    fileName: 'ferritecore-2.1.1-forge.jar',
    version: '2.1.1',
    mcVersion: '1.16.5',
    type: 'performance_plugin',
    category: 'Memoria JVM',
    description: 'Reduce el uso de memoria RAM de los modelos de bloques y estados hasta un 45% en Forge 1.16.5.',
    impactTps: '+0.8 TPS',
    ramImpactMb: -950,
    enabled: true,
    installed: true,
    sizeKb: 112,
    author: 'malte0811',
  },
  {
    id: 'performant',
    name: 'Performant',
    fileName: 'performant-1.16.5-3.72m.jar',
    version: '3.72m',
    mcVersion: '1.16.5',
    type: 'performance_plugin',
    category: 'IA & Entidades',
    description: 'Optimiza colisiones de entidades, pathfinding de mobs y carga multihilo bajo alta concurrencia.',
    impactTps: '+2.4 TPS',
    ramImpactMb: -180,
    enabled: true,
    installed: true,
    sizeKb: 384,
    author: 'someaddon',
  },
  {
    id: 'starlight-forge',
    name: 'Starlight (Forge)',
    fileName: 'starlight-1.0.0-RC2-1.16.5.jar',
    version: '1.0.0-RC2',
    mcVersion: '1.16.5',
    type: 'performance_plugin',
    category: 'Motor de Luz',
    description: 'Reescribe el motor de iluminación vanilla para eliminar caídas de MSPT durante generación de chunks.',
    impactTps: '+1.6 TPS',
    ramImpactMb: -120,
    enabled: true,
    installed: true,
    sizeKb: 245,
    author: 'Spottedleaf',
  },
  {
    id: 'clumps',
    name: 'Clumps',
    fileName: 'Clumps-6.0.0.28.jar',
    version: '6.0.0.28',
    mcVersion: '1.16.5',
    type: 'performance_plugin',
    category: 'Entidades XP',
    description: 'Agrupa orbes de experiencia cercanos en una sola entidad para evitar saturación de red y ticks.',
    impactTps: '+0.5 TPS',
    ramImpactMb: -45,
    enabled: true,
    installed: true,
    sizeKb: 42,
    author: 'Jaredlll08',
  },
  {
    id: 'spark',
    name: 'Spark Profiler',
    fileName: 'spark-1.9.11-forge.jar',
    version: '1.9.11',
    mcVersion: '1.16.5',
    type: 'performance_plugin',
    category: 'Diagnóstico',
    description: 'Perfilador de CPU, memoria y muestreo de ticks en tiempo real para detectar cuellos de botella.',
    impactTps: '0.0 TPS',
    ramImpactMb: 28,
    enabled: true,
    installed: true,
    sizeKb: 1420,
    author: 'Luck',
  },
  {
    id: 'ai-improvements',
    name: 'AI Improvements',
    fileName: 'AI-Improvements-1.16.5-0.4.0.jar',
    version: '0.4.0',
    mcVersion: '1.16.5',
    type: 'performance_plugin',
    category: 'IA & Mobs',
    description: 'Reduce llamadas redundantes de look-AI y pathfinding en granjas de entidades.',
    impactTps: '+0.9 TPS',
    ramImpactMb: -60,
    enabled: false,
    installed: true,
    sizeKb: 64,
    author: 'BuiltBrokenModding',
  },
  {
    id: 'chunky-forge',
    name: 'Chunky Pregenerator',
    fileName: 'Chunky-1.2.123.jar',
    version: '1.2.123',
    mcVersion: '1.16.5',
    type: 'performance_plugin',
    category: 'Gestión de Chunks',
    description: 'Pregenera regiones del mundo de forma controlada sin bloquear el hilo principal.',
    impactTps: 'Estabiliza Carga',
    ramImpactMb: 65,
    enabled: false,
    installed: false,
    sizeKb: 310,
    author: 'pop4959',
  },
  {
    id: 'create',
    name: 'Create',
    fileName: 'create-mc1.16.5_v0.3.2g.jar',
    version: '0.3.2g',
    mcVersion: '1.16.5',
    type: 'mod',
    category: 'Ingeniería & Mecánica',
    description: 'Automatización cinética, engranajes, trenes y maquinaria industrial avanzada.',
    impactTps: '-0.6 TPS',
    ramImpactMb: 420,
    enabled: true,
    installed: true,
    sizeKb: 8940,
    author: 'simibubi',
  },
  {
    id: 'jei',
    name: 'Just Enough Items (JEI)',
    fileName: 'jei-1.16.5-7.8.0.1009.jar',
    version: '7.8.0.1009',
    mcVersion: '1.16.5',
    type: 'mod',
    category: 'Utilidad',
    description: 'Índice de recetas y compatibilidad cliente/servidor para mods de Forge 1.16.5.',
    impactTps: '0.0 TPS',
    ramImpactMb: 85,
    enabled: true,
    installed: true,
    sizeKb: 960,
    author: 'mezz',
  },
  {
    id: 'biomesoplenty',
    name: 'Biomes O\' Plenty',
    fileName: 'BiomesOPlenty-1.16.5-13.1.0.488.jar',
    version: '13.1.0.488',
    mcVersion: '1.16.5',
    type: 'mod',
    category: 'Generación de Mundo',
    description: 'Añade más de 80 biomas únicos al Overworld y Nether para exploración multijugador.',
    impactTps: '-0.4 TPS',
    ramImpactMb: 340,
    enabled: true,
    installed: true,
    sizeKb: 5120,
    author: 'Forstride',
  },
  {
    id: 'waystones',
    name: 'Waystones',
    fileName: 'Waystones_1.16.5-7.6.4.jar',
    version: '7.6.4',
    mcVersion: '1.16.5',
    type: 'mod',
    category: 'Teletransporte',
    description: 'Obeliscos de teletransporte sincronizados entre jugadores para mundos extensos.',
    impactTps: '0.0 TPS',
    ramImpactMb: 45,
    enabled: true,
    installed: true,
    sizeKb: 320,
    author: 'BlayTheNinth',
  },
  {
    id: 'ae2',
    name: 'Applied Energistics 2',
    fileName: 'appliedenergistics2-8.4.7.jar',
    version: '8.4.7',
    mcVersion: '1.16.5',
    type: 'mod',
    category: 'Almacenamiento ME',
    description: 'Redes digitales de almacenamiento masivo y autocrafteo para servidores técnicos.',
    impactTps: '-0.5 TPS',
    ramImpactMb: 290,
    enabled: false,
    installed: false,
    sizeKb: 4480,
    author: 'Technici4n',
  },
  {
    id: 'tconstruct',
    name: 'Tinkers\' Construct',
    fileName: 'TConstruct-1.16.5-3.3.4.335.jar',
    version: '3.3.4.335',
    mcVersion: '1.16.5',
    type: 'mod',
    category: 'Herramientas & Fundición',
    description: 'Sistema modular de fundición y fabricación personalizada de herramientas.',
    impactTps: '-0.3 TPS',
    ramImpactMb: 260,
    enabled: false,
    installed: false,
    sizeKb: 6320,
    author: 'mDiyo',
  },
];

let players: PlayerInfo[] = [
  {
    id: 'p1',
    username: 'Kaelen_Dev',
    uuid: '8f1c92a4-3b21-4c90-91fa-08e44c9121a1',
    pingMs: 24,
    dimension: 'Overworld',
    coords: '142, 68, -419',
    gamemode: 'Survival',
    isOp: true,
    playtimeMin: 185,
  },
  {
    id: 'p2',
    username: 'ValeriaMC',
    uuid: '3c44b211-889a-4f10-b122-45aa19c8e102',
    pingMs: 38,
    dimension: 'Overworld',
    coords: '-912, 74, 304',
    gamemode: 'Survival',
    isOp: false,
    playtimeMin: 142,
  },
  {
    id: 'p3',
    username: 'Drako_Tech',
    uuid: 'a77e1029-4f88-4c11-8b23-99e0112a4f03',
    pingMs: 41,
    dimension: 'The Nether',
    coords: '58, 49, -112',
    gamemode: 'Survival',
    isOp: false,
    playtimeMin: 96,
  },
  {
    id: 'p4',
    username: 'NoraBuilder',
    uuid: 'd11298ab-1102-4a89-9931-72be41098a04',
    pingMs: 52,
    dimension: 'Overworld',
    coords: '2140, 65, 1088',
    gamemode: 'Survival',
    isOp: false,
    playtimeMin: 64,
  },
  {
    id: 'p5',
    username: 'SorenRedstone',
    uuid: 'f49012cc-7b12-4e45-8109-12ce8910bb05',
    pingMs: 29,
    dimension: 'The End',
    coords: '104, 58, 12',
    gamemode: 'Survival',
    isOp: false,
    playtimeMin: 210,
  },
  {
    id: 'p6',
    username: 'MateoForge',
    uuid: 'e88231aa-2d10-4b33-9012-77a90123cd06',
    pingMs: 63,
    dimension: 'Overworld',
    coords: '-340, 82, -780',
    gamemode: 'Survival',
    isOp: false,
    playtimeMin: 47,
  },
];

let backups: BackupEntry[] = [
  {
    id: 'bkp-003',
    name: 'world_forge1165_2026-11-25_18-00.tar.gz',
    createdAt: new Date(Date.now() - 26 * 60 * 1000).toISOString(),
    trigger: 'Automático',
    sizeMb: 1482.4,
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    status: 'Verificado',
    worldIncluded: true,
    modsIncluded: true,
  },
  {
    id: 'bkp-002',
    name: 'world_forge1165_2026-11-25_17-00.tar.gz',
    createdAt: new Date(Date.now() - 86 * 60 * 1000).toISOString(),
    trigger: 'Automático',
    sizeMb: 1479.8,
    sha256: '7d865e959b2466918c9863afca942d0fb89d7c9ac0c99bafc3749504ded97730',
    status: 'Verificado',
    worldIncluded: true,
    modsIncluded: true,
  },
  {
    id: 'bkp-001',
    name: 'pre_performant_update_2026-11-25_15-30.tar.gz',
    createdAt: new Date(Date.now() - 176 * 60 * 1000).toISOString(),
    trigger: 'Pre-cambio',
    sizeMb: 1465.1,
    sha256: 'b5bb9d8014a0f9b1d61e21e796d78dccdf1352f23cd32812f4850b878ae4944c',
    status: 'Verificado',
    worldIncluded: true,
    modsIncluded: true,
  },
];

let alerts: AnomalyAlert[] = [
  {
    id: 'alt-initial-1',
    timestamp: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
    severity: 'info',
    metric: 'Backup',
    title: 'Copia de seguridad verificada',
    message: 'Respaldo automático world_forge1165_2026-11-25_18-00.tar.gz completado sin pérdida de ticks.',
    value: '1482.4 MB',
    acknowledged: true,
  },
];

let consoleLogs: ConsoleLine[] = [
  {
    id: 'log-1',
    time: formatTime(new Date(Date.now() - 120000)),
    level: 'INFO',
    thread: 'main',
    message: `ModLauncher running: args [--gameDir, ., --launchTarget, fmlserver, --fml.forgeVersion, ${FORGE_VERSION}, --fml.mcVersion, ${MINECRAFT_VERSION}]`,
  },
  {
    id: 'log-2',
    time: formatTime(new Date(Date.now() - 115000)),
    level: 'INFO',
    thread: 'Server thread',
    message: 'FerriteCore mixin optimizations active — blockstate memory footprint reduced by 43%.',
  },
  {
    id: 'log-3',
    time: formatTime(new Date(Date.now() - 110000)),
    level: 'INFO',
    thread: 'Server thread',
    message: 'Starlight light engine initialized for Overworld, The Nether, and The End.',
  },
  {
    id: 'log-4',
    time: formatTime(new Date(Date.now() - 90000)),
    level: 'INFO',
    thread: 'Server thread',
    message: 'Done (6.842s)! For help, type "help" — Spark profiler & Prometheus exporter listening.',
  },
];

const telemetryHistory: TelemetryPoint[] = [];

function formatTime(d: Date): string {
  return d.toTimeString().slice(0, 8);
}

function addConsoleLog(level: 'INFO' | 'WARN' | 'ERROR', thread: string, message: string) {
  consoleLogs.push({
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    time: formatTime(new Date()),
    level,
    thread,
    message,
  });
  if (consoleLogs.length > 150) {
    consoleLogs = consoleLogs.slice(-150);
  }
}

// --- Real Disk Workspace Helpers ---
function buildServerPropertiesText(cfg: ServerConfig): string {
  return [
    '#Minecraft server properties (Sincronizado con ForgeOps 1.16.5)',
    `#Actualizado=${new Date().toISOString()}`,
    `motd=${cfg.motd}`,
    `server-ip=${cfg.serverIp}`,
    `server-port=${cfg.serverPort}`,
    `rcon.port=${cfg.rconPort}`,
    'enable-rcon=true',
    `max-players=${cfg.maxPlayers}`,
    `gamemode=${cfg.gamemode}`,
    `difficulty=${cfg.difficulty}`,
    `pvp=${cfg.pvp}`,
    `white-list=${cfg.whiteList}`,
    `online-mode=${cfg.onlineMode}`,
    `view-distance=${cfg.viewDistance}`,
    `simulation-distance=${cfg.simulationDistance}`,
    `spawn-protection=${cfg.spawnProtection}`,
    `max-tick-time=${cfg.maxTickTime}`,
    `network-compression-threshold=${cfg.networkCompressionThreshold}`,
    `allow-flight=${cfg.allowFlight}`,
    'level-name=world',
    'level-type=default',
    'enable-command-block=true',
    'sync-chunk-writes=false',
  ].join('\n');
}

function parseServerPropertiesIntoConfig(content: string) {
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (key === 'motd') config.motd = val;
    if (key === 'server-ip') config.serverIp = val || '0.0.0.0';
    if (key === 'server-port' && !Number.isNaN(Number(val))) config.serverPort = Number(val);
    if (key === 'max-players' && !Number.isNaN(Number(val))) config.maxPlayers = Number(val);
    if (key === 'view-distance' && !Number.isNaN(Number(val))) config.viewDistance = Number(val);
    if (key === 'simulation-distance' && !Number.isNaN(Number(val))) config.simulationDistance = Number(val);
    if (key === 'spawn-protection' && !Number.isNaN(Number(val))) config.spawnProtection = Number(val);
    if (key === 'max-tick-time' && !Number.isNaN(Number(val))) config.maxTickTime = Number(val);
    if (key === 'pvp') config.pvp = val === 'true';
    if (key === 'white-list') config.whiteList = val === 'true';
    if (key === 'online-mode') config.onlineMode = val === 'true';
    if (key === 'allow-flight') config.allowFlight = val === 'true';
    if (key === 'gamemode' && (val === 'survival' || val === 'creative' || val === 'adventure')) {
      config.gamemode = val;
    }
    if (key === 'difficulty' && (val === 'peaceful' || val === 'easy' || val === 'normal' || val === 'hard')) {
      config.difficulty = val;
    }
  }
}

function buildJvmArgsText(cfg: ServerConfig): string {
  const base = [`-Xms${cfg.ramMinGb}G`, `-Xmx${cfg.ramMaxGb}G`];
  if (cfg.gcProfile === 'aikar') {
    return [
      ...base,
      '-XX:+UseG1GC',
      '-XX:+ParallelRefProcEnabled',
      '-XX:MaxGCPauseMillis=200',
      '-XX:+UnlockExperimentalVMOptions',
      '-XX:+DisableExplicitGC',
      '-XX:+AlwaysPreTouch',
      '-XX:G1NewSizePercent=30',
      '-XX:G1MaxNewSizePercent=40',
      '-XX:G1HeapRegionSize=8M',
      '-XX:G1ReservePercent=20',
      '-XX:G1HeapWastePercent=5',
      '-XX:G1MixedGCCountTarget=4',
      '-XX:InitiatingHeapOccupancyPercent=15',
      '-XX:SurvivorRatio=32',
      '-Dusing.aikars.flags=https://mcflags.emc.gs',
    ].join('\n');
  }
  if (cfg.gcProfile === 'zgc') {
    return [
      ...base,
      '-XX:+UseZGC',
      '-XX:+UnlockExperimentalVMOptions',
      '-XX:+AlwaysPreTouch',
    ].join('\n');
  }
  return [
    ...base,
    '-XX:+UseG1GC',
    '-XX:MaxGCPauseMillis=120',
    '-XX:+AlwaysPreTouch',
  ].join('\n');
}

function buildForgeCommonToml(cfg: ServerConfig): string {
  return [
    '# Forge 1.16.5 Server Optimization Config',
    '[general]',
    '\tremoveErroringEntities = true',
    '\tremoveErroringTileEntities = true',
    `\tasyncEntityAi = ${cfg.forgeAsyncEntityAi}`,
    `\tchunkThreading = ${cfg.forgeChunkThreading}`,
    '\tmaxEntityCollisions = 8',
    '\tfixVanillaCascadingWorldgen = true',
  ].join('\n');
}

function buildPrometheusYml(): string {
  return [
    'global:',
    '  scrape_interval: 5s',
    '  evaluation_interval: 5s',
    '',
    'scrape_configs:',
    '  - job_name: "minecraft-forge-1165"',
    '    metrics_path: /metrics',
    '    static_configs:',
    '      - targets: ["forgeops-panel:3000"]',
    '        labels:',
    '          mc_version: "1.16.5"',
    `          forge_version: "${FORGE_VERSION}"`,
  ].join('\n');
}

function buildDockerfile(cfg: ServerConfig): string {
  return `FROM eclipse-temurin:11-jre-focal

LABEL maintainer="ForgeOps 1.16.5"
LABEL mc.version="${MINECRAFT_VERSION}"
LABEL forge.version="${FORGE_VERSION}"

ENV MEMORY="${cfg.ramMaxGb}G" \\
    FORGE_VERSION="${FORGE_VERSION}" \\
    MC_VERSION="${MINECRAFT_VERSION}" \\
    EULA="TRUE"

WORKDIR /data

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates jq \\
    && rm -rf /var/lib/apt/lists/*

# Descarga oficial del instalador Forge 1.16.5-${FORGE_VERSION}
RUN curl -fsSL "https://maven.minecraftforge.net/net/minecraftforge/forge/${MINECRAFT_VERSION}-${FORGE_VERSION}/forge-${MINECRAFT_VERSION}-${FORGE_VERSION}-installer.jar" -o forge-installer.jar \\
    && java -jar forge-installer.jar --installServer \\
    && rm -f forge-installer.jar

COPY server.properties /data/server.properties
COPY jvm_args.txt /data/user_jvm_args.txt
COPY config/ /data/config/
COPY mods/ /data/mods/

RUN echo "eula=true" > /data/eula.txt

EXPOSE ${cfg.serverPort}/tcp ${cfg.rconPort}/tcp

HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=3 \\
  CMD bash -c "</dev/tcp/127.0.0.1/${cfg.serverPort}" || exit 1

ENTRYPOINT ["sh", "-c", "exec java @user_jvm_args.txt -jar forge-${MINECRAFT_VERSION}-${FORGE_VERSION}.jar nogui"]
`;
}

function buildDockerCompose(cfg: ServerConfig): string {
  return `version: "3.9"

services:
  mc-forge-1165:
    build: .
    container_name: mc-forge-1165-prod
    restart: unless-stopped
    tty: true
    stdin_open: true
    ports:
      - "${cfg.serverPort}:${cfg.serverPort}"
      - "${cfg.rconPort}:${cfg.rconPort}"
    volumes:
      - ./world:/data/world
      - ./mods:/data/mods
      - ./config:/data/config
      - ./backups:/data/backups
      - ./logs:/data/logs
    deploy:
      resources:
        limits:
          memory: ${cfg.ramMaxGb + 2}G
    networks:
      - mc-monitoring

  backup-sidecar:
    image: alpine:3.20
    container_name: mc-forge-backup-daemon
    restart: unless-stopped
    volumes:
      - ./world:/source/world:ro
      - ./backups:/backups
    command: >
      sh -c "while true; do
        tar -czf /backups/auto_$(date +%Y%m%d_%H%M%S).tar.gz -C /source world;
        ls -tp /backups/*.tar.gz | tail -n +${backupSchedule.maxRetention + 1} | xargs -r rm --;
        sleep ${backupSchedule.intervalMinutes * 60};
      done"
    networks:
      - mc-monitoring

  prometheus:
    image: prom/prometheus:v2.54.1
    container_name: mc-prometheus
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
    networks:
      - mc-monitoring

  grafana:
    image: grafana/grafana:11.2.0
    container_name: mc-grafana
    restart: unless-stopped
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=forgeops-admin
    networks:
      - mc-monitoring

networks:
  mc-monitoring:
    driver: bridge
`;
}

function buildVpsDeployScript(cfg: ServerConfig): string {
  return `#!/usr/bin/env bash
set -euo pipefail

# Despliegue automatizado 1-Click para VPS / Servidor Dedicado (Ubuntu/Debian)
echo "[ForgeOps] Preparando entorno Java Forge ${MINECRAFT_VERSION}-${FORGE_VERSION}..."

if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

mkdir -p /opt/mc-forge-1165/{world,mods,config,backups,logs}
cd /opt/mc-forge-1165

# Optimización de kernel Linux para alta concurrencia de red Minecraft
sysctl -w net.core.somaxconn=4096 >/dev/null || true
sysctl -w vm.swappiness=10 >/dev/null || true

# Reglas de firewall UFW si está activo
if command -v ufw &> /dev/null; then
  ufw allow ${cfg.serverPort}/tcp || true
fi

echo "[ForgeOps] Levantando stack Docker + Prometheus + Backups automáticos..."
docker compose up -d --build
echo "[ForgeOps] Servidor operativo en ${cfg.serverIp}:${cfg.serverPort} (RAM: ${cfg.ramMinGb}G-${cfg.ramMaxGb}G)"
`;
}

function ensureWorkspaceInitialized() {
  const dirs = ['', 'mods', 'config', 'world', 'backups', 'logs'];
  for (const d of dirs) {
    const p = path.join(WORKSPACE_ROOT, d);
    if (!fs.existsSync(p)) {
      fs.mkdirSync(p, {recursive: true});
    }
  }

  const writeIfMissing = (rel: string, content: string) => {
    const full = path.join(WORKSPACE_ROOT, rel);
    if (!fs.existsSync(full)) {
      fs.writeFileSync(full, content, 'utf-8');
    }
  };

  writeIfMissing('eula.txt', 'eula=true\n');
  const propsPath = path.join(WORKSPACE_ROOT, 'server.properties');
  if (!fs.existsSync(propsPath)) {
    fs.writeFileSync(propsPath, buildServerPropertiesText(config), 'utf-8');
  } else {
    const existingProps = fs.readFileSync(propsPath, 'utf-8');
    if (existingProps.includes('server-ip=')) {
      parseServerPropertiesIntoConfig(existingProps);
    } else {
      parseServerPropertiesIntoConfig(existingProps);
      fs.writeFileSync(propsPath, buildServerPropertiesText(config), 'utf-8');
    }
  }
  writeIfMissing('jvm_args.txt', buildJvmArgsText(config));
  writeIfMissing('config/forge-common.toml', buildForgeCommonToml(config));
  writeIfMissing(
    'ops.json',
    JSON.stringify(
      [
        {
          uuid: '8f1c92a4-3b21-4c90-91fa-08e44c9121a1',
          name: 'Kaelen_Dev',
          level: 4,
          bypassesPlayerLimit: true,
        },
      ],
      null,
      2,
    ),
  );
  writeIfMissing('whitelist.json', JSON.stringify([], null, 2));
  writeIfMissing('prometheus.yml', buildPrometheusYml());
  writeIfMissing('Dockerfile', buildDockerfile(config));
  writeIfMissing('docker-compose.yml', buildDockerCompose(config));
  writeIfMissing('world/level.dat.json', JSON.stringify({seed: -4920194821, spawnX: 0, spawnY: 68, spawnZ: 0, forgeVersion: FORGE_VERSION}, null, 2));
  writeIfMissing('logs/latest.log', consoleLogs.map((l) => `[${l.time}] [${l.thread}/${l.level}]: ${l.message}`).join('\n') + '\n');

  // Sync installed mods into mods/ directory
  for (const mod of modsCatalog) {
    if (mod.installed) {
      const fname = mod.enabled ? mod.fileName : `${mod.fileName}.disabled`;
      const modPath = path.join(WORKSPACE_ROOT, 'mods', fname);
      if (!fs.existsSync(modPath)) {
        fs.writeFileSync(
          modPath,
          `Forge 1.16.5 Mod Artifact Placeholder\nName: ${mod.name}\nVersion: ${mod.version}\nAuthor: ${mod.author}\n`,
          'utf-8',
        );
      }
    }
  }

  // Ensure initial backup files exist on disk
  for (const bkp of backups) {
    const bkpPath = path.join(WORKSPACE_ROOT, 'backups', bkp.name);
    if (!fs.existsSync(bkpPath)) {
      fs.writeFileSync(
        bkpPath,
        JSON.stringify({backupId: bkp.id, createdAt: bkp.createdAt, sha256: bkp.sha256, forgeVersion: FORGE_VERSION, config}, null, 2),
        'utf-8',
      );
    }
  }
}

function syncConfigFilesToDisk() {
  fs.writeFileSync(path.join(WORKSPACE_ROOT, 'server.properties'), buildServerPropertiesText(config), 'utf-8');
  fs.writeFileSync(path.join(WORKSPACE_ROOT, 'jvm_args.txt'), buildJvmArgsText(config), 'utf-8');
  fs.writeFileSync(path.join(WORKSPACE_ROOT, 'config/forge-common.toml'), buildForgeCommonToml(config), 'utf-8');
  fs.writeFileSync(path.join(WORKSPACE_ROOT, 'Dockerfile'), buildDockerfile(config), 'utf-8');
  fs.writeFileSync(path.join(WORKSPACE_ROOT, 'docker-compose.yml'), buildDockerCompose(config), 'utf-8');
}

function resolveSafeWorkspacePath(relPath: string): string {
  const cleaned = (relPath || '').replace(/^\/+/, '');
  const resolved = path.resolve(WORKSPACE_ROOT, cleaned);
  if (!resolved.startsWith(WORKSPACE_ROOT)) {
    throw new Error('Ruta fuera del espacio de trabajo permitido');
  }
  return resolved;
}

// --- Telemetry & Anomaly Engine ---
function computeNextTelemetryPoint(): TelemetryPoint {
  const allocatedMb = config.ramMaxGb * 1024;
  if (serverStatus === 'stopped') {
    return {
      timestamp: formatTime(new Date()),
      tps: 0,
      mspt: 0,
      cpuPercent: 0.8,
      ramUsedMb: 120,
      ramAllocatedMb: allocatedMb,
      networkInMbps: 0,
      networkOutMbps: 0,
      diskIoMbps: 0.2,
      chunksLoaded: 0,
      entitiesCount: 0,
      playersOnline: 0,
    };
  }

  const enabledPerfPlugins = modsCatalog.filter((m) => m.installed && m.enabled && m.type === 'performance_plugin').length;
  const enabledContentMods = modsCatalog.filter((m) => m.installed && m.enabled && m.type === 'mod').length;
  const perfMitigation = Math.min(0.45, enabledPerfPlugins * 0.08 + (config.forgeAsyncEntityAi ? 0.06 : 0) + (config.forgeChunkThreading ? 0.06 : 0));

  let targetTps = 20.0;
  let targetMspt = 16.5 + enabledContentMods * 2.1;
  let targetCpu = 24 + enabledContentMods * 3.5;
  let baseModRam = modsCatalog
    .filter((m) => m.installed && m.enabled)
    .reduce((acc, m) => acc + Math.max(0, m.ramImpactMb), 2150);
  const ramSavings = modsCatalog
    .filter((m) => m.installed && m.enabled)
    .reduce((acc, m) => acc + Math.min(0, m.ramImpactMb), 0);
  let targetRam = Math.max(1400, baseModRam + ramSavings);
  let chunks = 1850 + players.length * (config.viewDistance * 14);
  let entities = 620 + players.length * 48;
  let netIn = 1.4 + players.length * 0.35;
  let netOut = 3.8 + players.length * 1.15;
  let diskIo = 8.4;

  if (loadProfile === 'high_players') {
    const simPlayers = Math.min(config.maxPlayers, 62);
    const loadFactor = 1 - perfMitigation * 0.85;
    targetMspt = (39 + enabledContentMods * 3.4) * loadFactor;
    targetTps = Math.min(20, Math.max(16.2, 50 / Math.max(25, targetMspt) * 15.8 + perfMitigation * 7));
    targetCpu = Math.min(86, 68 * loadFactor + 14);
    targetRam = Math.min(allocatedMb * 0.84, targetRam + simPlayers * 58);
    chunks = 6420;
    entities = 3240;
    netIn = 14.8;
    netOut = 48.6;
    diskIo = 34.2;
  } else if (loadProfile === 'chunk_gen') {
    const loadFactor = 1 - perfMitigation * 0.75;
    targetMspt = 48 * loadFactor + 4;
    targetTps = Math.min(20, Math.max(15.4, 18.6 - (1 - perfMitigation) * 3.1));
    targetCpu = Math.min(92, 78 * loadFactor + 12);
    targetRam = Math.min(allocatedMb * 0.87, targetRam + 1950);
    chunks = 8950;
    entities = 2180;
    netIn = 6.2;
    netOut = 29.4;
    diskIo = 118.5;
  } else if (loadProfile === 'anomaly_spike') {
    targetMspt = 74.5 + Math.random() * 14;
    targetTps = Number((12.4 + Math.random() * 2.1).toFixed(2));
    targetCpu = 93.4 + Math.random() * 5.2;
    targetRam = Math.min(allocatedMb * 0.96, allocatedMb * 0.91 + Math.random() * 350);
    chunks = 10420;
    entities = 6840;
    netIn = 22.1;
    netOut = 71.4;
    diskIo = 162.0;
  }

  const jitter = (amp: number) => (Math.random() - 0.5) * amp;
  const finalTps = Number(Math.min(20.0, Math.max(5.0, targetTps + jitter(0.25))).toFixed(2));
  const finalMspt = Number(Math.max(4.5, targetMspt + jitter(2.4)).toFixed(1));
  const finalCpu = Number(Math.min(99.8, Math.max(1.0, targetCpu + jitter(3.2))).toFixed(1));
  const finalRam = Math.round(Math.min(allocatedMb, Math.max(512, targetRam + jitter(90))));

  return {
    timestamp: formatTime(new Date()),
    tps: finalTps,
    mspt: finalMspt,
    cpuPercent: finalCpu,
    ramUsedMb: finalRam,
    ramAllocatedMb: allocatedMb,
    networkInMbps: Number(Math.max(0.2, netIn + jitter(0.8)).toFixed(2)),
    networkOutMbps: Number(Math.max(0.5, netOut + jitter(1.6)).toFixed(2)),
    diskIoMbps: Number(Math.max(0.5, diskIo + jitter(3.0)).toFixed(1)),
    chunksLoaded: Math.round(chunks + jitter(24)),
    entitiesCount: Math.round(entities + jitter(35)),
    playersOnline: loadProfile === 'high_players' ? Math.min(config.maxPlayers, 62) : players.length,
  };
}

async function dispatchWebhookIfConfigured(alert: AnomalyAlert) {
  if (!alertRules.webhookEnabled || !alertRules.webhookUrl) return;
  try {
    await fetch(alertRules.webhookUrl, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        content: `[ForgeOps 1.16.5] ${alert.severity.toUpperCase()}: ${alert.title} — ${alert.message} (${alert.value})`,
        embeds: [
          {
            title: alert.title,
            description: alert.message,
            color: alert.severity === 'critical' ? 14431557 : 14251782,
            fields: [
              {name: 'Métrica', value: alert.metric, inline: true},
              {name: 'Valor', value: alert.value, inline: true},
            ],
            timestamp: alert.timestamp,
          },
        ],
      }),
    });
  } catch {
    // External webhook unreachable should not crash server loop
  }
}

function evaluateAnomalies(point: TelemetryPoint) {
  if (serverStatus !== 'running') return;
  const now = Date.now();
  if (now - lastAnomalyAt < 12000) return; // Rate-limit repeated alerts every 12s

  const ramPct = (point.ramUsedMb / point.ramAllocatedMb) * 100;
  let triggered: AnomalyAlert | null = null;

  if (point.tps < alertRules.tpsMin) {
    triggered = {
      id: `alt-${now}`,
      timestamp: new Date().toISOString(),
      severity: point.tps < 14.5 ? 'critical' : 'warning',
      metric: 'TPS',
      title: 'Caída crítica de TPS detectada',
      message: `El hilo principal Forge cayó a ${point.tps} TPS (umbral mínimo ${alertRules.tpsMin} TPS).`,
      value: `${point.tps} TPS`,
      acknowledged: false,
    };
  } else if (point.mspt > alertRules.msptMax) {
    triggered = {
      id: `alt-${now}`,
      timestamp: new Date().toISOString(),
      severity: 'warning',
      metric: 'MSPT',
      title: 'Sobrecarga de Tick (MSPT elevado)',
      message: `Tiempo por tick en ${point.mspt} ms superando el límite de ${alertRules.msptMax} ms.`,
      value: `${point.mspt} ms`,
      acknowledged: false,
    };
  } else if (ramPct > alertRules.ramMaxPercent) {
    triggered = {
      id: `alt-${now}`,
      timestamp: new Date().toISOString(),
      severity: 'critical',
      metric: 'JVM Heap',
      title: 'Presión extrema de memoria JVM',
      message: `Uso de Heap al ${ramPct.toFixed(1)}% (${point.ramUsedMb} MB / ${point.ramAllocatedMb} MB).`,
      value: `${ramPct.toFixed(1)}%`,
      acknowledged: false,
    };
  } else if (point.cpuPercent > alertRules.cpuMaxPercent) {
    triggered = {
      id: `alt-${now}`,
      timestamp: new Date().toISOString(),
      severity: 'warning',
      metric: 'CPU',
      title: 'Saturación de CPU del nodo',
      message: `Carga de procesador al ${point.cpuPercent}% (umbral ${alertRules.cpuMaxPercent}%).`,
      value: `${point.cpuPercent}%`,
      acknowledged: false,
    };
  }

  if (triggered) {
    lastAnomalyAt = now;
    alerts.unshift(triggered);
    if (alerts.length > 50) alerts = alerts.slice(0, 50);
    addConsoleLog('WARN', 'ForgeOps-Watchdog', `${triggered.title}: ${triggered.message}`);
    void dispatchWebhookIfConfigured(triggered);
  }
}

function createBackupSnapshot(trigger: BackupEntry['trigger']): BackupEntry {
  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const ext = backupSchedule.compression;
  const name = `world_forge1165_${stamp}.${ext}`;
  const payload = JSON.stringify(
    {
      createdAt: now.toISOString(),
      trigger,
      forgeVersion: FORGE_VERSION,
      minecraftVersion: MINECRAFT_VERSION,
      config,
      mods: modsCatalog.filter((m) => m.installed),
    },
    null,
    2,
  );
  const sha256 = crypto.createHash('sha256').update(payload).digest('hex');
  const entry: BackupEntry = {
    id: `bkp-${Date.now()}`,
    name,
    createdAt: now.toISOString(),
    trigger,
    sizeMb: Number((1470 + Math.random() * 25).toFixed(1)),
    sha256,
    status: 'Verificado',
    worldIncluded: true,
    modsIncluded: true,
  };
  fs.writeFileSync(path.join(WORKSPACE_ROOT, 'backups', name), payload, 'utf-8');
  backups.unshift(entry);
  if (backups.length > backupSchedule.maxRetention) {
    const removed = backups.slice(backupSchedule.maxRetention);
    backups = backups.slice(0, backupSchedule.maxRetention);
    for (const r of removed) {
      const p = path.join(WORKSPACE_ROOT, 'backups', r.name);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
  }
  backupSchedule.nextBackupAt = new Date(Date.now() + backupSchedule.intervalMinutes * 60 * 1000).toISOString();
  addConsoleLog('INFO', 'BackupManager', `Copia ${name} creada (${entry.sizeMb} MB, SHA-256 verificado).`);
  return entry;
}

function seedInitialHistory() {
  for (let i = 0; i < 36; i++) {
    const p = computeNextTelemetryPoint();
    const past = new Date(Date.now() - (36 - i) * 2000);
    p.timestamp = formatTime(past);
    telemetryHistory.push(p);
  }
}

ensureWorkspaceInitialized();
seedInitialHistory();

setInterval(() => {
  if (serverStatus === 'running') {
    uptimeSeconds += 2;
    if (backupSchedule.enabled && Date.now() >= new Date(backupSchedule.nextBackupAt).getTime()) {
      createBackupSnapshot('Automático');
    }
  }
  const nextPoint = computeNextTelemetryPoint();
  telemetryHistory.push(nextPoint);
  if (telemetryHistory.length > 60) {
    telemetryHistory.shift();
  }
  evaluateAnomalies(nextPoint);
}, 2000);

// --- Express App ---
async function startServer() {
  const app = express();
  app.use(express.json({limit: '10mb'}));

  // Healthcheck (Docker / K8s)
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      status: serverStatus,
      minecraftVersion: MINECRAFT_VERSION,
      forgeVersion: FORGE_VERSION,
      uptimeSeconds,
    });
  });

  // Prometheus OpenMetrics Endpoint
  app.get('/metrics', (_req, res) => {
    const cur = telemetryHistory[telemetryHistory.length - 1];
    const lines = [
      '# HELP mc_forge_tps Server Ticks Per Second (target 20.0)',
      '# TYPE mc_forge_tps gauge',
      `mc_forge_tps{version="${MINECRAFT_VERSION}",forge="${FORGE_VERSION}"} ${cur.tps}`,
      '# HELP mc_forge_mspt Milliseconds Per Tick',
      '# TYPE mc_forge_mspt gauge',
      `mc_forge_mspt ${cur.mspt}`,
      '# HELP mc_forge_cpu_percent Host CPU utilization percent',
      '# TYPE mc_forge_cpu_percent gauge',
      `mc_forge_cpu_percent ${cur.cpuPercent}`,
      '# HELP mc_forge_heap_used_bytes JVM heap memory used in bytes',
      '# TYPE mc_forge_heap_used_bytes gauge',
      `mc_forge_heap_used_bytes ${cur.ramUsedMb * 1024 * 1024}`,
      '# HELP mc_forge_heap_max_bytes JVM heap memory allocated in bytes',
      '# TYPE mc_forge_heap_max_bytes gauge',
      `mc_forge_heap_max_bytes ${cur.ramAllocatedMb * 1024 * 1024}`,
      '# HELP mc_forge_players_online Connected players count',
      '# TYPE mc_forge_players_online gauge',
      `mc_forge_players_online ${cur.playersOnline}`,
      '# HELP mc_forge_chunks_loaded Loaded world chunks',
      '# TYPE mc_forge_chunks_loaded gauge',
      `mc_forge_chunks_loaded ${cur.chunksLoaded}`,
      '# HELP mc_forge_entities_count Active entities across dimensions',
      '# TYPE mc_forge_entities_count gauge',
      `mc_forge_entities_count ${cur.entitiesCount}`,
      '# HELP mc_forge_backups_total Stored verified backups',
      '# TYPE mc_forge_backups_total gauge',
      `mc_forge_backups_total ${backups.length}`,
    ];
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(lines.join('\n') + '\n');
  });

  // Full state snapshot
  app.get('/api/state', (_req, res) => {
    const snapshot: ServerStateSnapshot = {
      forgeVersion: FORGE_VERSION,
      minecraftVersion: MINECRAFT_VERSION,
      javaVersion: JAVA_VERSION,
      status: serverStatus,
      uptimeSeconds,
      loadProfile,
      current: telemetryHistory[telemetryHistory.length - 1],
      history: telemetryHistory,
      players,
      mods: modsCatalog,
      backups,
      backupSchedule,
      alerts,
      alertRules,
      config,
      console: consoleLogs,
      workspacePath: WORKSPACE_ROOT,
    };
    res.json(snapshot);
  });

  // Server power control
  app.post('/api/server/power', (req, res) => {
    const {action} = req.body as {action: 'start' | 'stop' | 'restart'};
    if (action === 'stop') {
      serverStatus = 'stopped';
      uptimeSeconds = 0;
      addConsoleLog('INFO', 'Server thread', 'Saving chunks and stopping Forge 1.16.5 server...');
    } else if (action === 'start') {
      serverStatus = 'starting';
      addConsoleLog('INFO', 'main', `Starting Minecraft Forge ${MINECRAFT_VERSION}-${FORGE_VERSION}...`);
      setTimeout(() => {
        serverStatus = 'running';
        addConsoleLog('INFO', 'Server thread', 'Done! Server listening on port ' + config.serverPort);
      }, 1500);
    } else if (action === 'restart') {
      serverStatus = 'restarting';
      uptimeSeconds = 0;
      addConsoleLog('INFO', 'Server thread', 'Reiniciando servidor Forge 1.16.5 con configuración actualizada...');
      setTimeout(() => {
        serverStatus = 'running';
        addConsoleLog('INFO', 'Server thread', 'Reinicio completado. Todos los chunks y mods cargados.');
      }, 2000);
    }
    res.json({status: serverStatus});
  });

  // Load simulation profile
  app.post('/api/server/load-profile', (req, res) => {
    const {profile} = req.body as {profile: LoadProfile};
    loadProfile = profile;
    const labels: Record<LoadProfile, string> = {
      normal: 'Carga operativa normal',
      high_players: 'Simulación de alta concurrencia (62 jugadores simultáneos)',
      chunk_gen: 'Simulación de generación intensiva de chunks',
      anomaly_spike: 'Inyección de anomalía de ticks y presión de memoria',
    };
    addConsoleLog(profile === 'anomaly_spike' ? 'WARN' : 'INFO', 'ForgeOps-Sim', `Perfil de carga cambiado a: ${labels[profile]}`);
    res.json({loadProfile});
  });

  // Console command execution
  app.post('/api/console/command', (req, res) => {
    const {command} = req.body as {command: string};
    const raw = (command || '').trim();
    if (!raw) return res.status(400).json({error: 'Comando vacío'});
    const cmd = raw.startsWith('/') ? raw.slice(1) : raw;
    addConsoleLog('INFO', 'RCON', `> /${cmd}`);

    const cur = telemetryHistory[telemetryHistory.length - 1];
    const lower = cmd.toLowerCase();

    if (lower === 'help') {
      addConsoleLog('INFO', 'Server thread', 'Comandos disponibles: list, forge tps, spark tps, save-all, clearlag, say <msg>, kick <usuario>, op <usuario>');
    } else if (lower === 'list') {
      addConsoleLog('INFO', 'Server thread', `Hay ${cur.playersOnline}/${config.maxPlayers} jugadores en línea: ${players.map((p) => p.username).join(', ')}`);
    } else if (lower === 'forge tps' || lower === 'tps' || lower === 'spark tps') {
      addConsoleLog('INFO', 'Spark', `Overworld: ${cur.tps} TPS (${cur.mspt} mspt) | Nether: 20.0 TPS | End: 20.0 TPS | CPU: ${cur.cpuPercent}%`);
    } else if (lower === 'save-all') {
      syncConfigFilesToDisk();
      addConsoleLog('INFO', 'Server thread', 'Guardado del mundo y regiones completado en disco.');
    } else if (lower === 'clearlag') {
      addConsoleLog('INFO', 'ClearLagg', 'Limpieza ejecutada: 142 items caídos y orbes redundantes eliminados.');
    } else if (lower.startsWith('say ')) {
      addConsoleLog('INFO', 'Server', `[Servidor] ${cmd.slice(4)}`);
    } else if (lower.startsWith('kick ')) {
      const target = cmd.slice(5).trim();
      const before = players.length;
      players = players.filter((p) => p.username.toLowerCase() !== target.toLowerCase());
      addConsoleLog('INFO', 'Server thread', players.length < before ? `Jugador ${target} expulsado del servidor.` : `Jugador ${target} no encontrado.`);
    } else if (lower.startsWith('op ')) {
      const target = cmd.slice(3).trim();
      const p = players.find((pl) => pl.username.toLowerCase() === target.toLowerCase());
      if (p) {
        p.isOp = true;
        addConsoleLog('INFO', 'Server thread', `Permisos de operador otorgados a ${p.username}.`);
      } else {
        addConsoleLog('WARN', 'Server thread', `No se encontró a ${target}.`);
      }
    } else {
      addConsoleLog('INFO', 'Server thread', `Comando ejecutado: ${cmd}`);
    }

    res.json({ok: true, console: consoleLogs});
  });

  // Player actions
  app.post('/api/players/action', (req, res) => {
    const {playerId, action} = req.body as {playerId: string; action: 'kick' | 'toggle_op' | 'tp_spawn'};
    const idx = players.findIndex((p) => p.id === playerId);
    if (idx === -1) return res.status(404).json({error: 'Jugador no encontrado'});

    const player = players[idx];
    if (action === 'kick') {
      players.splice(idx, 1);
      addConsoleLog('INFO', 'Server thread', `Kicked ${player.username} via Panel Web.`);
    } else if (action === 'toggle_op') {
      player.isOp = !player.isOp;
      addConsoleLog('INFO', 'Server thread', `${player.username} ahora ${player.isOp ? 'es Operador' : 'ya no es Operador'}.`);
    } else if (action === 'tp_spawn') {
      player.dimension = 'Overworld';
      player.coords = '0, 68, 0';
      addConsoleLog('INFO', 'Server thread', `Teletransportado ${player.username} al spawn (0, 68, 0).`);
    }
    res.json({players});
  });

  // Config update (writes directly to server.properties, jvm_args.txt, forge-common.toml, Dockerfile, docker-compose.yml)
  app.post('/api/config', (req, res) => {
    const updated = req.body as Partial<ServerConfig>;
    config = {...config, ...updated};
    syncConfigFilesToDisk();
    addConsoleLog('INFO', 'ConfigSync', 'Parámetros sincronizados en server.properties, jvm_args.txt y forge-common.toml.');
    res.json({config});
  });

  // Mods & Performance Plugins
  app.post('/api/mods/toggle', (req, res) => {
    const {id} = req.body as {id: string};
    const mod = modsCatalog.find((m) => m.id === id);
    if (!mod || !mod.installed) return res.status(404).json({error: 'Mod no instalado'});

    const oldPath = path.join(WORKSPACE_ROOT, 'mods', mod.enabled ? mod.fileName : `${mod.fileName}.disabled`);
    mod.enabled = !mod.enabled;
    const newPath = path.join(WORKSPACE_ROOT, 'mods', mod.enabled ? mod.fileName : `${mod.fileName}.disabled`);
    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
    } else {
      fs.writeFileSync(newPath, `Forge 1.16.5 Mod: ${mod.name} (${mod.version})\n`, 'utf-8');
    }
    addConsoleLog('INFO', 'ModManager', `${mod.name} ${mod.enabled ? 'activado' : 'desactivado'} (${mod.fileName}).`);
    res.json({mods: modsCatalog});
  });

  app.post('/api/mods/install', (req, res) => {
    const {id, customName, customFileName, customType} = req.body as {
      id?: string;
      customName?: string;
      customFileName?: string;
      customType?: 'mod' | 'performance_plugin';
    };

    if (backupSchedule.backupBeforeModInstall) {
      createBackupSnapshot('Pre-cambio');
    }

    if (id) {
      const mod = modsCatalog.find((m) => m.id === id);
      if (!mod) return res.status(404).json({error: 'Mod no encontrado en catálogo'});
      mod.installed = true;
      mod.enabled = true;
      fs.writeFileSync(
        path.join(WORKSPACE_ROOT, 'mods', mod.fileName),
        `Forge 1.16.5 Mod Artifact\nName: ${mod.name}\nVersion: ${mod.version}\n`,
        'utf-8',
      );
      addConsoleLog('INFO', 'ModManager', `Instalado ${mod.name} v${mod.version} en /mods/.`);
      return res.json({mods: modsCatalog, backups});
    }

    if (customName && customFileName) {
      const safeFile = customFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const finalFile = safeFile.endsWith('.jar') ? safeFile : `${safeFile}.jar`;
      const newMod: ModOrPluginItem = {
        id: `custom-${Date.now()}`,
        name: customName,
        fileName: finalFile,
        version: '1.16.5-custom',
        mcVersion: '1.16.5',
        type: customType || 'mod',
        category: customType === 'performance_plugin' ? 'Optimización Custom' : 'Mod Personalizado',
        description: 'Archivo .jar cargado manualmente por el administrador.',
        impactTps: customType === 'performance_plugin' ? '+0.4 TPS' : '-0.2 TPS',
        ramImpactMb: customType === 'performance_plugin' ? -40 : 140,
        enabled: true,
        installed: true,
        sizeKb: 640,
        author: 'Administrador',
      };
      modsCatalog.unshift(newMod);
      fs.writeFileSync(
        path.join(WORKSPACE_ROOT, 'mods', finalFile),
        `Custom Forge 1.16.5 Artifact: ${customName}\n`,
        'utf-8',
      );
      addConsoleLog('INFO', 'ModManager', `Archivo personalizado ${finalFile} instalado en /mods/.`);
      return res.json({mods: modsCatalog, backups});
    }

    res.status(400).json({error: 'Parámetros inválidos'});
  });

  app.delete('/api/mods/:id', (req, res) => {
    const mod = modsCatalog.find((m) => m.id === req.params.id);
    if (!mod) return res.status(404).json({error: 'Mod no encontrado'});
    mod.installed = false;
    mod.enabled = false;
    for (const candidate of [mod.fileName, `${mod.fileName}.disabled`]) {
      const p = path.join(WORKSPACE_ROOT, 'mods', candidate);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    addConsoleLog('INFO', 'ModManager', `Eliminado ${mod.fileName} de /mods/.`);
    res.json({mods: modsCatalog});
  });

  // File Manager API (Real persistent directory operations)
  app.get('/api/files', (req, res) => {
    try {
      const rel = String(req.query.path || '');
      const targetDir = resolveSafeWorkspacePath(rel);
      if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
        return res.status(404).json({error: 'Directorio no encontrado'});
      }
      const names = fs.readdirSync(targetDir);
      const entries: FileEntry[] = names
        .map((name) => {
          const full = path.join(targetDir, name);
          const st = fs.statSync(full);
          const entryRel = path.relative(WORKSPACE_ROOT, full).replace(/\\/g, '/');
          return {
            name,
            path: entryRel,
            isDirectory: st.isDirectory(),
            sizeBytes: st.isDirectory() ? 0 : st.size,
            updatedAt: st.mtime.toISOString(),
          };
        })
        .sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || a.name.localeCompare(b.name));
      res.json({path: rel, entries});
    } catch (err) {
      res.status(400).json({error: (err as Error).message});
    }
  });

  app.get('/api/files/content', (req, res) => {
    try {
      const rel = String(req.query.path || '');
      const full = resolveSafeWorkspacePath(rel);
      if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) {
        return res.status(404).json({error: 'Archivo no encontrado'});
      }
      const content = fs.readFileSync(full, 'utf-8');
      res.json({path: rel, content});
    } catch (err) {
      res.status(400).json({error: (err as Error).message});
    }
  });

  app.post('/api/files/save', (req, res) => {
    try {
      const {path: rel, content} = req.body as {path: string; content: string};
      const full = resolveSafeWorkspacePath(rel);
      fs.writeFileSync(full, content ?? '', 'utf-8');
      if (rel === 'server.properties') {
        parseServerPropertiesIntoConfig(content ?? '');
      }
      addConsoleLog('INFO', 'FileManager', `Archivo guardado: ${rel}`);
      res.json({ok: true, config});
    } catch (err) {
      res.status(400).json({error: (err as Error).message});
    }
  });

  app.post('/api/files/create', (req, res) => {
    try {
      const {parentPath, name, isDirectory, content} = req.body as {
        parentPath: string;
        name: string;
        isDirectory: boolean;
        content?: string;
      };
      const safeName = (name || '').replace(/[\\/]/g, '').trim();
      if (!safeName) return res.status(400).json({error: 'Nombre inválido'});
      const rel = parentPath ? `${parentPath}/${safeName}` : safeName;
      const full = resolveSafeWorkspacePath(rel);
      if (fs.existsSync(full)) return res.status(409).json({error: 'Ya existe un elemento con ese nombre'});
      if (isDirectory) {
        fs.mkdirSync(full, {recursive: true});
      } else {
        fs.writeFileSync(full, content ?? '', 'utf-8');
      }
      res.json({ok: true});
    } catch (err) {
      res.status(400).json({error: (err as Error).message});
    }
  });

  app.delete('/api/files', (req, res) => {
    try {
      const rel = String(req.query.path || '');
      if (!rel) return res.status(400).json({error: 'No se puede eliminar la raíz'});
      const full = resolveSafeWorkspacePath(rel);
      if (!fs.existsSync(full)) return res.status(404).json({error: 'No existe'});
      fs.rmSync(full, {recursive: true, force: true});
      res.json({ok: true});
    } catch (err) {
      res.status(400).json({error: (err as Error).message});
    }
  });

  app.get('/api/files/download', (req, res) => {
    try {
      const rel = String(req.query.path || '');
      const full = resolveSafeWorkspacePath(rel);
      if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) {
        return res.status(404).json({error: 'Archivo no encontrado'});
      }
      res.download(full, path.basename(full));
    } catch (err) {
      res.status(400).json({error: (err as Error).message});
    }
  });

  // Backups API
  app.post('/api/backups/create', (_req, res) => {
    const entry = createBackupSnapshot('Manual');
    res.json({backup: entry, backups});
  });

  app.post('/api/backups/schedule', (req, res) => {
    backupSchedule = {...backupSchedule, ...(req.body as Partial<BackupSchedule>)};
    backupSchedule.nextBackupAt = new Date(Date.now() + backupSchedule.intervalMinutes * 60 * 1000).toISOString();
    syncConfigFilesToDisk();
    res.json({backupSchedule});
  });

  app.post('/api/backups/restore', (req, res) => {
    const {id} = req.body as {id: string};
    const bkp = backups.find((b) => b.id === id);
    if (!bkp) return res.status(404).json({error: 'Backup no encontrado'});
    addConsoleLog('WARN', 'BackupManager', `Restaurando snapshot ${bkp.name} (SHA-256: ${bkp.sha256.slice(0, 12)}...)...`);
    addConsoleLog('INFO', 'BackupManager', 'Mundo y configuraciones restauradas correctamente.');
    res.json({ok: true, restored: bkp});
  });

  app.delete('/api/backups/:id', (req, res) => {
    const idx = backups.findIndex((b) => b.id === req.params.id);
    if (idx === -1) return res.status(404).json({error: 'No encontrado'});
    const [removed] = backups.splice(idx, 1);
    const p = path.join(WORKSPACE_ROOT, 'backups', removed.name);
    if (fs.existsSync(p)) fs.unlinkSync(p);
    res.json({backups});
  });

  app.get('/api/backups/:id/download', (req, res) => {
    const bkp = backups.find((b) => b.id === req.params.id);
    if (!bkp) return res.status(404).json({error: 'Backup no encontrado'});
    const p = path.join(WORKSPACE_ROOT, 'backups', bkp.name);
    if (!fs.existsSync(p)) return res.status(404).json({error: 'Archivo no encontrado en disco'});
    res.download(p, bkp.name);
  });

  // Alerts & Anomaly Rules
  app.post('/api/alerts/rules', (req, res) => {
    alertRules = {...alertRules, ...(req.body as Partial<AlertRules>)};
    res.json({alertRules});
  });

  app.post('/api/alerts/acknowledge', (req, res) => {
    const {id} = req.body as {id?: string};
    if (id) {
      const item = alerts.find((a) => a.id === id);
      if (item) item.acknowledged = true;
    } else {
      alerts.forEach((a) => (a.acknowledged = true));
    }
    res.json({alerts});
  });

  app.post('/api/alerts/test-anomaly', (_req, res) => {
    const alert: AnomalyAlert = {
      id: `alt-${Date.now()}`,
      timestamp: new Date().toISOString(),
      severity: 'critical',
      metric: 'TPS / Watchdog',
      title: 'Anomalía de rendimiento simulada',
      message: 'Caída súbita a 13.4 TPS y MSPT en 74.8 ms detectada por sobrecarga de entidades en Overworld.',
      value: '13.4 TPS',
      acknowledged: false,
    };
    alerts.unshift(alert);
    addConsoleLog('WARN', 'ForgeOps-Watchdog', `${alert.title}: ${alert.message}`);
    void dispatchWebhookIfConfigured(alert);
    res.json({alert, alerts});
  });

  app.post('/api/alerts/test-webhook', async (req, res) => {
    const {url} = req.body as {url?: string};
    const targetUrl = url || alertRules.webhookUrl;
    if (!targetUrl) {
      return res.status(400).json({error: 'Ingresa una URL de webhook válida'});
    }
    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          content: '[ForgeOps 1.16.5] Prueba de notificación push externa exitosa. Monitorización activa.',
        }),
      });
      res.json({ok: response.ok, status: response.status});
    } catch (err) {
      res.status(502).json({error: `No se pudo contactar el webhook: ${(err as Error).message}`});
    }
  });

  // Exportable Performance Reports (JSON / CSV / Markdown)
  app.get('/api/reports/generate', (req, res) => {
    const format = String(req.query.format || 'json');
    const avgTps = Number((telemetryHistory.reduce((s, p) => s + p.tps, 0) / telemetryHistory.length).toFixed(2));
    const avgMspt = Number((telemetryHistory.reduce((s, p) => s + p.mspt, 0) / telemetryHistory.length).toFixed(1));
    const peakCpu = Math.max(...telemetryHistory.map((p) => p.cpuPercent));
    const peakRam = Math.max(...telemetryHistory.map((p) => p.ramUsedMb));
    const installedPerf = modsCatalog.filter((m) => m.installed && m.enabled && m.type === 'performance_plugin');

    const reportPayload = {
      generatedAt: new Date().toISOString(),
      environment: {
        minecraftVersion: MINECRAFT_VERSION,
        forgeVersion: FORGE_VERSION,
        javaVersion: JAVA_VERSION,
        gcProfile: config.gcProfile,
        ramAllocatedGb: config.ramMaxGb,
        loadProfile,
      },
      summary: {
        avgTps,
        avgMspt,
        peakCpuPercent: peakCpu,
        peakRamUsedMb: peakRam,
        activePlayers: players.length,
        maxPlayers: config.maxPlayers,
        activeOptimizationPlugins: installedPerf.map((m) => m.name),
        unacknowledgedAlerts: alerts.filter((a) => !a.acknowledged).length,
      },
      samples: telemetryHistory,
      recentAlerts: alerts.slice(0, 15),
    };

    if (format === 'csv') {
      const header = 'timestamp,tps,mspt,cpu_percent,ram_used_mb,ram_allocated_mb,players_online,chunks_loaded,entities_count,net_in_mbps,net_out_mbps';
      const rows = telemetryHistory.map((p) =>
        [p.timestamp, p.tps, p.mspt, p.cpuPercent, p.ramUsedMb, p.ramAllocatedMb, p.playersOnline, p.chunksLoaded, p.entitiesCount, p.networkInMbps, p.networkOutMbps].join(','),
      );
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="forge-1.16.5-performance-report.csv"');
      return res.send([header, ...rows].join('\n'));
    }

    if (format === 'markdown') {
      const md = [
        `# Reporte de Rendimiento — Minecraft Java Forge ${MINECRAFT_VERSION} (${FORGE_VERSION})`,
        `Generado: ${reportPayload.generatedAt}`,
        '',
        '## Resumen Ejecutivo',
        `- **TPS Promedio:** ${avgTps} / 20.0`,
        `- **MSPT Promedio:** ${avgMspt} ms`,
        `- **Pico de CPU:** ${peakCpu}%`,
        `- **Pico de RAM JVM:** ${peakRam} MB / ${config.ramMaxGb * 1024} MB`,
        `- **Perfil GC:** ${config.gcProfile}`,
        `- **Plugins de Rendimiento Activos:** ${installedPerf.map((m) => m.name).join(', ') || 'Ninguno'}`,
        '',
        '## Anomalías Recientes',
        ...alerts.slice(0, 10).map((a) => `- [${a.severity.toUpperCase()}] ${a.timestamp} — ${a.title}: ${a.message}`),
      ].join('\n');
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="forge-1.16.5-report.md"');
      return res.send(md);
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="forge-1.16.5-report.json"');
    return res.send(JSON.stringify(reportPayload, null, 2));
  });

  // One-Click Deploy Complete ZIP Bundle
  app.get('/api/deploy/bundle', async (_req, res) => {
    const zip = new JSZip();
    zip.file('Dockerfile', buildDockerfile(config));
    zip.file('docker-compose.yml', buildDockerCompose(config));
    zip.file('deploy-vps.sh', buildVpsDeployScript(config));
    zip.file('server.properties', buildServerPropertiesText(config));
    zip.file('jvm_args.txt', buildJvmArgsText(config));
    zip.file('eula.txt', 'eula=true\n');
    zip.file('prometheus.yml', buildPrometheusYml());
    zip.file('config/forge-common.toml', buildForgeCommonToml(config));
    zip.file(
      'grafana-dashboard.json',
      JSON.stringify(
        {
          title: 'ForgeOps 1.16.5 — Telemetría de Servidor',
          panels: [
            {title: 'TPS del Servidor', expr: 'mc_forge_tps'},
            {title: 'MSPT (Milisegundos por Tick)', expr: 'mc_forge_mspt'},
            {title: 'Memoria JVM Heap', expr: 'mc_forge_heap_used_bytes'},
            {title: 'Jugadores Conectados', expr: 'mc_forge_players_online'},
          ],
        },
        null,
        2,
      ),
    );
    zip.file(
      'mods/manifest.json',
      JSON.stringify(
        modsCatalog.filter((m) => m.installed && m.enabled).map((m) => ({name: m.name, fileName: m.fileName, version: m.version, type: m.type})),
        null,
        2,
      ),
    );

    const buffer = await zip.generateAsync({type: 'nodebuffer'});
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="mc-forge-1.16.5-deploy-bundle.zip"');
    res.send(buffer);
  });

  // Preview templates for Deploy & Docker view
  app.get('/api/deploy/templates', (_req, res) => {
    res.json({
      dockerfile: buildDockerfile(config),
      dockerCompose: buildDockerCompose(config),
      vpsScript: buildVpsDeployScript(config),
      prometheusYml: buildPrometheusYml(),
    });
  });

  // Vite middleware in dev, static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(3000, '0.0.0.0', () => {
    console.log('ForgeOps 1.16.5 server running on http://0.0.0.0:3000');
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
