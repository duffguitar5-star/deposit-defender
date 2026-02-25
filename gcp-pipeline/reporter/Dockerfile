FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY reporter.js ./

CMD ["node", "reporter.js"]
