// 上游管理器 - 实现负载均衡和热加载
import { Upstream, UpstreamStatus, UpstreamStrategy, ServiceStatus, TestUpstreamResult } from "./types.ts";
import { getAllUpstreams, getEnabledUpstreams, getGlobalSettings, getUpstreamById } from "./db.ts";

/** 上游状态追踪 */
const upstreamStatuses = new Map<number, UpstreamStatus>();

/** 当前使用的上游索引（用于轮询） */
let roundRobinIndex = 0;

/** 服务启动时间 */
const serviceStartTime = Date.now();

/** 请求统计 */
let totalRequests = 0;
let totalErrors = 0;
const responseTimes: number[] = [];

/** 初始化上游状态 */
export function initUpstreamStatuses(): void {
  const upstreams = getAllUpstreams();
  for (const us of upstreams) {
    upstreamStatuses.set(us.id, {
      id: us.id,
      name: us.name,
      status: us.enabled ? "offline" : "offline",
      requestCount: 0,
      errorCount: 0,
    });
  }
}

/** 获取上游状态 */
export function getUpstreamStatus(id: number): UpstreamStatus | undefined {
  return upstreamStatuses.get(id);
}

/** 获取所有上游状态 */
export function getAllUpstreamStatuses(): UpstreamStatus[] {
  return Array.from(upstreamStatuses.values());
}

/** 根据策略选择上游 */
export function selectUpstream(strategy?: UpstreamStrategy): Upstream | null {
  const settings = getGlobalSettings();
  const enabledUpstreams = getEnabledUpstreams();

  if (enabledUpstreams.length === 0) {
    return null;
  }

  // 如果指定了默认上游
  if (settings.defaultUpstreamId) {
    const defaultUpstream = enabledUpstreams.find(u => u.id === settings.defaultUpstreamId);
    if (defaultUpstream) {
      return defaultUpstream;
    }
  }

  // 使用传入的策略或全局默认策略
  const useStrategy = strategy || settings.defaultStrategy;

  switch (useStrategy) {
    case "round-robin": {
      if (roundRobinIndex >= enabledUpstreams.length) {
        roundRobinIndex = 0;
      }
      return enabledUpstreams[roundRobinIndex++];
    }
    case "random": {
      const randomIndex = Math.floor(Math.random() * enabledUpstreams.length);
      return enabledUpstreams[randomIndex];
    }
    case "default":
    default: {
      // 默认使用优先级最高的
      return enabledUpstreams[0];
    }
  }
}

/** 测试上游连接 */
export async function testUpstream(baseUrl: string, apiKey?: string, model?: string): Promise<TestUpstreamResult> {
  const startTime = Date.now();

  try {
    // 构造测试请求
    const testUrl = baseUrl.replace(/\/$/, "") + "/models";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(testUrl, {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const responseTime = Date.now() - startTime;

    if (response.ok) {
      return {
        success: true,
        status: response.status,
        responseTime,
        message: "连接成功",
      };
    } else {
      const errorText = await response.text();
      return {
        success: false,
        status: response.status,
        responseTime,
        error: errorText || `HTTP ${response.status}`,
      };
    }
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // 判断是否是超时
    if (errorMessage.includes("aborted")) {
      return {
        success: false,
        status: 0,
        responseTime,
        error: "连接超时",
      };
    }

    return {
      success: false,
      status: 0,
      responseTime,
      error: errorMessage,
    };
  }
}

/** 记录请求开始 */
export function recordRequestStart(upstreamId: number): void {
  totalRequests++;
  const status = upstreamStatuses.get(upstreamId);
  if (status) {
    status.requestCount++;
  }
}

/** 记录请求结束 */
export function recordRequestEnd(upstreamId: number, success: boolean, responseTime: number): void {
  const status = upstreamStatuses.get(upstreamId);
  if (!status) return;

  if (success) {
    status.status = "online";
    status.lastSuccess = Date.now();
    status.responseTime = responseTime;
  } else {
    status.errorCount++;
    status.status = "offline";
    status.lastError = "请求失败";
  }

  // 记录响应时间用于统计
  responseTimes.push(responseTime);
  if (responseTimes.length > 100) {
    responseTimes.shift();
  }
}

/** 获取服务状态 */
export function getServiceStatus(): ServiceStatus {
  const enabledCount = getEnabledUpstreams().length;
  const totalCount = (await import("./db.ts")).getUpstreamCount().total;

  // 计算平均响应时间
  const avgResponseTime = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : 0;

  const settings = getGlobalSettings();

  // 获取当前使用的上游
  const currentUpstream = selectUpstream();

  return {
    uptime: Date.now() - serviceStartTime,
    totalRequests,
    totalErrors,
    avgResponseTime,
    activeUpstreams: enabledCount,
    totalUpstreams: totalCount,
    strategy: settings.defaultStrategy,
    currentUpstreamId: currentUpstream?.id,
  };
}

/** 更新内存中的上游状态（配置变更后调用） */
export function refreshUpstreamStatuses(): void {
  const upstreams = getAllUpstreams();

  // 移除已删除的上游状态
  for (const id of upstreamStatuses.keys()) {
    if (!upstreams.find(u => u.id === id)) {
      upstreamStatuses.delete(id);
    }
  }

  // 添加新上游状态
  for (const us of upstreams) {
    if (!upstreamStatuses.has(us.id)) {
      upstreamStatuses.set(us.id, {
        id: us.id,
        name: us.name,
        status: us.enabled ? "offline" : "offline",
        requestCount: 0,
        errorCount: 0,
      });
    }
  }

  // 重置轮询索引
  roundRobinIndex = 0;
}

/** 获取当前配置的上游（用于代理服务） */
export function getCurrentUpstreamConfig(): {
  baseUrl: string;
  apiKey?: string;
  model?: string;
} | null {
  const upstream = selectUpstream();
  if (!upstream) return null;

  return {
    baseUrl: upstream.baseUrl,
    apiKey: upstream.apiKey,
    model: upstream.model,
  };
}

/** 验证上游配置是否存在 */
export function validateUpstreamExists(id: number): boolean {
  return getUpstreamById(id) !== null;
}
