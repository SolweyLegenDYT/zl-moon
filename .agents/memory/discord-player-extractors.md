---
name: YouTube audio extraction
description: Compatibility note for the Discord music bot's current YouTube audio setup.
---

YouTube search may succeed while the default audio client is rejected. The bot uses `yt-dlp` with the Android player client and FFmpeg-compatible WebM/Opus output for playback.

**Why:** Current YouTube responses can reject the default web client or fail URL deciphering in JavaScript extractors, so title search alone is not proof that playback will work.

**How to apply:** Keep the extractor client explicit in the `yt-dlp` arguments and verify both metadata and audio bytes after dependency updates.