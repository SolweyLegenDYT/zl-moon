FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg yt-dlp ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY discord-music-bot/package.json discord-music-bot/package.json
RUN pnpm install --frozen-lockfile --prod
COPY discord-music-bot discord-music-bot

CMD ["pnpm", "--filter", "@workspace/discord-music-bot", "start"]