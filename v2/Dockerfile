FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node v2 /app/v2
RUN mkdir /data && chown node:node /data
ENV NODE_ENV=production DATA_DIR=/data PORT=8080
EXPOSE 8080
STOPSIGNAL SIGTERM
CMD ["node","v2/server/main.mjs"]
