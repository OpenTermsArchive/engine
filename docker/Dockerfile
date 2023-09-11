FROM ubuntu:latest

WORKDIR /root

RUN apt-get update \ 
    && apt-get upgrade -y \
    && apt install -y curl \
    && apt install -y git \ 
    && apt-get install -y chromium-browser

RUN curl -fsSL https://deb.nodesource.com/setup_19.x | bash - \
    && apt install -y nodejs

# Add user so we don't need --no-sandbox.
RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
    && mkdir -p /home/pptruser/Downloads \
    && chown -R pptruser:pptruser /home/pptruser

RUN apt-get update \
    && apt-get install -y vim wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
    && sh -c 'echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-khmeros fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/* 

RUN mkdir /home/pptruser/open-terms-archive \
 && mkdir /home/pptruser/open-terms-archive/declarations \
 && mkdir /home/pptruser/open-terms-archive/config \
 && cd /home/pptruser/open-terms-archive

WORKDIR /home/pptruser/open-terms-archive

RUN npm install --save @opentermsarchive/engine \
 && npm install -g npm@latest

COPY declarations/OpenTermsArchive.json /home/pptruser/open-terms-archive/declarations

COPY default.json /home/pptruser/open-terms-archive/config

COPY env /home/pptruser/open-terms-archive/.env

RUN chmod 755 /home/pptruser/open-terms-archive/*.sh

RUN chown -R pptruser:pptruser /home/pptruser/open-terms-archive/

WORKDIR /home/pptruser

# Run everything after as non-privileged user.
USER pptruser

RUN npm i puppeteer \
    && (node -e "require('child_process').execSync(require('puppeteer').executablePath() + ' --credits', {stdio: 'inherit'})" > THIRD_PARTY_NOTICES)

WORKDIR /home/pptruser/open-terms-archive
