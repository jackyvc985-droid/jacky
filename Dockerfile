FROM node:22-slim
WORKDIR /app
COPY server ./server
COPY src/domain ./src/domain
ENV DATA_DIR=/data PORT=8787
VOLUME /data
EXPOSE 8787
CMD ["node", "--experimental-strip-types", "--disable-warning=ExperimentalWarning", "server/index.ts"]
