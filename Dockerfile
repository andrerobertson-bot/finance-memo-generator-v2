# Render / Docker
# Node + Playwright (Chromium) for server-side HTML -> PDF
FROM mcr.microsoft.com/playwright:v1.57.0-jammy

WORKDIR /app

# Install Tectonic (for LaTeX cover rendering) + fontconfig
ARG TECTONIC_VERSION=0.15.0
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates fontconfig \
  && rm -rf /var/lib/apt/lists/* \
  && set -eux; \
     arch="$(dpkg --print-architecture)"; \
     case "$arch" in \
       amd64) target='x86_64-unknown-linux-gnu' ;; \
       arm64) target='aarch64-unknown-linux-gnu' ;; \
       *) echo "Unsupported architecture: $arch"; exit 1 ;; \
     esac; \
     url="https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/tectonic-${TECTONIC_VERSION}-${target}.tar.gz"; \
     echo "Downloading $url"; \
     curl -L -o /tmp/tectonic.tar.gz "$url"; \
     tar -xzf /tmp/tectonic.tar.gz -C /tmp; \
     mv /tmp/tectonic-*/tectonic /usr/local/bin/tectonic; \
     chmod +x /usr/local/bin/tectonic; \
     rm -rf /tmp/tectonic* 

# Install dependencies first (better caching)
COPY package*.json ./
RUN npm install --omit=dev

# Copy the rest of the app
COPY . .

# Download Google Fonts (TTF) into latex/fonts for XeLaTeX fontspec
RUN set -eux; \
  mkdir -p /app/latex/fonts; \
  curl -L -o /app/latex/fonts/Raleway-Regular.ttf https://raw.githubusercontent.com/google/fonts/main/ofl/raleway/static/Raleway-Regular.ttf; \
  curl -L -o /app/latex/fonts/Raleway-Italic.ttf https://raw.githubusercontent.com/google/fonts/main/ofl/raleway/static/Raleway-Italic.ttf; \
  curl -L -o /app/latex/fonts/Raleway-SemiBold.ttf https://raw.githubusercontent.com/google/fonts/main/ofl/raleway/static/Raleway-SemiBold.ttf; \
  curl -L -o /app/latex/fonts/Merriweather-Black.ttf https://raw.githubusercontent.com/google/fonts/main/ofl/merriweather/Merriweather-Black.ttf; \
  curl -L -o /app/latex/fonts/Merriweather-BlackItalic.ttf https://raw.githubusercontent.com/google/fonts/main/ofl/merriweather/Merriweather-BlackItalic.ttf

ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000

CMD ["npm", "start"]
