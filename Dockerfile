# Use Playwright base image (includes Chromium deps)
FROM mcr.microsoft.com/playwright:v1.57.0-jammy

WORKDIR /app

# -----------------------------
# System deps: curl + fontconfig + SYSTEM FONTS (no local font files)
# -----------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    fontconfig \
    fonts-raleway \
    fonts-merriweather \
    && rm -rf /var/lib/apt/lists/* \
    && fc-cache -f -v

# -----------------------------
# Install Tectonic (robust install: find the binary)
# -----------------------------
ARG TECTONIC_VERSION=0.15.0
RUN set -eux; \
  arch="$(dpkg --print-architecture)"; \
  case "$arch" in \
    amd64) target="x86_64-unknown-linux-gnu" ;; \
    arm64) target="aarch64-unknown-linux-gnu" ;; \
    *) echo "Unsupported architecture: $arch"; exit 1 ;; \
  esac; \
  url="https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/tectonic-${TECTONIC_VERSION}-${target}.tar.gz"; \
  echo "Downloading $url"; \
  mkdir -p /tmp/tectonic-extract; \
  curl -L -o /tmp/tectonic.tar.gz "$url"; \
  tar -xzf /tmp/tectonic.tar.gz -C /tmp/tectonic-extract; \
  TECTONIC_BIN="$(find /tmp/tectonic-extract -type f -name tectonic -perm -111 | head -n 1)"; \
  test -n "$TECTONIC_BIN"; \
  mv "$TECTONIC_BIN" /usr/local/bin/tectonic; \
  chmod +x /usr/local/bin/tectonic; \
  rm -rf /tmp/tectonic-extract /tmp/tectonic.tar.gz; \
  tectonic --version

# -----------------------------
# App deps
# -----------------------------
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]

