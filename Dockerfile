# ================================
# Finance Memorandum Generator
# Node + Playwright + LaTeX (Tectonic) + System Fonts
# Render/Docker compatible
# ================================

FROM node:20-bookworm-slim

# ------------------------
# System dependencies (Chromium libs + utilities)
# ------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    fontconfig \
    unzip \
    wget \
    gnupg \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libpango-1.0-0 \
    libcairo2 \
    libdrm2 \
    libgtk-3-0 \
    libx11-6 \
    libxext6 \
    libxrender1 \
  && rm -rf /var/lib/apt/lists/*

# ------------------------
# Install Fonts (Raleway + Merriweather)
# Reliable on Render (no apt font packages)
# ------------------------
RUN mkdir -p /usr/local/share/fonts/custom \
  && curl -L -o /usr/local/share/fonts/custom/Raleway.ttf \
       https://github.com/google/fonts/raw/main/ofl/raleway/Raleway%5Bwght%5D.ttf \
  && curl -L -o /usr/local/share/fonts/custom/Merriweather-Regular.ttf \
       https://github.com/google/fonts/raw/main/ofl/merriweather/Merriweather-Regular.ttf \
  && curl -L -o /usr/local/share/fonts/custom/Merriweather-Bold.ttf \
       https://github.com/google/fonts/raw/main/ofl/merriweather/Merriweather-Bold.ttf \
  && fc-cache -f -v

# ------------------------
# Install Tectonic
# IMPORTANT: drop installer unpacks into CURRENT DIRECTORY (./tectonic)
# ------------------------
RUN curl -fsSL https://drop-sh.fullyjustified.net | sh \
  && chmod +x ./tectonic \
  && mv ./tectonic /usr/local/bin/tectonic \
  && tectonic --version

# ------------------------
# App setup
# ------------------------
WORKDIR /app

COPY package*.json ./
RUN npm ci

# Install Playwright Chromium + deps
RUN npx playwright install --with-deps chromium

# Copy the rest of the repo
COPY . .

# Optional build step (safe if build script doesn't exist)
RUN npm run build || true

# ------------------------
# Runtime
# ------------------------
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
CMD ["npm", "start"]
