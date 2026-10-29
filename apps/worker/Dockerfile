FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json .npmrc tsconfig.base.json ./
COPY packages ./packages
COPY apps/api/package.json ./apps/api/package.json
COPY apps/worker ./apps/worker
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci
RUN npm run build:libs && npm run build -w @lexbridge/worker
CMD ["node", "apps/worker/dist/main.js"]
