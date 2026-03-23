FROM node:22-slim

RUN apt-get update && apt-get install -y git curl && rm -rf /var/lib/apt/lists/*
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src/ src/
COPY docs/ docs/
RUN npm run build

ENTRYPOINT ["node", "dist/index.js"]
