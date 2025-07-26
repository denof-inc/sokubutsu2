export interface SystemMetrics {
  memory: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    usagePercent: number;
  };
  cpu: {
    user: number;
    system: number;
    usagePercent: number;
  };
  disk?: {
    usagePercent: number;
    free: number;
    total: number;
  };
  timestamp: Date;
}

export interface BotProtectionMetrics {
  overallSuccessRate: number;
  siteSuccessRates: { [key: string]: number };
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  timestamp: Date;
}

export interface ResponseTimeMetrics {
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  timeoutRate: number;
  totalRequests: number;
  timestamp: Date;
}

export interface ProcessMetrics {
  activeBrowserProcesses: number;
  totalProcessesCreated: number;
  processLifetimes: number[];
  averageLifetime: number;
  timestamp: Date;
}

export type AlertLevel = 'CRITICAL' | 'WARNING' | 'INFO';

export interface Alert {
  level: AlertLevel;
  type: string;
  message: string;
  metrics?: any;
  recommendedAction?: string;
}