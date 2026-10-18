FROM node:24-bookworm-slim AS builder
WORKDIR /toolchain
RUN npm install --ignore-scripts --no-audit --no-fund esbuild@0.28.0
WORKDIR /build
COPY lib /build/lib
COPY app/api/workspace/route.ts /build/app/api/workspace/route.ts
COPY android-standalone/runtime/adapt-source.mjs /build/android-standalone/runtime/adapt-source.mjs
COPY cloud-server/build-server.mjs /build/cloud-server/build-server.mjs
ENV NOVEL_ESBUILD_ENTRY=/toolchain/node_modules/esbuild/lib/main.js
RUN node cloud-server/build-server.mjs
FROM node:24-bookworm-slim
WORKDIR /app
RUN mkdir /data && chown node:node /data
COPY --chown=node:node cloud-server /app/cloud-server
COPY --chown=node:node lib/execution-policy.mjs /app/lib/execution-policy.mjs
COPY --from=builder --chown=node:node /build/cloud-server/generated /app/cloud-server/generated
ENV NODE_ENV=production DATA_DIR=/data PORT=8080
EXPOSE 8080
STOPSIGNAL SIGTERM
CMD ["node","cloud-server/entry.mjs"]
