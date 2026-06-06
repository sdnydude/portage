FROM node:20-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --workspace=@portage/web --workspace=@portage/shared --include-workspace-root
COPY tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY apps/web/ apps/web/
ARG NEXT_PUBLIC_API_URL=https://portage-api.digitalharmonyai.com
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build -w packages/shared && npm run build -w apps/web

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
ARG GIT_SHA=unknown
ENV GIT_SHA=$GIT_SHA
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
