# Render / Docker
# Node + Playwright (Chromium) for server-side HTML -> PDF
FROM mcr.microsoft.com/playwright:v1.57.0-jammy

WORKDIR /app

# Install dependencies first (better caching)
COPY package*.json ./
RUN npm ci

# Copy the rest of the app
COPY . .

ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000

CMD ["npm", "start"]
