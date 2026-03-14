# 海外 VPS 标准 Dockerfile

FROM alpine:3.19

# 安装 Deno
RUN apk add --no-cache curl unzip ca-certificates && \
    DENO_VERSION=1.40.5 && \
    curl -fsSL "https://github.com/denoland/deno/releases/download/v${DENO_VERSION}/deno-x86_64-unknown-linux-gnu.zip" -o deno.zip && \
    unzip deno.zip && \
    mv deno /usr/local/bin/ && \
    chmod +x /usr/local/bin/deno && \
    rm deno.zip && \
    apk del unzip

WORKDIR /app

# 创建非 root 用户
RUN addgroup -g 1000 -S deno && \
    adduser -S deno -u 1000 -G deno

# 复制源代码
COPY deno.json deno.lock ./
COPY src ./src

# 缓存依赖
RUN deno cache src/main.ts

# 创建数据目录
RUN mkdir -p /app/data /app/logs && \
    chown -R deno:deno /app

# 切换到非 root 用户
USER deno

# 暴露端口
EXPOSE 3456

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -q --spider http://localhost:3456/healthz || exit 1

# 启动命令
CMD ["run", "--allow-net", "--allow-env", "--allow-read", "--allow-write", \
     "src/main.ts"]
