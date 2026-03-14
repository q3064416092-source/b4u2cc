// 管理 API 实现
import {
  Upstream,
  CreateUpstreamRequest,
  UpdateUpstreamRequest,
  ApiResponse,
  TestUpstreamResult,
  ServiceStatus,
  GlobalSettings,
  UpstreamStatus,
} from "./types.ts";
import * as db from "./db.ts";
import * as upstreamManager from "./upstream-manager.ts";

/** JSON 响应 */
function jsonResponse<T>(body: ApiResponse<T>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** 解析 URL 中的 ID */
function parseId(pathname: string): number | null {
  const match = pathname.match(/\/(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

/** 处理管理 API 请求 */
export async function handleAdminApi(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname.replace(/^\/admin\/api/, "");

  // 路由匹配
  if (pathname === "/upstreams" && req.method === "GET") {
    return handleGetUpstreams();
  }

  if (pathname === "/upstreams" && req.method === "POST") {
    return handleCreateUpstream(req);
  }

  if (pathname.match(/^\/upstreams\/\d+$/) && req.method === "PUT") {
    const id = parseId(pathname);
    if (id === null) {
      return jsonResponse({ success: false, error: "Invalid ID" }, 400);
    }
    return handleUpdateUpstream(id, req);
  }

  if (pathname.match(/^\/upstreams\/\d+$/) && req.method === "DELETE") {
    const id = parseId(pathname);
    if (id === null) {
      return jsonResponse({ success: false, error: "Invalid ID" }, 400);
    }
    return handleDeleteUpstream(id);
  }

  if (pathname.match(/^\/upstreams\/\d+\/test$/) && req.method === "POST") {
    const id = parseId(pathname.replace("/test", ""));
    if (id === null) {
      return jsonResponse({ success: false, error: "Invalid ID" }, 400);
    }
    return handleTestUpstream(id);
  }

  if (pathname.match(/^\/upstreams\/\d+\/toggle$/) && req.method === "POST") {
    const id = parseId(pathname.replace("/toggle", ""));
    if (id === null) {
      return jsonResponse({ success: false, error: "Invalid ID" }, 400);
    }
    return handleToggleUpstream(id);
  }

  if (pathname === "/status" && req.method === "GET") {
    return handleGetStatus();
  }

  if (pathname === "/status/upstreams" && req.method === "GET") {
    return handleGetUpstreamStatuses();
  }

  if (pathname === "/settings" && req.method === "GET") {
    return handleGetSettings();
  }

  if (pathname === "/settings" && req.method === "PUT") {
    return handleUpdateSettings(req);
  }

  // 404
  return jsonResponse({ success: false, error: "Not found" }, 404);
}

// ============ Handlers ============

/** 获取所有上游 */
function handleGetUpstreams(): Response {
  const upstreams = db.getAllUpstreams();
  return jsonResponse({ success: true, data: upstreams });
}

/** 创建上游 */
async function handleCreateUpstream(req: Request): Response {
  try {
    const body = await req.json() as CreateUpstreamRequest;

    if (!body.name || !body.baseUrl) {
      return jsonResponse({ success: false, error: "name and baseUrl are required" }, 400);
    }

    const upstream = db.createUpstream({
      name: body.name,
      baseUrl: body.baseUrl,
      apiKey: body.apiKey,
      model: body.model,
      priority: body.priority || 0,
      enabled: body.enabled ?? true,
      strategy: body.strategy || "default",
    });

    // 刷新上游状态
    upstreamManager.refreshUpstreamStatuses();

    return jsonResponse({ success: true, data: upstream });
  } catch (error) {
    return jsonResponse({ success: false, error: String(error) }, 400);
  }
}

/** 更新上游 */
async function handleUpdateUpstream(id: number, req: Request): Response {
  try {
    const body = await req.json() as UpdateUpstreamRequest;

    const upstream = db.updateUpstream(id, body);
    if (!upstream) {
      return jsonResponse({ success: false, error: "Upstream not found" }, 404);
    }

    // 刷新上游状态
    upstreamManager.refreshUpstreamStatuses();

    return jsonResponse({ success: true, data: upstream });
  } catch (error) {
    return jsonResponse({ success: false, error: String(error) }, 400);
  }
}

/** 删除上游 */
function handleDeleteUpstream(id: number): Response {
  const success = db.deleteUpstream(id);
  if (!success) {
    return jsonResponse({ success: false, error: "Upstream not found" }, 404);
  }

  // 刷新上游状态
  upstreamManager.refreshUpstreamStatuses();

  return jsonResponse({ success: true, message: "Deleted successfully" });
}

/** 测试上游连接 */
function handleTestUpstream(id: number): Response {
  const upstream = db.getUpstreamById(id);
  if (!upstream) {
    return jsonResponse({ success: false, error: "Upstream not found" }, 404);
  }

  // 异步测试连接
  upstreamManager.testUpstream(upstream.baseUrl, upstream.apiKey, upstream.model)
    .then((result) => {
      // 更新状态（异步，不阻塞响应）
      const status = upstreamManager.getUpstreamStatus(id);
      if (status) {
        status.status = result.success ? "online" : "offline";
        status.lastTested = Date.now();
        status.lastError = result.error;
        status.responseTime = result.responseTime;
      }
    });

  return jsonResponse({
    success: true,
    data: { status: "testing", message: "测试进行中..." },
  });
}

/** 切换上游启用状态 */
function handleToggleUpstream(id: number): Response {
  const upstream = db.toggleUpstream(id);
  if (!upstream) {
    return jsonResponse({ success: false, error: "Upstream not found" }, 404);
  }

  // 刷新上游状态
  upstreamManager.refreshUpstreamStatuses();

  return jsonResponse({ success: true, data: upstream });
}

/** 获取服务状态 */
function handleGetStatus(): Response {
  const status = upstreamManager.getServiceStatus();
  return jsonResponse({ success: true, data: status });
}

/** 获取所有上游状态 */
function handleGetUpstreamStatuses(): Response {
  const statuses = upstreamManager.getAllUpstreamStatuses();
  return jsonResponse({ success: true, data: statuses });
}

/** 获取全局设置 */
function handleGetSettings(): Response {
  const settings = db.getGlobalSettings();
  return jsonResponse({ success: true, data: settings });
}

/** 更新全局设置 */
async function handleUpdateSettings(req: Request): Response {
  try {
    const body = await req.json() as GlobalSettings;

    db.updateGlobalSettings(body);

    // 刷新上游状态
    upstreamManager.refreshUpstreamStatuses();

    const settings = db.getGlobalSettings();
    return jsonResponse({ success: true, data: settings });
  } catch (error) {
    return jsonResponse({ success: false, error: String(error) }, 400);
  }
}

/** 初始化管理模块 */
export function initAdmin(): void {
  db.initDatabase();
  upstreamManager.initUpstreamStatuses();
}
