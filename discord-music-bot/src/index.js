import http from "node:http";
import ffmpegPath from "ffmpeg-static";
import {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
} from "discord.js";
import { Player } from "discord-player";
import { DefaultExtractors } from "@discord-player/extractor";
import { config } from "./config.js";
import { commandDefinitions, registerCommands } from "./commands.js";
import {
  controlsRow,
  errorEmbed,
  helpEmbed,
  infoEmbed,
  nowPlayingEmbed,
  queueEmbed,
  searchButtons,
  searchResultEmbed,
} from "./ui.js";
import {
  createMusicService,
  ensureVoiceChannel,
  getQueue,
  playbackErrorMessage,
} from "./music.js";

if (ffmpegPath) process.env.FFMPEG_PATH ||= ffmpegPath;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});
const player = new Player(client);
const music = createMusicService(player);
const respond = async (interaction, payload) => {
  if (interaction.deferred || interaction.replied) return interaction.editReply(payload);
  return interaction.reply(payload);
};

const channelForQueue = (queue) => queue?.metadata?.send ? queue.metadata : null;

const announce = async (queue, payload) => {
  const channel = channelForQueue(queue);
  if (!channel) return;
  try {
    const message = await channel.send(payload);
    if (message?.deletable) {
      setTimeout(() => message.delete().catch(() => {}), 45_000);
    }
  } catch (error) {
    console.warn("No se pudo enviar el anuncio de reproducción:", error.message);
  }
};

const playbackOptions = (interaction) => ({
  nodeOptions: {
    metadata: interaction.channel,
    leaveOnEmpty: true,
    leaveOnEnd: false,
    leaveOnStop: true,
    bufferingTimeout: 15_000,
    volume: config.defaultVolume,
  },
  requestedBy: interaction.user,
});

const playTrack = async (interaction, track) => {
  const voiceChannel = ensureVoiceChannel(interaction);
  const permissions = voiceChannel.permissionsFor(interaction.client.user);
  if (!permissions?.has([PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak])) {
    throw new Error("Necesito permisos para conectar y hablar en tu canal de voz.");
  }
  const result = await player.play(voiceChannel, track, playbackOptions(interaction));
  return result.track;
};

const queuePayload = (queue) => ({
  embeds: [nowPlayingEmbed(queue.currentTrack, queue)],
  components: [controlsRow(queue.node.isPaused())],
});

const handleButton = async (interaction) => {
  const [namespace, action, token, indexText] = interaction.customId.split(":");
  if (namespace !== "music") return;
  const queue = getQueue(player, interaction.guildId);

  if (action === "pick") {
    await interaction.deferReply({ ephemeral: true });
    const tracks = music.getSearchTracks(interaction.guildId, interaction.user.id, token);
    const track = tracks?.[Number(indexText)];
    if (!track) return interaction.editReply({ embeds: [errorEmbed("Ese resultado ya caducó. Vuelve a usar `/search`.")] });
    try {
      await playTrack(interaction, track);
      return interaction.editReply({ embeds: [infoEmbed("Agregada a la cola", `**${track.title}** ya está lista para sonar.`)] });
    } catch (error) {
      return interaction.editReply({ embeds: [errorEmbed(playbackErrorMessage(error))] });
    }
  }

  if (!queue) {
    return respond(interaction, { embeds: [errorEmbed("No hay música sonando en este servidor.")], ephemeral: true });
  }

  try {
    if (action === "pause") {
      queue.node.setPaused(true);
      return respond(interaction, { embeds: [infoEmbed("Pausa activada", "La música queda en pausa.")] });
    }
    if (action === "resume") {
      queue.node.setPaused(false);
      return respond(interaction, { embeds: [infoEmbed("De nuevo en marcha", "La música continúa.")] });
    }
    if (action === "skip") {
      await queue.node.skip();
      return respond(interaction, { embeds: [infoEmbed("Siguiente canción", "Saltando a la siguiente pista…")] });
    }
    if (action === "stop") {
      queue.delete();
      return respond(interaction, { embeds: [infoEmbed("Sesión detenida", "La cola se limpió y salí del canal.")] });
    }
    if (action === "queue") return respond(interaction, { embeds: [queueEmbed(queue)] });
    if (action === "loop") {
      const mode = queue.repeatMode === 0 ? 1 : queue.repeatMode === 1 ? 2 : 0;
      queue.setRepeatMode(mode);
      return respond(interaction, { embeds: [infoEmbed("Repetición actualizada", ["Desactivada", "Canción actual", "Toda la cola"][mode])] });
    }
  } catch (error) {
    return respond(interaction, { embeds: [errorEmbed(playbackErrorMessage(error))], ephemeral: true });
  }
};

