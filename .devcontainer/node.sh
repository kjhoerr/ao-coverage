#!/bin/bash
export NVM_DIR="/usr/local/share/nvm"
export NODE_VERSION="lts"
export NVM_VERSION="0.38.0"

USERNAME="node"

updaterc() {
    echo "Updating /etc/bash.bashrc and /etc/zsh/zshrc..."
    echo -e "$1" >> /etc/bash.bashrc
    if [ -f "/etc/zsh/zshrc" ]; then
        echo -e "$1" >> /etc/zsh/zshrc
    fi
}

# Function to run apt-get if needed
apt_get_update_if_needed()
{
    if [ ! -d "/var/lib/apt/lists" ] || [ "$(ls /var/lib/apt/lists/ | wc -l)" = "0" ]; then
        echo "Running apt-get update..."
        apt-get update
    else
        echo "Skipping apt-get update."
    fi
}

# Checks if packages are installed and installs them if not
check_packages() {
    if ! dpkg -s "$@" > /dev/null 2>&1; then
        apt_get_update_if_needed
        apt-get -y install --no-install-recommends "$@"
    fi
}

# Ensure apt is in non-interactive to avoid prompts
export DEBIAN_FRONTEND=noninteractive

# Install dependencies
check_packages apt-utils \
        apt-transport-https \
        curl \
        ca-certificates \
        tar \
        gnupg2 \
        git \
        openssh-client \
        gnupg2 \
        iproute2 \
        procps \
        lsof \
        htop \
        net-tools \
        psmisc \
        curl \
        wget \
        rsync \
        ca-certificates \
        unzip \
        zip \
        nano \
        vim-tiny \
        less \
        jq \
        lsb-release \
        apt-transport-https \
        dialog \
        libc6 \
        libgcc1 \
        libkrb5-3 \
        libgssapi-krb5-2 \
        libicu[0-9][0-9] \
        liblttng-ust0 \
        libstdc++6 \
        zlib1g \
        locales \
        sudo \
        ncdu \
        man-db \
        strace \
        manpages \
        manpages-dev \
        init-system-helpers

# Install yarn
if type yarn > /dev/null 2>&1; then
    echo "Yarn already installed."
else
    # Import key safely (new method rather than deprecated apt-key approach) and install
    curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | gpg --dearmor > /usr/share/keyrings/yarn-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/yarn-archive-keyring.gpg] https://dl.yarnpkg.com/debian/ stable main" > /etc/apt/sources.list.d/yarn.list
    apt-get update
    apt-get -y install --no-install-recommends yarn
fi

# Adjust node version if required
if [ "${NODE_VERSION}" = "none" ]; then
    export NODE_VERSION=
elif [ "${NODE_VERSION}" = "lts" ]; then
    export NODE_VERSION="lts/*"
fi

# Install the specified node version if NVM directory already exists, then exit
if [ -d "${NVM_DIR}" ]; then
    echo "NVM already installed."
    if [ "${NODE_VERSION}" != "" ]; then
       su ${USERNAME} -c ". $NVM_DIR/nvm.sh && nvm install ${NODE_VERSION} && nvm clear-cache"
    fi
    exit 0
fi

# Create nvm group, nvm dir, and set sticky bit
if ! cat /etc/group | grep -e "^nvm:" > /dev/null 2>&1; then
    groupadd -r nvm
fi
umask 0002
usermod -a -G nvm ${USERNAME}
mkdir -p ${NVM_DIR}
chown :nvm ${NVM_DIR}
chmod g+s ${NVM_DIR}
su $USERNAME -c "$(cat << EOF
    set -e
    umask 0002
    # Do not update profile - we'll do this manually
    export PROFILE=/dev/null
    curl -so- https://raw.githubusercontent.com/nvm-sh/nvm/v${NVM_VERSION}/install.sh | bash 
    source ${NVM_DIR}/nvm.sh
    if [ "${NODE_VERSION}" != "" ]; then
        nvm alias default ${NODE_VERSION}
    fi
    nvm clear-cache 
EOF
)" 2>&1
# Update rc files
updaterc "$(cat <<EOF
export NVM_DIR="${NVM_DIR}"
[ -s "\$NVM_DIR/nvm.sh" ] && . "\$NVM_DIR/nvm.sh"
[ -s "\$NVM_DIR/bash_completion" ] && . "\$NVM_DIR/bash_completion"
EOF
)"

echo "Done!"