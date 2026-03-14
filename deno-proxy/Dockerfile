# 使用 Alpine 基础镜像（腾讯云镜像有缓存）
FROM alpine:3.19

# 安装 Deno
RUN apk add --no-cache curl unzip && \
    curl -fsSL https://deno.land/x/install/install.sh | sh && \
    mv /root/.deno/bin/deno /usr/local/bin/ && \
    apk del curl unzip && \
    rm -rf /root/.deno

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

# 启动命令 - 限制内存使用
CMD ["run", "--allow-net", "--allow-env", "--allow-read", "--allow-write", \
     "--v8-flags=--max-old-space-size=128", \
     "src/main.ts"]
