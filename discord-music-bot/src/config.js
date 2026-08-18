import "dotenv/config";

const required = (key) => {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Falta la variable de entorno requerida: ${key}`);
  }
  return value;
};

export const config = {
  token: required("DISCORD_TOKEN"),
  clientId: required("DISCORD_CLIENT_ID"),
  guildId: process.env.DISCORD_GUILD_ID?.trim() || "",
  port: Number(process.env.PORT || 8080),
  defaultVolume: Math.min(100, Math.max(1, Number(process.env.DEFAULT_VOLUME || 80))),
  brandName: process.env.BOT_NAME?.trim() || "MelodyWave",
};

if (!Number.isInteger(config.port) || config.port <= 0) {
  throw new Error("PORT debe ser un número entero mayor que 0.");
}