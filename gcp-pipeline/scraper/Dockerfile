FROM node:20-alpine

# Build deps for native addons (pdf-parse uses canvas optionally; not needed here)
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY scraper.js ./

CMD ["node", "scraper.js"]
