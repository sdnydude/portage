FROM node:20-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace=@portage/api --workspace=@portage/shared --include-workspace-root
COPY packages/shared/ packages/shared/
COPY apps/api/ apps/api/
RUN npm run build -w packages/shared && npm run build -w apps/api

FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace=@portage/api --workspace=@portage/shared --include-workspace-root --omit=dev
COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=builder /app/packages/shared/dist packages/shared/dist
EXPOSE 8016
CMD ["node", "apps/api/dist/index.js"]
