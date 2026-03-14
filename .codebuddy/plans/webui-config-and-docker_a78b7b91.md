---
name: webui-config-and-docker
overview: 为 deno-proxy 开发轻量可视化配置 WebUI（原生 HTML/JS），支持多上游管理、SQLite 持久化，并优化 Docker 部署适配 256MB 低配 VPS
design:
  architecture:
    framework: html
  styleKeywords:
    - 深色主题
    - 卡片式布局
    - 微交互
    - 响应式
  fontSystem:
    fontFamily: system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif
    heading:
      size: 24px
      weight: 600
    subheading:
      size: 16px
      weight: 500
    body:
      size: 14px
      weight: 400
  colorSystem:
    primary:
      - "#2563EB"
      - "#3B82F6"
      - "#60A5FA"
    background:
      - "#0F172A"
      - "#1E293B"
      - "#334155"
    text:
      - "#F8FAFC"
      - "#E2E8F0"
      - "#94A3B8"
    functional:
      - "#22C55E"
      - "#F59E0B"
      - "#EF4444"
todos:
  - id: create-admin-types
    content: 创建 admin/types.ts，定义上游配置和服务状态类型
    status: completed
  - id: implement-sqlite-db
    content: 创建 admin/db.ts，封装 SQLite 初始化和 CRUD 操作
    status: completed
    dependencies:
      - create-admin-types
  - id: build-upstream-manager
    content: 创建 admin/upstream-manager.ts，实现上游选择策略和热加载
    status: completed
    dependencies:
      - implement-sqlite-db
  - id: create-admin-api
    content: 创建 admin/admin-api.ts，实现管理 REST API
    status: completed
    dependencies:
      - build-upstream-manager
  - id: design-admin-ui
    content: 创建 admin/admin-ui.html，原生 HTML/CSS/JS 实现的配置管理界面
    status: completed
    dependencies:
      - create-admin-api
  - id: integrate-admin-route
    content: 修改 main.ts，集成管理 UI 路由和服务
    status: completed
    dependencies:
      - design-admin-ui
  - id: optimize-dockerfile
    content: 优化 Dockerfile，实现 Alpine 多阶段构建
    status: completed
    dependencies:
      - integrate-admin-route
  - id: create-docker-compose
    content: 创建 docker-compose.yml，支持一键部署
    status: completed
    dependencies:
      - optimize-dockerfile
---

## 用户需求

1. 开发轻量的可视化配置 WebUI 进行上游管理和设置，基于用户使用角度，交互人性化、快捷方便
2. 最终项目会被部署到 VPS 上，优化及适配低配 VPS 的方便快捷的 Docker 部署

## 需求确认结果

- WebUI 技术栈：原生 HTML/CSS/JS（最轻量）
- 多上游配置管理：是，需要管理多个上游
- 配置持久化方式：SQLite 数据库
- WebUI 认证：否，内部使用无需认证
- Docker 最低配置：256MB 内存极端低配

## 核心功能

- 多上游配置管理（增删改查、启用/禁用、默认上游选择）
- 实时上游连接测试
- 配置热生效（无需重启服务）
- 运行时上游切换（支持轮询/随机/指定策略）
- 服务状态监控（请求数、响应时间、健康状态）

## 技术栈选择

- **运行环境**: Deno (TypeScript)
- **WebUI**: 原生 HTML5 + CSS3 + Vanilla JS，单文件内联
- **数据库**: Deno-SQLite（纯 JS 实现，内存友好）
- **Docker**: Alpine Linux，多阶段构建

## 实现方案

### 1. 多上游配置管理

- **数据模型**：SQLite 表存储上游配置（id, name, baseUrl, apiKey, model, priority, enabled, createdAt, updatedAt）
- **运行时选择**：支持轮询（round-robin）、随机（random）、指定默认三种策略
- **热生效**：配置变更自动刷新，无需重启服务

### 2. WebUI 设计

- **入口**：`/admin` 路径，独立于代理 API
- **页面结构**：单页面应用，内联所有资源
- **交互**：实时测试连接、拖拽排序、即时保存
- **安全**：仅监听本地或内网，生产环境通过 Nginx 反向代理限制

### 3. 管理 API

