FROM ubuntu:20.04
RUN useradd -ms /bin/bash crawler
RUN apt-get update
ARG DEBIAN_FRONTEND=noninteractive
RUN apt install -y ca-certificates fonts-liberation libatk-bridge2.0-0 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils software-properties-common libasound2
RUN add-apt-repository -y ppa:git-core/ppa
RUN apt update
RUN apt install -y git
RUN rm /bin/sh && ln -s /bin/bash /bin/sh
USER crawler
WORKDIR /home/crawler
RUN git --version

# Install nvm with node and npm
ENV NVM_DIR /home/crawler/.nvm
ENV NODE_VERSION 20
RUN wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
RUN . $NVM_DIR/nvm.sh && nvm install $NODE_VERSION
RUN . $NVM_DIR/nvm.sh && nvm alias default $NODE_VERSION
RUN . $NVM_DIR/nvm.sh && nvm use default
ENV NODE_PATH $NVM_DIR/v$NODE_VERSION/lib/node_modules
ENV PATH      $NVM_DIR/v$NODE_VERSION/bin:$PATH
RUN ls
RUN git clone https://github.com/tosdr/ota-engine engine
RUN git clone https://github.com/tosdr/tosdr-declarations declarations
WORKDIR /home/crawler/declarations
RUN git checkout removals
RUN git pull
RUN git commit-graph write --reachable --changed-paths
WORKDIR /home/crawler/engine
RUN git checkout tosdr-production
RUN ln -s ../declarations/declarations
RUN mkdir data
WORKDIR /home/crawler/engine/data
RUN git clone --depth=1 https://github.com/tosdr/tosdr-versions versions
WORKDIR /home/crawler/engine/data/versions
RUN git commit-graph write --reachable --changed-paths
WORKDIR /home/crawler/engine
ENV CACHE_BUST=change-me-to-force-rebuild
RUN echo CACHE_BUST=$CACHE_BUST
RUN git pull

RUN . $NVM_DIR/nvm.sh && npm install
CMD . $NVM_DIR/nvm.sh && node server.mjs
