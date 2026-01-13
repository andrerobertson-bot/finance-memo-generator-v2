# ---------- Base ----------
FROM node:20-bookworm-slim

# ---------- System deps (Playwright + Tectonic + fonts) ----------
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

# ---------- Install fonts (robust, no apt font packages) ----------
RUN mkdir -p /usr/local/share/fonts/custom \
  && curl -L -o /usr/local/share/fonts/custom/Raleway.ttf \
       https://github.com/google/fonts/raw/main/ofl/raleway/Raleway%5Bwght%5D.ttf \
  && curl -L -o /usr/local/share/fonts/custom/Merriweather-Regular.ttf \
       https://github.com/google/fonts/raw/main/ofl/merriweather/Merriweather-Regular.ttf \
  && curl -L -o /usr/local/share/fonts/custom/Merriweather-Bold.ttf \
       https://github.com/google/fonts/raw/main/ofl/merriweather/Merriweather-Bold.ttf \
  && fc-cache -f -v

# ---------- Install Tectonic (self-contained) ----------
# Uses the official installer to place tectonic into /usr/local/bin
RUN curl -fsSL https://drop-sh.fullyjustified.net | sh \
  && mv /root/.cargo/bin/tectonic /usr/local/bin/tectonic

# ---------- App setup ----------
WORKDIR /app

# Install Node dependencies first for better Docker layer caching
COPY package*.json ./
RUN npm ci

# Playwright browsers (needed for Chromium in Render)
# If you already install browsers via npm postinstall in your repo, you can remove this block.
RUN npx playwright install --with-deps chromium

# Copy the rest of the repo
COPY . .

# Build step (only if you have one; harmless if not present)
# If your project doesn't have a build script, you can delete this line.
RUN npm run build || true

# ---------- Runtime ----------
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# If your start script differs, change this to match your repo (e.g. "node server.js")
CMD ["npm", "start"]
