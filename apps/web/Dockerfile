FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json .npmrc tsconfig.base.json ./
COPY packages ./packages
COPY apps/web ./apps/web
COPY apps/api/package.json ./apps/api/package.json
COPY apps/worker/package.json ./apps/worker/package.json
RUN npm ci
ARG NEXT_PUBLIC_API_ORIGIN=http://localhost:4000
ENV NEXT_PUBLIC_API_ORIGIN=$NEXT_PUBLIC_API_ORIGIN
RUN npm run build -w @lexbridge/shared && npm run build -w @lexbridge/web
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "@lexbridge/web"]
