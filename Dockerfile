FROM node:20-alpine

WORKDIR /app

# Install root deps
COPY package*.json ./
RUN npm install --production=false

# Install client deps
COPY client/package*.json ./client/
RUN cd client && npm install --production=false

# Build React app (REACT_APP_* vars must be baked in at build time)
COPY client/ ./client/
ARG REACT_APP_STRIPE_PUBLISHABLE_KEY
ARG REACT_APP_API_BASE_URL=""
ENV REACT_APP_STRIPE_PUBLISHABLE_KEY=$REACT_APP_STRIPE_PUBLISHABLE_KEY
ENV REACT_APP_API_BASE_URL=$REACT_APP_API_BASE_URL
RUN cd client && npm run build

# Install server deps
COPY server/package*.json ./server/
RUN cd server && npm install --production

# Copy server source
COPY server/ ./server/

CMD ["node", "server/src/server.js"]