- `GET /admin/api/upstreams` - 获取所有上游
- `POST /admin/api/upstreams` - 添加上游
- `PUT /admin/api/upstreams/:id` - 更新上游
- `DELETE /admin/api/upstreams/:id` - 删除上游
- `POST /admin/api/upstreams/:id/test` - 测试连接
- `GET /admin/api/status` - 服务状态

### 4. Docker 优化

- 使用 Alpine 基础镜像（~5MB）
- 多阶段构建减小镜像体积
- 目标镜像大小 <50MB
- 内存限制 256MB，通过 Deno 运行时参数 `--v8-flags=--max-old-space-size=128`

## 架构设计

### 系统架构

```
┌─────────────────────────────────────────────────┐
│                   用户浏览器                     │
└─────────────────┬───────────────────────────────┘
                  │ HTTP
                  ▼
┌─────────────────────────────────────────────────┐
│              Deno Proxy Server                  │
│  ┌─────────────┐  ┌─────────────┐               │
│  │  Admin UI   │  │ Proxy API   │               │
│  │  /admin     │  │ /v1/messages│               │
│  └─────────────┘  └─────────────┘               │
│  ┌─────────────────────────────────────────┐    │
│  │          Upstream Manager               │    │
│  │  - Config Store (SQLite)                │    │
│  │  - Load Balancer (策略选择)              │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

### 目录结构

```
deno-proxy/
├── src/
│   ├── main.ts                 # 主入口（已存在）
│   ├── config.ts               # 配置加载（已存在）
│   ├── admin/
│   │   ├── admin-ui.html       # [NEW] WebUI 页面
│   │   ├── admin-api.ts       # [NEW] 管理 API
│   │   ├── db.ts              # [NEW] SQLite 封装
│   │   ├── upstream-manager.ts # [NEW] 上游管理器
│   │   └── types.ts           # [NEW] 类型定义
├── data/                       # [NEW] SQLite 数据目录
│   └── config.db
├── Dockerfile                  # [MODIFY] 优化构建
└── docker-compose.yml          # [NEW] 快速部署
```

## 实现细节

### SQLite 数据库设计

```sql
CREATE TABLE upstreams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_key TEXT,
  model TEXT,
  priority INTEGER DEFAULT 0,
  enabled INTEGER DEFAULT 1,
  strategy TEXT DEFAULT 'default',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

### 内存优化要点

- 使用 Deno-SQLite 纯 JS 实现（无原生绑定开销）
- 关闭详细日志（生产环境 LOG_LEVEL=error）
- 连接超时 30s，避免长时间占用
- 流式响应边传边发，减少内存缓冲

### Docker 构建优化

- 多阶段构建：构建层 + 运行层分离
- 最小化依赖：使用 `deno:alpine` 基础镜像
- 非 root 用户运行，提升安全性

## 设计风格

采用现代简约风格，基于用户使用角度设计交互。深色主题配合高亮操作区域，重点突出上游配置的核心操作流程。

## 页面规划

### 主仪表盘（/admin）

- 顶部：服务状态概览卡片（在线上游数、总请求数、平均响应时间）
- 主体：上游配置列表（卡片式展示，支持快速启用/禁用）
- 侧边/底部：快捷操作区（添加上游、测试连接、导入导出）

### 上游配置弹窗

- 基础信息：名称、API 地址、API Key（密码遮罩）
- 高级选项：模型覆盖、超时时间、请求策略
- 实时反馈：连接测试按钮，实时显示成功/失败状态

## 视觉设计

### 色彩系统

- 主色：#2563EB（蓝）
- 背景：#0F172A（深蓝黑）
- 卡片：#1E293B（深灰蓝）
- 文字：#F1F5F9（浅灰白）
- 成功：#22C55E（绿）
- 警告：#F59E0B（橙）
- 错误：#EF4444（红）

### 布局

- 顶部状态栏固定
- 主体内容区自适应高度
- 卡片网格布局，响应式列数
- 弹窗居中，遮罩层背景

### 交互

- 卡片悬停高亮
- 按钮点击波纹效果
- 保存成功 toast 提示
- 删除确认二次弹窗
- 拖拽排序上游优先级

# Agent Extensions

当前任务不需要使用任何 Agent Extensions