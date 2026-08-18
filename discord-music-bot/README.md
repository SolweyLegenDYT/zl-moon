# MelodyWave

Bot de música para Discord con una interfaz visual dentro de Discord: embeds coloridos, botones de pausa, siguiente, cola, repetición y detener. Busca canciones por texto o enlace, reproduce en el canal de voz y mantiene una cola independiente por servidor.

## Funciones

- `/play canción o enlace`: búsqueda y reproducción automática.
- `/search canción`: hasta cinco resultados con botones para elegir.
- Cola por servidor con `/queue`.
- Botones interactivos: pausa/reanudar, siguiente, cola, repetir y detener.
- `/volume` y `/loop` para controlar la sesión.
- Mensajes de error legibles y búsqueda de respaldo para evitar fallos por consultas ambiguas.
- Healthcheck HTTP en `/health` para Railway.
- Sin base de datos y sin almacenamiento de tokens en el código.

## Configuración de Discord

1. Crea una aplicación en el [Discord Developer Portal](https://discord.com/developers/applications).
2. En **Bot**, copia el token y guárdalo como `DISCORD_TOKEN`.
3. Copia el **Application ID** y guárdalo como `DISCORD_CLIENT_ID`.
4. Invita el bot con los scopes `bot` y `applications.commands`. Dale permisos de conectar, hablar, ver canales y enviar mensajes.
5. Para desarrollo rápido, define `DISCORD_GUILD_ID`. Si lo omites, los comandos se registran globalmente y Discord puede tardar en mostrarlos.

## Ejecutar localmente

```bash
pnpm install
cp discord-music-bot/.env.example discord-music-bot/.env
pnpm --filter @workspace/discord-music-bot start
```

## Railway

Configura el proyecto para desplegar desde este repositorio. Railway usará `discord-music-bot/Dockerfile` y el `railway.json` de la raíz.

Variables requeridas:

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID` (opcional; el bot puede obtenerlo automáticamente después de iniciar sesión)

Variables opcionales:

- `DISCORD_GUILD_ID`
- `DEFAULT_VOLUME` (1-100, por defecto 80)
- `BOT_NAME` (por defecto MelodyWave)
- `PORT` (Railway la inyecta automáticamente)

No subas el archivo `.env`; usa las variables secretas de Railway.

## Descripción del repositorio

MelodyWave es un bot de música para Discord con búsqueda tolerante a fallos, reproducción en canales de voz, cola por servidor y controles interactivos mediante botones coloridos. Está preparado para ejecutarse en Railway con Docker, healthcheck y reinicio automático.