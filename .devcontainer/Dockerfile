# MongoDB doesn't provide devtools for Debian, so we adapt Ubuntu to use nodejs and MongoDB
FROM ubuntu:bionic

# Install needed packages, yarn, nvm and setup non-root user
RUN groupadd --gid 1000 node \
  && useradd --uid 1000 --gid node --shell /bin/bash --create-home node
COPY node.sh ./
RUN chmod +x ./node.sh
RUN ./node.sh

# Install MongoDB command line tools
ARG MONGO_TOOLS_VERSION=4.2
RUN curl -sSL "https://www.mongodb.org/static/pgp/server-${MONGO_TOOLS_VERSION}.asc" | (OUT=$(apt-key add - 2>&1) || echo $OUT) \
    && echo "deb http://repo.mongodb.org/apt/ubuntu bionic/mongodb-org/${MONGO_TOOLS_VERSION} multiverse" | tee /etc/apt/sources.list.d/mongodb-org-${MONGO_TOOLS_VERSION}.list \
    && apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get install -y mongodb-org-tools mongodb-org-shell \
    && apt-get clean -y && rm -rf /var/lib/apt/lists/*

# Update args in docker-compose.yaml to set the UID/GID of the "node" user
ARG USER_UID=1000
ARG USER_GID=$USER_UID
RUN if [ "$USER_GID" != "1000" ] || [ "$USER_UID" != "1000" ]; then groupmod --gid $USER_GID node && usermod --uid $USER_UID --gid $USER_GID node; fi

# create host directory for reports and assign it to a volume
ARG HOST_DIR=/dist
RUN mkdir -p $HOST_DIR
RUN chown $USER_UID:$USER_GID $HOST_DIR
VOLUME [ "${HOST_DIR}" ]
ENV HOST_DIR=${HOST_DIR}
