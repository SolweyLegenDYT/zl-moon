---
name: Discord Player extractors
description: Compatibility note for the Discord music bot's current Discord Player setup.
---

Discord Player 7.x does not expose `YoutubeExtractor` from `@discord-player/extractor`; YouTube handling is provided internally, while optional providers are loaded through `DefaultExtractors`.

**Why:** Registering the old named YouTube extractor causes a startup failure before the bot can log in.

**How to apply:** When updating the music stack, verify exports and use `player.extractors.loadMulti(DefaultExtractors)` rather than assuming a standalone YouTube extractor exists.