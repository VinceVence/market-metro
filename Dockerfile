FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY scripts/marketing/requirements.txt /tmp/requirements.txt
RUN python3 -m venv /opt/market-venv && /opt/market-venv/bin/pip install --no-cache-dir -r /tmp/requirements.txt
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY demo ./demo
COPY scripts ./scripts
COPY benchmark ./benchmark
COPY docs ./docs
RUN mkdir -p .local && ln -s /opt/market-venv .local/marketing-venv && chown node:node .local
ENV NODE_ENV=production PUBLIC_DEMO=true PORT=8080 PYTHONDONTWRITEBYTECODE=1 OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1
USER node
EXPOSE 8080
CMD ["node", "scripts/serve.mjs", "--no-recover"]
