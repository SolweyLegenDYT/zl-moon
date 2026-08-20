import { spawn } from "node:child_process";
import { createAudioPlayer, createAudioResource, entersState, joinVoiceChannel, NoSubscriberBehavior, StreamType, VoiceConnectionStatus, AudioPlayerStatus } from "@discordjs/voice";
import ytSearch from "yt-search";

const isUrl = (value) => /^https?:\/\//i.test(value);

const normalizeVideo = (video, requestedBy) => ({
  title: video.title || "Canción sin título",
  url: video.url,
  author: video.author?.name || video.author || "YouTube",
  duration: video.timestamp || "En directo",
  thumbnail: video.thumbnail || null,
  requestedBy,
});

const directTrack = (url, requestedBy) => ({
  title: url,
  url,
  author: "Enlace directo",
  duration: "En directo",
  thumbnail: null,
  requestedBy,
});

export const createMusicService = ({ onStart, onError, onEmpty, defaultVolume = 80 }) => {
  const queues = new Map();
  const searches = new Map();

  const cleanupProcess = (queue) => {
    if (queue.process && !queue.process.killed) queue.process.kill("SIGTERM");
    queue.process = null;
  };

  const advance = async (queue) => {
    if (queue.deleted || queue.starting) return;
    queue.starting = true;
    cleanupProcess(queue);

    if (queue.currentTrack) {
      if (queue.repeatMode === 1) queue.tracks.unshift(queue.currentTrack);
      if (queue.repeatMode === 2) queue.tracks.push(queue.currentTrack);
    }

    const nextTrack = queue.tracks.shift();
    if (!nextTrack) {
      queue.currentTrack = null;
      queue.starting = false;
      await onEmpty?.(queue);
      return;
    }

    queue.currentTrack = nextTrack;
    const process = spawn(
      "yt-dlp",
      [
        "--no-playlist",
        "--quiet",
        "--no-warnings",
        "--no-progress",
        "--extractor-args",
        "youtube:player_client=android",
        "-f",
        "bestaudio[ext=webm]/bestaudio/best",
        "-o",
        "-",
        nextTrack.url,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    queue.process = process;
    let errorText = "";
    process.stderr.on("data", (chunk) => {
      errorText += chunk.toString();
    });
    process.once("error", async (error) => {
      queue.starting = false;
      await onError?.(queue, error);
    });
    process.once("close", (code) => {
      if (code && !queue.deleted) {
        onError?.(queue, new Error(errorText.trim() || `yt-dlp terminó con código ${code}`));
      }
    });

    const resource = createAudioResource(process.stdout, {
      inputType: StreamType.WebmOpus,
      inlineVolume: true,
    });
    resource.volume?.setVolume(queue.volume / 100);
    queue.resource = resource;
    queue.audioPlayer.play(resource);
    queue.starting = false;
    await onStart?.(queue, nextTrack);
  };

  const createQueue = (guildId, voiceChannel, textChannel) => {
    const audioPlayer = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Play },
    });
    const queue = {
      guildId,
      voiceChannel,
      textChannel,
      connection: null,
      audioPlayer,
      process: null,
      resource: null,
      tracks: [],
      currentTrack: null,
      repeatMode: 0,
      volume: defaultVolume,
      starting: false,
      deleted: false,
      node: {
        isPaused: () => audioPlayer.state.status === AudioPlayerStatus.Paused,
        setPaused: (paused) => (paused ? audioPlayer.pause() : audioPlayer.unpause()),
        setVolume: (volume) => {
          queue.volume = volume;
          queue.resource?.volume?.setVolume(volume / 100);
        },
        skip: () => audioPlayer.stop(true),
      },
      setRepeatMode: (mode) => {
        queue.repeatMode = mode;
      },
      delete: () => {
        queue.deleted = true;
        cleanupProcess(queue);
        audioPlayer.stop(true);
        queue.connection?.destroy();
        queues.delete(guildId);
      },
    };

    audioPlayer.on(AudioPlayerStatus.Idle, () => {
      if (!queue.deleted) void advance(queue);
    });
    audioPlayer.on("error", async (error) => {
      if (!queue.deleted) {
        await onError?.(queue, error);
        await advance(queue);
      }
    });
    queues.set(guildId, queue);
    return queue;
  };

  const connect = async (guildId, voiceChannel, textChannel) => {
    let queue = queues.get(guildId);
    if (!queue) queue = createQueue(guildId, voiceChannel, textChannel);
    queue.voiceChannel = voiceChannel;
    queue.textChannel = textChannel;
    if (!queue.connection || queue.connection.state.status === VoiceConnectionStatus.Destroyed) {
      queue.connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: true,
      });
      await entersState(queue.connection, VoiceConnectionStatus.Ready, 15_000);
      queue.connection.subscribe(queue.audioPlayer);
    }
    return queue;
  };

  const search = async (query, requestedBy) => {
    const cleanQuery = query.trim();
    if (!cleanQuery) return [];
    if (isUrl(cleanQuery)) return [directTrack(cleanQuery, requestedBy)];
    try {
      const result = await ytSearch(cleanQuery);
      return (result.videos || []).slice(0, 5).map((video) => normalizeVideo(video, requestedBy));
    } catch (error) {
      console.warn("La búsqueda de YouTube falló:", error.message);
      return [];
    }
  };

  const play = async (guildId, voiceChannel, textChannel, track) => {
    const queue = await connect(guildId, voiceChannel, textChannel);
    queue.tracks.push(track);
    if (!queue.currentTrack && !queue.starting && queue.audioPlayer.state.status === AudioPlayerStatus.Idle) {
      await advance(queue);
    }
    return queue;
  };

  const rememberSearch = (guildId, userId, tracks) => {
    const token = Math.random().toString(36).slice(2, 10);
    searches.set(`${guildId}:${userId}:${token}`, {
      tracks,
      expiresAt: Date.now() + 5 * 60_000,
    });
    return token;
  };

  const getSearchTracks = (guildId, userId, token) => {
    const key = `${guildId}:${userId}:${token}`;
    const value = searches.get(key);
    if (!value || value.expiresAt < Date.now()) {
      searches.delete(key);
      return null;
    }
    return value.tracks;
  };

  return {
    search,
    play,
    getQueue: (guildId) => queues.get(guildId),
    searchToken: rememberSearch,
    getSearchTracks,
  };
};

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
    return "No encontré esa canción. Prueba con el nombre del artista y la canción.";
  }
  if (message.includes("voice") || message.includes("permission") || message.includes("connect")) {
    return "No puedo entrar o hablar en ese canal. Revisa que tenga permisos para conectar y hablar.";
  }
  if (message.includes("yt-dlp") || message.includes("youtube") || message.includes("sign in")) {
    return "YouTube rechazó esa fuente temporalmente. Prueba con otra canción o pega un enlace diferente.";
  }
  return "No pude obtener el audio. Inténtalo de nuevo en unos segundos.";
};