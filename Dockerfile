# ================================
# Finance Memorandum Generator
# Node + Playwright + LaTeX (Tectonic) + Fonts
# Render-compatible with debug verification
# ================================

FROM node:20-bookworm-slim

# ------------------------
# System dependencies
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
# Fonts
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
RUN npm install --production

RUN npx playwright install --with-deps chromium

COPY . .

# ------------------------
# DEBUG: Print server/index.js inside container
# This proves what Render is actually running
# ------------------------
RUN echo "==============================" \
 && echo "DEBUG: server/index.js top 20 lines" \
 && echo "==============================" \
 && sed -n '1,20p' server/index.js \
 && echo "==============================" \
 && echo "DEBUG: Searching for bad express imports" \
 && echo "==============================" \
 && grep -R "node_modules/express" -n . || true

# ------------------------
# Runtime
# ------------------------
ENV NODE_ENV=production
ENV PORT=10000

EXPOSE 10000

CMD ["npm", "start"]
