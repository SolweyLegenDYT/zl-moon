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
  // Discord expone el Application ID después del login; esta variable queda
  // opcional para que el bot pueda arrancar con solo DISCORD_TOKEN.
  clientId: process.env.DISCORD_CLIENT_ID?.trim() || "",
  guildId: process.env.DISCORD_GUILD_ID?.trim() || "",
  port: Number(process.env.PORT || 8080),
  defaultVolume: Math.min(100, Math.max(1, Number(process.env.DEFAULT_VOLUME || 80))),
  brandName: process.env.BOT_NAME?.trim() || "MelodyWave",
};

if (!Number.isInteger(config.port) || config.port <= 0) {
  throw new Error("PORT debe ser un número entero mayor que 0.");
}