---
name: x-to-youtube
description: Download X/Twitter videos, upload to YouTube as unlisted, transcribe with word-level timestamps, and add chapter markers. Use when the user wants to save a Twitter/X video to YouTube, or asks to "download and upload this X video to YouTube", or wants transcription + chapters from a Twitter video. Supports optional speaker diarization via whisperX.
---

# X → YouTube Pipeline

End-to-end: Twitter/X video → YouTube unlisted → transcription with timestamps → chapter markers.

This is an **orchestrator skill** — it delegates to other skills where they overlap, keeping only what's unique (X/Twitter-specific download + garbage-filtered chapter generation).

## Quick Start

```bash
python3 scripts/x_to_youtube.py "https://x.com/user/status/123/video/1" \
    --title "My Video"
```

Skip upload (download + transcribe only):

```bash
python3 scripts/x_to_youtube.py "https://x.com/user/status/123/video/1" \
    --no-upload --chapter-interval 60
```

## Prerequisites

- **yt-dlp**: `brew install yt-dlp`
- **mlx_whisper** (recommended, Apple Silicon): `pipx install mlx-whisper`
- **openai-whisper** (fallback): `pipx install openai-whisper`
- **YouTube Data API v3**: Must be enabled in your GCP project
- **Google OAuth for YouTube**: First upload opens browser for consent; token cached

### Optional

- **whisperX**: For speaker diarization (`--diarize`). `pip install whisperx`
- **youtube-api skill**: For richer YouTube upload features (tags, auto-title, Cowork support). Falls back to inline upload if not present.

## Delegation Map

This skill delegates to existing skills to avoid duplication:

| Stage | Delegates To | Why |
|-------|-------------|-----|
| Upload to YouTube | `youtube-api` | Better auth detection, tags, MIME handling, Cowork support |
| Transcription | `transcribe-anything` (conceptually) | More backends, silence detection, API support |
| Download from X | **this skill** | X/Twitter-specific URL handling, yt-dlp `--print after_move` |
| Chapter generation | **this skill** | Unique: garbage filtering, word-boundary truncation |

If `youtube-api` is not installed alongside this skill, the orchestrator falls back to an inline upload implementation.

## Scripts

### `x_to_youtube.py` — Full Pipeline

Orchestrates all 4 steps. Options:

| Flag | Default | Description |
|------|---------|-------------|
| `--title`, `-t` | derived from URL | Video title |
| `--privacy`, `-p` | `unlisted` | YouTube privacy: unlisted, private, public |
| `--diarize`, `-d` | off | Enable speaker diarization (requires whisperX) |
| `--no-upload` | off | Skip YouTube upload |
| `--whisper-model` | `turbo` | Model: tiny, base, small, medium, large, turbo |
| `--chapter-interval` | `30` | Seconds between chapter markers |

### `download_x_video.py` — Download Only

```bash
python3 scripts/download_x_video.py "https://x.com/user/status/123/video/1"
```

## Workflow

1. **Download**: yt-dlp fetches from X/Twitter, uses `--print after_move:filepath` for path
2. **Upload**: Delegates to `youtube-api` skill (or inline fallback) — resumable upload, unlisted default
3. **Transcribe**: mlx_whisper (preferred, 10x faster on Apple Silicon) or whisper CLI
4. **Chapters**: Segments grouped into ~30s chunks, garbage-filtered, word-boundary truncated

## Performance

- **Apple Silicon (M-series)**: mlx_whisper `turbo` ≈ 1300 frames/s → ~2 min for 27 min audio
- **CPU (openai-whisper)**: ≈ 95 frames/s → ~28 min for same audio
- Always prefer mlx_whisper on Apple Silicon

## Chapter Quality

Chapters are raw transcript text (not LLM-summarized):
- **Good**: Accurate timestamps, reflects actual content
- **Mediocre**: Titles can be rambling transcript fragments
- **Garbage filtered**: Pure filler ("Yeah.", "Cool.") chapters removed, word-boundary truncation

For professional-quality titles, post-process with an LLM. The `podcast-publishing-assistant` skill has LLM-based chapter titling.

## Troubleshooting

### YouTube API accessNotConfigured

```bash
gcloud services enable youtube.googleapis.com --project=<PROJECT_ID>
```

### OAuth redirect fails (ERR_CONNECTION_REFUSED)

- Ensure port 8080 is free: `lsof -i :8080`
- The GCP OAuth client must have `http://localhost` in redirect URIs

### mlx_whisper "Failed to load audio"

Ensure ffmpeg: `brew install ffmpeg`

### youtube-api skill not found

The pipeline falls back to inline upload using `~/.config/gws/client_secret.json`. Install the `youtube-api` skill alongside this one for better features.
