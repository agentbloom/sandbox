FROM node:22-slim

RUN apt-get update && apt-get install -y git curl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install -g @anthropic-ai/claude-code
RUN curl -L https://fly.io/install.sh | sh
ENV PATH="/root/.fly/bin:${PATH}"

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install

COPY tsconfig.json ./
COPY src/ src/
COPY docs/ docs/
RUN pnpm run build

ENTRYPOINT ["node", "dist/index.js"]
