# Stage 1. Base
FROM node:lts AS base
WORKDIR /app

# Stage 2. Dependencies
FROM base AS dependencies
COPY package*.json ./
COPY yarn.lock ./
COPY .yarnrc.yml ./
COPY .yarn ./.yarn
RUN yarn install

# Stage 3. TS compilation
FROM dependencies AS build
COPY src /app/src
COPY tsconfig.json /app
RUN yarn run tsc

# Stage 4. Release Image
FROM node:lts-alpine AS release
WORKDIR /app

COPY --from=dependencies /app/package.json   ./
COPY --from=dependencies /app/yarn.lock      ./
COPY --from=dependencies /app/.yarnrc.yml    ./
COPY --from=dependencies /app/.yarn/releases ./.yarn/releases
COPY --from=dependencies /app/.yarn/cache    ./.yarn/cache
COPY --from=dependencies /app/.yarn/plugins  ./.yarn/plugins
RUN yarn install \
 && yarn workspaces focus -A --production \
 && yarn cache clean
COPY --from=build /app/build ./build
COPY public ./public

ENV NODE_ENV=production \
    PORT=8080 \
    BIND_ADDRESS=0.0.0.0 \
    UPLOAD_LIMIT=134217700 \
    LOG_LEVEL=info \
    HOST_DIR=/data

RUN mkdir -p ${HOST_DIR}
VOLUME [ "${HOST_DIR}" ]
EXPOSE ${PORT}

CMD [ "node", "./build/index.js" ]