# Portable backend image — used by Railway, Fly.io, ECS, or plain Docker.
# Render deploys via render.yaml instead and does not need this file.
#
# Build from the backend/ directory:
#   docker build -t hospital-api ./backend

FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Drop dev dependencies from the tree we copy forward.
RUN npm prune --omit=dev


FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
# Override with a mounted volume in production, or uploads vanish on restart.
ENV UPLOAD_DIR=/data/uploads

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

RUN mkdir -p /data/uploads && chown -R node:node /data/uploads
USER node

EXPOSE 4000
VOLUME ["/data/uploads"]

# Socket.IO needs the process itself to receive signals, so exec form is used.
CMD ["node", "dist/index.js"]
