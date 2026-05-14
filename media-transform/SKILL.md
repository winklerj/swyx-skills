---
name: media-transform
description: Generic media transformation orchestrator — download videos from any source (X/Twitter, Zoom, YouTube, web embeds), upload to YouTube, transcribe with timestamps, generate chapters, and add thumbnails. Use when the user wants to move a video from one platform to another, or asks to "download and upload this video to YouTube", "publish this recording", "save and transcribe this", or any video pipeline task that chains multiple steps. Encodes preferences and learned best practices for each stage.
---

# Media Transform

Generic orchestrator for media transformation pipelines. Chains atomic skills based on source and destination, with stage-by-stage checkpoints.

## Architecture

Each pipeline stage is handled by a dedicated atomic skill. This orchestrator provides:

1. **Stage selection** — which steps to run based on source/destination
2. **Preferences** — battle-tested defaults and known gotchas
3. **Learnings** — what worked, what didn't, what to avoid
4. **Checkpoints** — present plan, get confirmation, then execute

## Atomic Skills

| Stage | Skill | Notes |
|-------|-------|-------|
| Download (X/Twitter) | `download-x-video` | yt-dlp, `--print after_move:filepath` |
| Download (Zoom) | `zoom-download` | Browser-based, gallery view preferred |
| Download (web embeds) | `download-video` | Handles Vimeo, YouTube embeds, referer headers |
| Download (generic URL) | `yt-dlp` directly | `brew install yt-dlp` |
| Upload to YouTube | `youtube-api` | OAuth, resumable upload, tags, metadata |
| Transcribe | `transcribe-anything` | Multi-backend, auto-selects best |
| Chapters (LLM titles) | `podcast-publishing-assistant` | High-quality chapter summaries |
| Thumbnails | `youtube-thumbnails` | Generate + upload |

## Pipelines

### Pipeline A: X/Twitter → YouTube + Chapters

```
download-x-video → youtube-api → transcribe-anything → (update description)
```

Command sequence:
```bash
# 1. Download
python3 download-x-video/scripts/download_x_video.py "https://x.com/user/status/123/video/1" /tmp

# 2. Upload (unlisted)
python3 youtube-api/scripts/upload_video.py \
    --file /tmp/x_video_<id>.mp4 \
    --title "Video Title" \
    --privacy unlisted

# 3. Transcribe (prefer mlx_whisper on Apple Silicon)
mlx_whisper /tmp/x_video_<id>.mp4 \
    --model mlx-community/whisper-turbo \
    --output-dir /tmp --output-format json \
    --word-timestamps True

# 4. Generate chapters + update description
# See Chapter Generation section below
```

### Pipeline B: Zoom → YouTube + Thumbnails

```
zoom-download → youtube-api → youtube-thumbnails
```

Unlike Pipeline A, Zoom recordings typically don't need transcription (they have built-in transcripts). Focus is on proper titling, playlist assignment, and thumbnails.

### Pipeline C: Generic Video → YouTube + Transcription

```
yt-dlp download → youtube-api → transcribe-anything
```

For any video URL that yt-dlp supports (YouTube, Vimeo, etc.), download and re-publish.

## Stage-by-Stage Preferences & Learnings

### Download

**mlx_whisper is 10x faster on Apple Silicon:**
- `mlx_whisper` (`pipx install mlx-whisper`): ~1300 frames/s → ~2 min for 27 min audio
- `openai-whisper` CLI: ~95 frames/s → ~28 min for same audio
- Always prefer `mlx_whisper` on M-series Macs
- `openai-whisper` with `--device mps` produces NaN errors with turbo/large models — avoid

**yt-dlp path detection:**
- Use `--print after_move:filepath` for reliable final path (don't parse stdout for `[download] Destination`)
- HLS streams from X/Twitter use fragmented filenames during download; only the `after_move` path is the final merged file

**X/Twitter auth:**
- Some videos require authentication: `yt-dlp --cookies-from-browser chrome`

### Upload

**OAuth token caching:**
- `youtube-api` skill handles this: `~/.config/youtube-api/token.pickle` (or Cowork path)
- First run opens browser for consent; cached for subsequent runs
- On Mac → local config; in Cowork VM → mounted Downloads folder (persists across resets)

**Privacy default:**
- Always default to `unlisted` unless user explicitly asks for `public`

**Resumable uploads:**
- Google API client supports resumable uploads — large files (100MB+) upload smoothly

### Transcription

**Prefer mlx_whisper on Apple Silicon:**
```bash
mlx_whisper <file> --model mlx-community/whisper-turbo --output-format json --word-timestamps True
```

Falls back to openai-whisper CLI. `transcribe-anything` skill auto-selects best backend.

**Turbo model is the sweet spot:**
- Fast enough for real-time use (~2 min for 27 min audio)
- Quality nearly as good as large
- Small is too inaccurate for chapter generation

**Diarization is aspirational:**
- Requires whisperX + pyannote + HuggingFace token
- Adds 5-10 min processing
- Quality varies with audio clarity
- Use `transcribe-anything` with `--diarize` flag when available

### Chapter Generation

**Garbage filtering is essential:**
- Filter out pure filler segments: "Yeah.", "Cool.", "Mm-hmm.", "Right."
- Filter repetitive filler: "Yeah. Yeah. Yeah." (3+ garbage words in a row)
- Null segments (empty text, zero duration) at the end are common

**Word-boundary truncation:**
- Don't truncate chapter titles mid-word
- "What areas of data do you feel are underserved by now that l" → truncate at last space

**LLM titles when quality matters:**
- Raw transcript chapters are functional but ugly
- For polished output, use `podcast-publishing-assistant` or feed segments to an LLM
- Prompt: "Generate concise chapter titles (<60 chars) for these transcript segments with timestamps"

**Interval tuning:**
- Default 30s gives ~46 chapters for 27 min video — good for navigation
- 60s gives ~27 chapters — cleaner but less granular
- 10s is too granular for YouTube (chapter limit is ~100)

### Thumbnails

- Gemini Pro with image generation enabled
- Compress to <2MB: `convert -resize 1280x720 -quality 85`
- Upload via `youtube-api/scripts/set_thumbnail.py`

## Checkpoint Pattern

Before each action phase, present a summary and get confirmation. This catches mismatches early:

1. **Pre-flight**: Scan source (tweet, Zoom recordings, etc.) → list what's available
2. **Download complete**: Confirm file, title, duration
3. **Upload complete**: Confirm URL, privacy, playlist
4. **Transcription complete**: Confirm segment count, quality
5. **Final**: Present all results

## Troubleshooting

### YouTube API not enabled
```bash
gcloud services enable youtube.googleapis.com --project=<PROJECT_ID>
```

### OAuth redirect fails (ERR_CONNECTION_REFUSED)
- Ensure port is free: `lsof -i :8080`
- GCP OAuth must have `http://localhost` in redirect URIs

### mlx_whisper "Failed to load audio"
- `brew install ffmpeg`

### Chapter quality is poor
- Raw transcript chapters work for quick navigation but look unprofessional
- For publication-quality, use `podcast-publishing-assistant` or LLM post-processing
- Garbage filtering catches most bad chapters but may miss edge cases ("I mean", "you know")
