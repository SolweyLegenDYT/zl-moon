import http from "node:http";
import {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
} from "discord.js";
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
  playbackErrorMessage,
} from "./music.js";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

const announce = async (queue, payload) => {
  const channel = queue.textChannel;
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

const music = createMusicService({
  defaultVolume: config.defaultVolume,
  onStart: (queue, track) =>
    announce(queue, {
      embeds: [nowPlayingEmbed(track, queue)],
      components: [controlsRow(queue.node.isPaused())],
    }),
  onError: (queue, error) =>
    announce(queue, { embeds: [errorEmbed(playbackErrorMessage(error))] }),
  onEmpty: (queue) =>
    announce(queue, {
      embeds: [infoEmbed("Cola terminada", "No quedan canciones. Usa `/play` para continuar.")],
    }),
});

const respond = async (interaction, payload) => {
  if (interaction.deferred || interaction.replied) return interaction.editReply(payload);
  return interaction.reply(payload);
};

const playTrack = async (interaction, track) => {
  const voiceChannel = ensureVoiceChannel(interaction);
  const permissions = voiceChannel.permissionsFor(interaction.client.user);
  if (!permissions?.has([
    PermissionsBitField.Flags.Connect,
    PermissionsBitField.Flags.Speak,
  ])) {
    throw new Error("Necesito permisos para conectar y hablar en tu canal de voz.");
  }
  return music.play(interaction.guildId, voiceChannel, interaction.channel, track);
};

const handleButton = async (interaction) => {
  const [, action, token, indexText] = interaction.customId.split(":");

  if (action === "pick") {
    await interaction.deferReply({ ephemeral: true });
    const tracks = music.getSearchTracks(interaction.guildId, interaction.user.id, token);
    const track = tracks?.[Number(indexText)];
    if (!track) {
      return interaction.editReply({
        embeds: [errorEmbed("Ese resultado ya caducó. Vuelve a usar `/search`.")],
      });
    }
    try {
      const queue = await playTrack(interaction, track);
      return interaction.editReply({
        embeds: [infoEmbed("Agregada a la cola", `**${track.title}** ya está lista para sonar.`)],
        components: [controlsRow(queue.node.isPaused())],
      });
    } catch (error) {
      return interaction.editReply({ embeds: [errorEmbed(playbackErrorMessage(error))] });
    }
  }

  const queue = music.getQueue(interaction.guildId);
  if (!queue) {
    return respond(interaction, {
      embeds: [errorEmbed("No hay música sonando en este servidor.")],
      ephemeral: true,
    });
  }

  try {
    if (action === "pause") {
      queue.node.setPaused(true);
      return respond(interaction, {
        embeds: [infoEmbed("Pausa activada", "La música queda en pausa.")],
      });
    }
    if (action === "resume") {
      queue.node.setPaused(false);
      return respond(interaction, {
        embeds: [infoEmbed("De nuevo en marcha", "La música continúa.")],
      });
    }
    if (action === "skip") {
      queue.node.skip();
      return respond(interaction, {
        embeds: [infoEmbed("Siguiente canción", "Saltando a la siguiente pista…")],
      });
    }
    if (action === "stop") {
      queue.delete();
      return respond(interaction, {
        embeds: [infoEmbed("Sesión detenida", "La cola se limpió y salí del canal.")],
      });
    }
    if (action === "queue") return respond(interaction, { embeds: [queueEmbed(queue)] });
    if (action === "loop") {
      const mode = queue.repeatMode === 0 ? 1 : queue.repeatMode === 1 ? 2 : 0;
      queue.setRepeatMode(mode);
      return respond(interaction, {
        embeds: [infoEmbed("Repetición actualizada", ["Desactivada", "Canción actual", "Toda la cola"][mode])],
      });
    }
  } catch (error) {
    return respond(interaction, {
      embeds: [errorEmbed(playbackErrorMessage(error))],
      ephemeral: true,
    });
  }
};

const handleCommand = async (interaction) => {
  const name = interaction.commandName;
  if (name === "help") return respond(interaction, { embeds: [helpEmbed(config.brandName)] });

  if (name === "search") {
    await interaction.deferReply();
    const query = interaction.options.getString("cancion", true);
    const tracks = await music.search(query, interaction.user);
    if (!tracks.length) {
      return interaction.editReply({
        embeds: [errorEmbed("No encontré resultados. Prueba con `artista - canción`.")],
      });
    }
    const token = music.searchToken(interaction.guildId, interaction.user.id, tracks);
    return interaction.editReply({
      embeds: [searchResultEmbed(query, tracks)],
      components: [searchButtons(token, tracks)],
    });
  }

  if (["play", "skip", "pause", "resume", "stop", "queue", "nowplaying", "volume", "loop"].includes(name)) {
    await interaction.deferReply();
  }

  if (name === "play") {
    const query = interaction.options.getString("cancion", true);
    try {
      const tracks = await music.search(query, interaction.user);
      if (!tracks.length) {
        return interaction.editReply({
          embeds: [errorEmbed("No encontré esa canción. Prueba con el nombre del artista y la canción.")],
        });
      }
      const queue = await playTrack(interaction, tracks[0]);
      return interaction.editReply({
        embeds: [
          infoEmbed("Añadida a la cola", `**${tracks[0].title}** ya está lista para sonar.`),
          nowPlayingEmbed(queue.currentTrack, queue),
        ],
        components: [controlsRow(queue.node.isPaused())],
      });
    } catch (error) {
      return interaction.editReply({ embeds: [errorEmbed(playbackErrorMessage(error))] });
    }
  }

  const queue = music.getQueue(interaction.guildId);
  if (!queue) {
    return interaction.editReply({
      embeds: [errorEmbed("No hay música sonando en este servidor.")],
    });
  }

  try {
    if (name === "skip") {
      queue.node.skip();
      return interaction.editReply({ embeds: [infoEmbed("Siguiente canción", "Saltando a la siguiente pista…")] });
    }
    if (name === "pause") {
      queue.node.setPaused(true);
      return interaction.editReply({
        embeds: [infoEmbed("Pausa activada", "La música queda en pausa."), nowPlayingEmbed(queue.currentTrack, queue)],
        components: [controlsRow(true)],
      });
    }
    if (name === "resume") {
      queue.node.setPaused(false);
      return interaction.editReply({
        embeds: [infoEmbed("Reproducción reanudada", "La música continúa."), nowPlayingEmbed(queue.currentTrack, queue)],
        components: [controlsRow(false)],
      });
    }
    if (name === "stop") {
      queue.delete();
      return interaction.editReply({ embeds: [infoEmbed("Sesión detenida", "La cola se limpió y salí del canal.")] });
    }
    if (name === "queue") return interaction.editReply({ embeds: [queueEmbed(queue)] });
    if (name === "nowplaying") {
      return interaction.editReply({
        embeds: [nowPlayingEmbed(queue.currentTrack, queue)],
        components: [controlsRow(queue.node.isPaused())],
      });
    }
    if (name === "volume") {
      const volume = interaction.options.getInteger("nivel", true);
      queue.node.setVolume(volume);
      return interaction.editReply({ embeds: [infoEmbed("Volumen actualizado", `Ahora está en **${volume}%**.`)] });
    }
    if (name === "loop") {
      const modeName = interaction.options.getString("modo", true);
      const mode = { off: 0, track: 1, queue: 2 }[modeName];
      queue.setRepeatMode(mode);
      return interaction.editReply({
        embeds: [infoEmbed("Repetición actualizada", { 0: "Desactivada", 1: "Canción actual", 2: "Toda la cola" }[mode])],
      });
    }
  } catch (error) {
    return interaction.editReply({ embeds: [errorEmbed(playbackErrorMessage(error))] });
  }
};

client.once("clientReady", async (readyClient) => {
  console.info(`Conectado como ${readyClient.user.tag}`);
  await registerCommands({
    ...config,
    clientId: config.clientId || readyClient.application.id,
  });
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;
  try {
    if (interaction.isButton()) await handleButton(interaction);
    else await handleCommand(interaction);
  } catch (error) {
    console.error("Error manejando interacción:", error);
    const payload = {
      embeds: [errorEmbed("Ocurrió un error inesperado. Inténtalo de nuevo en unos segundos.")],
      ephemeral: true,
    };
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

await client.login(config.token);

const shutdown = (signal) => {
  console.info(`Recibido ${signal}; cerrando MelodyWave…`);
  server.close();
  music.getQueue && [...client.guilds.cache.keys()].forEach((guildId) => music.getQueue(guildId)?.delete());
  client.destroy();
};

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));

export { commandDefinitions };