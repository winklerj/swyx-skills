---
name: x-to-youtube
description: Download X/Twitter videos, upload to YouTube as unlisted, transcribe with word-level timestamps, and add chapter markers to the description. Use when the user wants to save a Twitter/X video to YouTube, or asks to "download and upload this X video to YouTube", or wants transcription + chapters from a Twitter video. Supports optional speaker diarization via whisperX.
---

# X → YouTube Pipeline

End-to-end: Twitter/X video → YouTube unlisted → transcription with timestamps → chapter markers.

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
- **Google OAuth for YouTube**: Set up via `gws` — first run opens browser for consent; token cached at `~/.config/gws/youtube_token.pickle`
- **YouTube Data API v3**: Must be enabled. If `accessNotConfigured`, run `gcloud services enable youtube.googleapis.com --project=<PROJECT_ID>`

### Optional: Speaker Diarization

For `--diarize`, install whisperX:

```bash
pip install whisperx
```

On Apple Silicon, whisperX runs on CPU/MPS. Note: whisperX may have dependency conflicts; install in a separate venv if needed.

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

### `upload_to_youtube.py` — Upload Only

```bash
python3 scripts/upload_to_youtube.py <video.mp4> "Title" --privacy unlisted
```

## Workflow

1. **Download**: yt-dlp fetches from X/Twitter, prints path
2. **Upload**: Google API resumable upload to YouTube (unlisted by default)
3. **Transcribe**: mlx_whisper (preferred, 10x faster on Apple Silicon) or openai-whisper
4. **Chapters**: Segments grouped into ~30s chunks, garbage-filtered, word-boundary truncated → `00:00 Chapter title`

## Performance

- **Apple Silicon (M-series)**: mlx_whisper `turbo` ≈ 1300 frames/s → ~2 min for 27 min audio
- **CPU (openai-whisper)**: ≈ 95 frames/s → ~28 min for same audio
- Always prefer mlx_whisper on Apple Silicon

## Known Limitations & Quality

### Chapter Quality

Chapters are raw transcript text (not AI-summarized). This means:
- **Good**: Accurate timestamps, reflects actual content
- **Mediocre**: Titles can be rambling transcript fragments
- **Garbage filtered**: Pure filler ("Yeah.", "Cool.") chapters are removed

For professional-quality chapter titles, post-process with an LLM:
```python
# After running x_to_youtube.py, refine chapters:
chapters = json.load(open("output.json"))["chapters"]
# Feed chapters to an LLM for topic summarization
```

### Speaker Diarization

Not available by default. Install whisperX and use `--diarize`. Note:
- whisperX model + diarization pipeline adds 5-10 min processing time
- May require HuggingFace token for pyannote models
- Quality varies with audio clarity and speaker count

### MPS GPU Issues

openai-whisper with `--device mps` may produce NaN errors with large models. Use mlx_whisper instead — it's built for Apple Silicon and doesn't have this issue.

## Troubleshooting

### YouTube API accessNotConfigured

```bash
gcloud services enable youtube.googleapis.com --project=<PROJECT_ID>
```

### OAuth redirect fails (ERR_CONNECTION_REFUSED)

- Ensure port 8080 is free: `lsof -i :8080`
- The GCP OAuth client must have `http://localhost` in redirect URIs
- Try visiting the auth URL manually (printed to stderr)

### mlx_whisper "Failed to load audio"

Ensure ffmpeg is installed: `brew install ffmpeg`

### "No module named whisper"

Whisper is installed via pipx as a CLI only. The script uses subprocess — ensure `~/.local/bin/whisper` or `~/.local/bin/mlx_whisper` exists.
