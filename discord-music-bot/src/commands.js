import {
  ApplicationCommandOptionType,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";

const command = (name, description) =>
  new SlashCommandBuilder().setName(name).setDescription(description);

export const commandDefinitions = [
  command("play", "Busca y reproduce una canción o enlace.")
    .addStringOption((option) =>
      option.setName("cancion").setDescription("Nombre de la canción o URL").setRequired(true).setMaxLength(200),
    ),
  command("search", "Busca una canción y muestra resultados con botones.")
    .addStringOption((option) =>
      option.setName("cancion").setDescription("Qué quieres escuchar").setRequired(true).setMaxLength(200),
    ),
  command("skip", "Pasa a la siguiente canción."),
  command("pause", "Pausa la canción actual."),
  command("resume", "Reanuda la canción pausada."),
  command("stop", "Detiene la música y limpia la cola."),
  command("queue", "Muestra la cola del servidor."),
  command("nowplaying", "Muestra la canción actual y sus controles."),
  command("help", "Abre el menú de MelodyWave."),
  command("volume", "Cambia el volumen de 1 a 100.")
    .addIntegerOption((option) =>
      option.setName("nivel").setDescription("Volumen").setRequired(true).setMinValue(1).setMaxValue(100),
    ),
  command("loop", "Configura la repetición.")
    .addStringOption((option) =>
      option
        .setName("modo")
        .setDescription("Qué repetir")
        .setRequired(true)
        .addChoices(
          { name: "Desactivado", value: "off" },
          { name: "Canción actual", value: "track" },
          { name: "Toda la cola", value: "queue" },
        ),
    ),
].map((item) => item.toJSON());

export const registerCommands = async ({ token, clientId, guildId }) => {
  const rest = new REST({ version: "10" }).setToken(token);
  const route = guildId
    ? Routes.applicationGuildCommands(clientId, guildId)
    : Routes.applicationCommands(clientId);
  await rest.put(route, { body: commandDefinitions });
  console.info(guildId ? "Comandos registrados en el servidor de desarrollo." : "Comandos globales registrados.");
};

export const hasManageGuild = (interaction) =>
  interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ?? false;