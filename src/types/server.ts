export type ServerStatus = 'running' | 'stopped' | 'starting' | 'restarting';

export type LoadProfile = 'normal' | 'high_players' | 'chunk_gen' | 'anomaly_spike';

export interface TelemetryPoint {
  timestamp: string;
  tps: number;
  mspt: number;
  cpuPercent: number;
  ramUsedMb: number;
  ramAllocatedMb: number;
  networkInMbps: number;
  networkOutMbps: number;
  diskIoMbps: number;
  chunksLoaded: number;
  entitiesCount: number;
  playersOnline: number;
}

export interface PlayerInfo {
  id: string;
  username: string;
  uuid: string;
  pingMs: number;
  dimension: 'Overworld' | 'The Nether' | 'The End';
  coords: string;
  gamemode: 'Survival' | 'Creative' | 'Adventure';
  isOp: boolean;
  playtimeMin: number;
}

export interface ModOrPluginItem {
  id: string;
  name: string;
  fileName: string;
  version: string;
  mcVersion: '1.16.5';
  type: 'mod' | 'performance_plugin';
  category: string;
  description: string;
  impactTps: string;
  ramImpactMb: number;
  enabled: boolean;
  installed: boolean;
  sizeKb: number;
  author: string;
}

export interface BackupEntry {
  id: string;
  name: string;
  createdAt: string;
  trigger: 'Automático' | 'Manual' | 'Pre-cambio';
  sizeMb: number;
  sha256: string;
  status: 'Verificado' | 'Pendiente';
  worldIncluded: boolean;
  modsIncluded: boolean;
}

export interface BackupSchedule {
  enabled: boolean;
  intervalMinutes: number;
  maxRetention: number;
  compression: 'tar.gz' | 'zip';
  backupBeforeModInstall: boolean;
  nextBackupAt: string;
}

export interface AnomalyAlert {
  id: string;
  timestamp: string;
  severity: 'critical' | 'warning' | 'info';
  metric: string;
  title: string;
  message: string;
  value: string;
  acknowledged: boolean;
}

export interface AlertRules {
  tpsMin: number;
  msptMax: number;
  ramMaxPercent: number;
  cpuMaxPercent: number;
  webhookUrl: string;
  webhookEnabled: boolean;
  browserPushEnabled: boolean;
}

export interface ServerConfig {
  motd: string;
  maxPlayers: number;
  gamemode: 'survival' | 'creative' | 'adventure';
  difficulty: 'peaceful' | 'easy' | 'normal' | 'hard';
  pvp: boolean;
  whiteList: boolean;
  onlineMode: boolean;
  viewDistance: number;
  simulationDistance: number;
  spawnProtection: number;
  maxTickTime: number;
  networkCompressionThreshold: number;
  allowFlight: boolean;
  ramMinGb: number;
  ramMaxGb: number;
  gcProfile: 'aikar' | 'g1gc_tuned' | 'zgc';
  forgeChunkThreading: boolean;
  forgeAsyncEntityAi: boolean;
  serverIp: string;
  serverPort: number;
  rconPort: number;
}

export interface ConsoleLine {
  id: string;
  time: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  thread: string;
  message: string;
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  sizeBytes: number;
  updatedAt: string;
}

export interface ServerStateSnapshot {
  forgeVersion: string;
  minecraftVersion: string;
  javaVersion: string;
  status: ServerStatus;
  uptimeSeconds: number;
  loadProfile: LoadProfile;
  current: TelemetryPoint;
  history: TelemetryPoint[];
  players: PlayerInfo[];
  mods: ModOrPluginItem[];
  backups: BackupEntry[];
  backupSchedule: BackupSchedule;
  alerts: AnomalyAlert[];
  alertRules: AlertRules;
  config: ServerConfig;
  console: ConsoleLine[];
  workspacePath: string;
}