const handleCommand = async (interaction) => {
  const name = interaction.commandName;
  if (name === "help") return respond(interaction, { embeds: [helpEmbed(config.brandName)] });
  if (name === "search") {
    await interaction.deferReply();
    const query = interaction.options.getString("cancion", true);
    const tracks = await music.search(query, interaction.user);
    if (!tracks.length) return interaction.editReply({ embeds: [errorEmbed("No encontré resultados. Prueba con `artista - canción` o un enlace de YouTube.")] });
    const token = music.searchToken(interaction.guildId, interaction.user.id, tracks);
    return interaction.editReply({ embeds: [searchResultEmbed(query, tracks)], components: [searchButtons(token, tracks)] });
  }

  if (["play", "skip", "pause", "resume", "stop", "queue", "nowplaying", "volume", "loop"].includes(name)) {
    await interaction.deferReply();
  }

  if (name === "play") {
    const query = interaction.options.getString("cancion", true);
    try {
      const tracks = await music.search(query, interaction.user);
      if (!tracks.length) return interaction.editReply({ embeds: [errorEmbed("No encontré esa canción. Prueba con un enlace directo de YouTube.")] });
      const track = await playTrack(interaction, tracks[0]);
      const queue = getQueue(player, interaction.guildId);
      return interaction.editReply({
        embeds: [infoEmbed("Añadida a la cola", `**${track.title}**${queue?.currentTrack?.title === track.title ? " comenzó a sonar." : " quedó esperando."}`), nowPlayingEmbed(queue.currentTrack, queue)],
        components: [controlsRow(queue.node.isPaused())],
      });
    } catch (error) {
      return interaction.editReply({ embeds: [errorEmbed(playbackErrorMessage(error))] });
    }
  }

  const queue = getQueue(player, interaction.guildId);
  if (!queue) return interaction.editReply({ embeds: [errorEmbed("No hay música sonando en este servidor.")] });

  try {
    if (name === "skip") {
      await queue.node.skip();
      return interaction.editReply({ embeds: [infoEmbed("Siguiente canción", "Saltando a la siguiente pista…")] });
    }
    if (name === "pause") {
      queue.node.setPaused(true);
      return interaction.editReply({ embeds: [infoEmbed("Pausa activada", "La música queda en pausa."), nowPlayingEmbed(queue.currentTrack, queue)], components: [controlsRow(true)] });
    }
    if (name === "resume") {
      queue.node.setPaused(false);
      return interaction.editReply({ embeds: [infoEmbed("Reproducción reanudada", "La música continúa."), nowPlayingEmbed(queue.currentTrack, queue)], components: [controlsRow(false)] });
    }
    if (name === "stop") {
      queue.delete();
      return interaction.editReply({ embeds: [infoEmbed("Sesión detenida", "La cola se limpió y salí del canal.")] });
    }
    if (name === "queue") return interaction.editReply({ embeds: [queueEmbed(queue)] });
    if (name === "nowplaying") return interaction.editReply(queuePayload(queue));
    if (name === "volume") {
      const volume = interaction.options.getInteger("nivel", true);
      queue.node.setVolume(volume);
      return interaction.editReply({ embeds: [infoEmbed("Volumen actualizado", `Ahora está en **${volume}%**.`)] });
    }
    if (name === "loop") {
      const modeName = interaction.options.getString("modo", true);
      const mode = { off: 0, track: 1, queue: 2 }[modeName];
      queue.setRepeatMode(mode);
      return interaction.editReply({ embeds: [infoEmbed("Repetición actualizada", { 0: "Desactivada", 1: "Canción actual", 2: "Toda la cola" }[mode])] });
    }
  } catch (error) {
    return interaction.editReply({ embeds: [errorEmbed(playbackErrorMessage(error))] });
  }
};

player.events.on("playerStart", async (queue, track) => {
  await announce(queue, { embeds: [nowPlayingEmbed(track, queue)], components: [controlsRow(false)] });
});

player.events.on("playerError", async (queue, error) => {
  console.warn("Error de reproducción:", error.message);
  await announce(queue, { embeds: [errorEmbed(playbackErrorMessage(error))] });
});

player.events.on("emptyQueue", async (queue) => {
  await announce(queue, { embeds: [infoEmbed("Cola terminada", "No quedan canciones. Puedes usar `/play` para continuar.")] });
});

client.once("ready", async (readyClient) => {
  console.info(`Conectado como ${readyClient.user.tag}`);
  await registerCommands(config);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;
  try {
    if (interaction.isButton()) await handleButton(interaction);
    else await handleCommand(interaction);
  } catch (error) {
    console.error("Error manejando interacción:", error);
    const payload = { embeds: [errorEmbed("Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.")], ephemeral: true };
    if (interaction.deferred || interaction.replied) await interaction.editReply(payload).catch(() => {});
    else await interaction.reply(payload).catch(() => {});
  }
});

const server = http.createServer((request, response) => {
  if (request.url === "/health" || request.url === "/") {
    response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ status: "ok", bot: client.isReady() ? "ready" : "starting" }));
    return;
  }
  response.writeHead(404);
  response.end();
});

server.listen(config.port, "0.0.0.0", () => {
  console.info(`Healthcheck disponible en el puerto ${config.port}`);
});

await player.extractors.loadMulti(DefaultExtractors);
await client.login(config.token);

const shutdown = async (signal) => {
  console.info(`Recibido ${signal}; cerrando MelodyWave…`);
  server.close();
  client.destroy();
};

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));

export { commandDefinitions };