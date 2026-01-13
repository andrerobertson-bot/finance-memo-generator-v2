# Render / Docker
# Node + Playwright (Chromium) for server-side HTML -> PDF
FROM mcr.microsoft.com/playwright:v1.48.2-jammy

WORKDIR /app

# Install font families used by the reference memo (best-effort match)
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    fonts-raleway \
    fonts-open-sans \
    fonts-dejavu-core \
    fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies first (better caching)
COPY package*.json ./
RUN npm ci

# Copy the rest of the app
COPY . .

ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000

CMD ["npm", "start"]
