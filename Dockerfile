FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

# Install Playwright browser (Chromium) + OS deps
RUN npx playwright install --with-deps chromium

COPY . .

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm","start"]
