# Stage 1. Base
FROM node:carbon AS base
WORKDIR /app

# Stage 2. Dependencies
FROM base AS dependencies
COPY package*.json ./
RUN npm install

# Stage 3. TS compilation
FROM dependencies AS build
COPY src /app/src
COPY tsconfig.json /app
RUN npm run tsc

# Stage 4. Release Image
FROM node:alpine AS release
WORKDIR /app

COPY --from=dependencies /app/package.json ./
RUN npm install --only=production
COPY --from=build /app/build ./build
COPY public ./public

ENV NODE_ENV=production \
    PORT=8080 \
    BIND_ADDRESS=0.0.0.0 \
    UPLOAD_LIMIT=134217700 \
    LOG_LEVEL=info \
    HOST_DIR=/data

RUN mkdir -p ${HOST_DIR}
VOLUME [ ${HOST_DIR} ]
EXPOSE ${PORT}

CMD [ "node", "./build/index.js" ]