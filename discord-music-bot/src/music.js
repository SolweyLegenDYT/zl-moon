import { QueryType } from "discord-player";
import ytSearch from "yt-search";

const searchOptions = (requestedBy) => ({
  requestedBy,
  searchEngine: QueryType.AUTO,
});

export const createMusicService = (player) => {
  const searches = new Map();

  const rememberSearch = (key, tracks) => {
    const token = Math.random().toString(36).slice(2, 10);
    searches.set(`${key}:${token}`, { tracks, expiresAt: Date.now() + 5 * 60_000 });
    return token;
  };

  const getSearch = (key, token) => {
    const value = searches.get(`${key}:${token}`);
    if (!value || value.expiresAt < Date.now()) {
      searches.delete(`${key}:${token}`);
      return null;
    }
    return value.tracks;
  };

  const search = async (query, requestedBy) => {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    try {
      const result = await player.search(cleanQuery, searchOptions(requestedBy));
      if (result.hasTracks()) return result.tracks.slice(0, 5);
    } catch (error) {
      console.warn("Búsqueda principal falló; intentando respaldo:", error.message);
    }

    // Respaldo para búsquedas de texto: yt-search encuentra la URL aunque el
    // extractor no pueda resolver el texto directamente.
    if (/^https?:\/\//i.test(cleanQuery)) return [];
    try {
      const fallback = await ytSearch(cleanQuery);
      const firstVideo = fallback.videos?.[0];
      if (!firstVideo?.url) return [];
      const result = await player.search(firstVideo.url, searchOptions(requestedBy));
      return result.hasTracks() ? result.tracks.slice(0, 5) : [];
    } catch (error) {
      console.warn("Búsqueda de respaldo falló:", error.message);
      return [];
    }
  };

  const searchToken = (guildId, userId, tracks) =>
    rememberSearch(`${guildId}:${userId}`, tracks);

  const getSearchTracks = (guildId, userId, token) =>
    getSearch(`${guildId}:${userId}`, token);

  return { search, searchToken, getSearchTracks };
};

export const getQueue = (player, guildId) => player.nodes.get(guildId);

export const ensureVoiceChannel = (interaction) => {
  const voiceChannel = interaction.member?.voice?.channel;
  if (!voiceChannel) {
    throw new Error("Entra primero a un canal de voz para que pueda acompañarte.");
  }
  return voiceChannel;
};

export const playbackErrorMessage = (error) => {
  const message = String(error?.message || error || "").toLowerCase();
  if (message.includes("no results") || message.includes("no track")) {
    return "No encontré esa canción. Prueba con `artista - canción` o pega un enlace directo.";
  }
  if (message.includes("voice") || message.includes("permission")) {
    return "No puedo entrar o hablar en ese canal. Revisa que tenga permisos para conectar y hablar.";
  }
  if (message.includes("sign in") || message.includes("bot") || message.includes("captcha")) {
    return "La fuente rechazó la búsqueda temporalmente. Prueba con un enlace de YouTube o con otra canción.";
  }
  return "La fuente no respondió a tiempo. Inténtalo otra vez; si continúa, prueba con un enlace directo.";
};