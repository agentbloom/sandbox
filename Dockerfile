FROM node:22-slim

ARG SANDBOX_BUILD_SHA=unknown
ENV SANDBOX_BUILD_SHA=$SANDBOX_BUILD_SHA

RUN apt-get update && apt-get install -y git curl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN npm install -g @anthropic-ai/claude-code
WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install

COPY tsconfig.json ./
COPY src/ src/
COPY docs/ docs/
RUN pnpm run build

RUN useradd -m sandbox
RUN mkdir -p /workspace && chown sandbox:sandbox /workspace
USER sandbox

ENTRYPOINT ["node", "dist/index.js"]
