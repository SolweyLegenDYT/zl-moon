# MelodyWave Discord Music Bot

Bot de música para Discord con búsqueda, reproducción, cola y controles interactivos con botones, preparado para Railway.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/discord-music-bot start` — run the Discord music bot
- `pnpm --filter @workspace/discord-music-bot check` — validate bot JavaScript syntax
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `discord-music-bot/src/` — comandos, UI de embeds/botones, búsqueda y reproducción
- `discord-music-bot/README.md` — configuración de Discord, Railway y descripción del repositorio
- `discord-music-bot/Dockerfile` — imagen Railway con FFmpeg

## Architecture decisions

- La reproducción usa Discord Player con extractores de YouTube y SoundCloud.
- La búsqueda por texto tiene un respaldo con `yt-search` para resolver consultas ambiguas.
- La cola vive en memoria por servidor; no se necesita base de datos para operar el bot.
- El healthcheck HTTP permite que Railway supervise el proceso aunque la funcionalidad principal sea un bot de Discord.

## Product

MelodyWave ofrece una experiencia musical dentro de Discord: slash commands para buscar y reproducir, embeds coloridos, botones para controlar la sesión y mensajes claros cuando una fuente no responde.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `DISCORD_CLIENT_ID` es obligatorio para registrar los comandos.
- `DISCORD_GUILD_ID` es recomendable durante el desarrollo para que los comandos aparezcan casi al instante.
- Los tokens se configuran como secretos de entorno; nunca se guardan en Git.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
