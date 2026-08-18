import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";

const COLORS = {
  violet: 0x8b5cf6,
  blue: 0x38bdf8,
  green: 0x34d399,
  pink: 0xf472b6,
  orange: 0xfb923c,
  red: 0xfb7185,
  dark: 0x111827,
};

const truncate = (value, length = 90) =>
  value.length > length ? `${value.slice(0, length - 1)}…` : value;

const duration = (seconds) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return "En directo";
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const remaining = String(total % 60).padStart(2, "0");
  return `${minutes}:${remaining}`;
};

export const baseEmbed = (color = COLORS.violet) =>
  new EmbedBuilder()
    .setColor(color)
    .setTimestamp()
    .setFooter({ text: "MelodyWave • música sin complicaciones" });

export const errorEmbed = (message) =>
  baseEmbed(COLORS.red)
    .setTitle("No pude completar eso")
    .setDescription(message)
    .addFields({
      name: "Sugerencia",
      value: "Prueba con el nombre del artista y la canción, o pega un enlace de YouTube.",
    });

export const infoEmbed = (title, message) =>
  baseEmbed(COLORS.blue).setTitle(title).setDescription(message);

export const nowPlayingEmbed = (track, queue) => {
  const requestedBy = track.requestedBy?.tag || track.requestedBy?.username || "alguien";
  const queueSize = queue.tracks?.size ?? queue.tracks?.length ?? 0;
  return baseEmbed(COLORS.violet)
    .setAuthor({ name: "MelodyWave está reproduciendo" })
    .setTitle(truncate(track.title || "Canción sin título", 150))
    .setURL(track.url)
    .setDescription(track.author ? `**${truncate(track.author, 100)}**` : "Fuente desconocida")
    .setThumbnail(track.thumbnail || null)
    .addFields(
      { name: "Duración", value: duration(track.durationMS ? track.durationMS / 1000 : track.duration), inline: true },
      { name: "Solicitada por", value: requestedBy, inline: true },
      { name: "En cola", value: String(queueSize), inline: true },
    );
};

export const controlsRow = (isPaused = false) =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(isPaused ? "music:resume" : "music:pause")
      .setLabel(isPaused ? "Reanudar" : "Pausa")
      .setEmoji(isPaused ? "▶️" : "⏸️")
      .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("music:skip")
      .setLabel("Siguiente")
      .setEmoji("⏭️")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("music:queue")
      .setLabel("Cola")
      .setEmoji("📋")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("music:loop")
      .setLabel("Repetir")
      .setEmoji("🔁")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("music:stop")
      .setLabel("Detener")
      .setEmoji("⏹️")
      .setStyle(ButtonStyle.Danger),
  );

export const searchResultEmbed = (query, tracks) =>
  baseEmbed(COLORS.pink)
    .setTitle("Elige una canción")
    .setDescription(`Resultados para **${truncate(query, 100)}**\nPulsa un botón para agregarla a la cola.`)
    .addFields({
      name: "Encontradas",
      value: tracks
        .map((track, index) => `**${index + 1}.** ${truncate(track.title || "Sin título", 65)} — \`${duration(track.durationMS ? track.durationMS / 1000 : track.duration)}\``)
        .join("\n"),
    });

export const searchButtons = (token, tracks) =>
  new ActionRowBuilder().addComponents(
    tracks.slice(0, 5).map((_, index) =>
      new ButtonBuilder()
        .setCustomId(`music:pick:${token}:${index}`)
        .setLabel(`${index + 1}`)
        .setEmoji(index === 0 ? "✨" : "🎵")
        .setStyle(index === 0 ? ButtonStyle.Success : ButtonStyle.Secondary),
    ),
  );

export const queueEmbed = (queue) => {
  const current = queue.currentTrack;
  const upcoming = [...(queue.tracks?.toArray?.() || [])].slice(0, 10);
  const lines = upcoming.length
    ? upcoming.map((track, index) => `**${index + 1}.** ${truncate(track.title || "Sin título", 68)}`).join("\n")
    : "No hay más canciones esperando.";
  return baseEmbed(COLORS.orange)
    .setTitle("Tu cola musical")
    .setDescription(current ? `Ahora: **${truncate(current.title || "Sin título", 100)}**\n\n${lines}` : lines)
    .setFooter({ text: `MelodyWave • ${upcoming.length} en espera` });
};

export const helpEmbed = (brandName) =>
  baseEmbed(COLORS.green)
    .setTitle(`${brandName} • menú`)
    .setDescription("Música clara, controles rápidos y una cola que no se pierde.")
    .addFields(
      { name: "Reproducir", value: "`/play canción o enlace` — busca y reproduce automáticamente." },
      { name: "Buscar", value: "`/search canción` — muestra hasta cinco resultados con botones." },
      { name: "Controles", value: "`/skip` · `/pause` · `/resume` · `/stop` · `/queue` · `/nowplaying`" },
      { name: "Extras", value: "`/volume 1-100` · `/loop off/track/queue`" },
    );

export { COLORS };