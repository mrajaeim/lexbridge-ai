FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json .npmrc tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
COPY apps/worker ./apps/worker
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci
RUN npm run build:libs && npm run build -w @lexbridge/api
EXPOSE 4000
CMD ["sh", "-c", "npm run migrate -w @lexbridge/database && npm run seed -w @lexbridge/database && node apps/api/dist/main.js"]
