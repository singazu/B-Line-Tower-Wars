# Line Tower Wars - Composer Guidance

This document defines the current audio handoff guidance for composers and musicians contributing background music to Line Tower Wars. It is expected to change as we test real tracks, mobile builds, and the in-game music selection UI.

## 1) Current audio goals

- Support multiple musical contributors in the Options menu.
- Allow each contributor to provide up to 3 background tracks.
- Keep the shipped Android and iOS app size reasonable.
- Preserve a consistent game mix across all contributors.
- Keep sound effects separate from composer music packs unless sound design is explicitly requested.

## 2) Music deliverables

Each musical contributor may provide up to 3 tracks.

Recommended track length:
- `90-150 seconds` per track.
- Loopable tracks are preferred.
- If a track is not loopable, provide a clean ending and expect the game to rotate to another track.

Music should work as background gameplay audio:
- Avoid long silent intros.
- Avoid extreme bass that competes with gameplay sounds.
- Avoid sudden loud peaks.
- Avoid dense high-frequency passages that fight with tower-fire and UI feedback.
- Keep the emotional tone replayable over repeated short matches.

## 3) File format guidance

Provide two versions of each track:

- Master/source file:
  - `WAV` or `FLAC`
  - `44.1 kHz` or `48 kHz`
  - Stereo
  - `24-bit` preferred if available

- Game-ready file:
  - `M4A` using `AAC-LC`
  - Stereo
  - `96-128 kbps`

Use `96 kbps` for simpler or ambient mixes when quality holds up. Use `128 kbps` for denser arrangements or tracks with prominent transients.

Do not ship master files inside the app bundle. Master files are for archiving, future conversion, and remastering only.

## 4) Mobile app size targets

Music can become one of the largest parts of the app. As a rough planning estimate:

- 24 tracks at 2 minutes each:
  - `96 kbps`: about 35 MB
  - `128 kbps`: about 46 MB

- 24 tracks at 3 minutes each:
  - `96 kbps`: about 52 MB
  - `128 kbps`: about 69 MB

Because the intended maximum is 8 contributors with up to 3 tracks each, short high-quality loops are preferable to long full-length songs.

## 5) Naming guidance

Use lowercase file names with no spaces.

Suggested format:

- `{composer-id}-track-1.m4a`
- `{composer-id}-track-2.m4a`
- `{composer-id}-track-3.m4a`

Examples:

- `examplecomposer-track-1.m4a`
- `examplecomposer-track-2.m4a`
- `examplecomposer-track-3.m4a`

Master/source files should use the same base name:

- `examplecomposer-track-1.wav`
- `examplecomposer-track-1.flac`

## 6) Metadata to provide

For each contributor, provide:

- Display name.
- Optional social or portfolio link.
- Track titles.
- Preferred track order.
- Whether each track is intended to loop.
- Any attribution language required by the contributor.

For each track, provide:

- File name.
- Title.
- Duration.
- Loopable: yes/no.
- Mood or gameplay intent, if useful.

## 7) Sound design and SFX

Composers should only provide sound effects if explicitly requested.

The current plan is to use one consistent custom SFX batch for the game rather than separate SFX per composer. This keeps gameplay feedback coherent regardless of the selected music contributor.

If SFX are requested, provide:

- Master/source file:
  - `WAV`
  - `44.1 kHz` or `48 kHz`
  - `16-bit` or `24-bit`

- Game-ready file:
  - `WAV` for very short SFX, especially UI and gameplay sounds under about 1 second.
  - `M4A/AAC-LC` for longer stingers, ambience, voice, or multi-second sounds.

SFX guidance:

- Keep sounds short and responsive.
- Remove silence at the start.
- Avoid long tails unless the sound is intentionally a transition or stinger.
- Keep loudness consistent across the set.
- Avoid masking the music or repeating tower-fire sounds too aggressively.
- Provide dry versions first. Extra reverb, delay, or heavy ambience should be used sparingly.

Potential SFX categories:

- Tower fire sounds for each tower color.
- Player mana gain from kills.
- Player mana gain from scoring.
- Menu select/back sounds.
- Shop upgrade/purchase sounds.
- Invalid action sound.
- Round start or wave launch sting.

## 8) Rights and usage

All submitted audio must be original, licensed, or otherwise cleared for use in the game.

Audio rights should cover:

- Android app distribution.
- iOS app distribution.
- Web builds, if used.
- Store pages and preview videos.
- Trailers, gameplay clips, and social posts.
- Future updates and bug-fix releases.

Do not include uncleared samples, loops, vocals, or third-party material unless the license explicitly permits this use.

## 9) Open questions

These items should be updated as implementation and testing progress:

- Final in-game folder structure for composer packs.
- Whether the game will preload all selected contributor tracks or lazy-load tracks as needed.
- Whether tracks will loop individually or rotate after each complete playthrough.
- Final loudness target after testing on mobile speakers and headphones.
- Whether the Options menu will preview short music excerpts.
- Final SFX list if a custom SFX batch is commissioned.
