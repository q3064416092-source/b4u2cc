// 上游配置类型定义

/** 上游选择策略 */
export type UpstreamStrategy = "default" | "round-robin" | "random";

/** 上游配置 */
export interface Upstream {
  id: number;
  name: string;
  baseUrl: string;
  apiKey?: string;
  model?: string;
  priority: number;
  enabled: boolean;
  strategy: UpstreamStrategy;
  createdAt: number;
  updatedAt: number;
}

/** 上游状态 */
export interface UpstreamStatus {
  id: number;
  name: string;
  status: "online" | "offline" | "testing";
  lastTested?: number;
  lastSuccess?: number;
  lastError?: string;
  responseTime?: number;
  requestCount: number;
  errorCount: number;
}

/** 服务状态 */
export interface ServiceStatus {
  uptime: number;
  totalRequests: number;
  totalErrors: number;
  avgResponseTime: number;
  activeUpstreams: number;
  totalUpstreams: number;
  strategy: UpstreamStrategy;
  currentUpstreamId?: number;
}

/** 创建上游请求 */
export interface CreateUpstreamRequest {
  name: string;
  baseUrl: string;
  apiKey?: string;
  model?: string;
  priority?: number;
  enabled?: boolean;
  strategy?: UpstreamStrategy;
}

/** 更新上游请求 */
export interface UpdateUpstreamRequest {
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  priority?: number;
  enabled?: boolean;
  strategy?: UpstreamStrategy;
}

/** 测试上游结果 */
export interface TestUpstreamResult {
  success: boolean;
  status: number;
  responseTime: number;
  error?: string;
  message?: string;
}

/** API 响应封装 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/** 设置项 */
export interface Setting {
  key: string;
  value: string;
}

/** 全局设置 */
export interface GlobalSettings {
  defaultStrategy: UpstreamStrategy;
  defaultUpstreamId?: number;
  timeoutMs: number;
  maxRetries: number;
}
