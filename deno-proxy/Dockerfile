# 阶段1: 构建
FROM denoland/deno:1.40.5-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY deno.json deno.lock ./
COPY src ./src

# 缓存依赖
RUN deno cache src/main.ts

# 阶段2: 运行
FROM denoland/deno:1.40.5-alpine

WORKDIR /app

# 创建非 root 用户
RUN addgroup -g 1000 -S deno && \
    adduser -S deno -u 1000 -G deno

# 复制构建阶段的文件
COPY --from=builder /app .

# 创建数据目录
RUN mkdir -p /app/data /app/logs && \
    chown -R deno:deno /app

# 切换到非 root 用户
USER deno

# 暴露端口
EXPOSE 3456

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3456/healthz || exit 1

# 启动命令 - 限制内存使用
CMD ["run", "--allow-net", "--allow-env", "--allow-read", "--allow-write", \
     "--v8-flags=--max-old-space-size=128", \
     "src/main.ts"]
