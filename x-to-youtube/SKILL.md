---
name: x-to-youtube
description: Full pipeline — download X/Twitter videos, upload to YouTube as unlisted, transcribe with timestamps, add chapter markers. Orchestrator skill that chains download-x-video → youtube-api → transcribe-anything. Use when the user wants to save an X/Twitter video to YouTube with transcription and chapters, or asks to "download and upload this X video to YouTube with chapters".
---

# X → YouTube Pipeline

Orchestrator that chains atomic skills into an end-to-end pipeline. Each stage is handled by a focused sub-skill that can also be used independently.

## Atomic Skills Used

| Stage | Skill | What It Does |
|-------|-------|-------------|
| Download | `download-x-video` | yt-dlp from X/Twitter |
| Upload | `youtube-api` | YouTube Data API v3 upload |
| Transcribe | `transcribe-anything` | Whisper/mlx_whisper with timestamps |
| Chapters | `podcast-publishing-assistant` | LLM-based chapter titling |

## Pipeline

### Step 1: Download from X

Use `download-x-video`:
```bash
python3 download-x-video/scripts/download_x_video.py "https://x.com/user/status/123/video/1" /tmp
```

### Step 2: Upload to YouTube

Use `youtube-api`. First-time setup:
- The skill needs a `client_secret.json` in its config directory
- On first run, a browser opens for Google OAuth consent
- Token is cached for subsequent runs

```bash
python3 youtube-api/scripts/upload_video.py \
    --file /tmp/x_video_<tweet_id>.mp4 \
    --title "Video Title" \
    --privacy unlisted
```

If `youtube-api` is not installed, the inline upload fallback uses `~/.config/gws/client_secret.json`.

### Step 3: Transcribe

Use `transcribe-anything`. On Apple Silicon, prefer mlx_whisper (10x faster):
```bash
mlx_whisper /tmp/x_video_<tweet_id>.mp4 \
    --model mlx-community/whisper-turbo \
    --output-dir /tmp \
    --output-format json \
    --word-timestamps True
```

Or use the `transcribe-anything` skill which auto-selects the best backend.

### Step 4: Generate Chapters

Extract segments from the transcription JSON and format as YouTube chapters. For best results, use `podcast-publishing-assistant` which generates LLM-summarized chapter titles.

Quick inline chapter generation:
```python
import json
with open("/tmp/transcript.json") as f:
    segments = json.load(f)["segments"]

chapters = []
chunk_start = 0
chunk_texts = []
for seg in segments:
    if seg["start"] - chunk_start >= 30 and chunk_texts:
        title = " ".join(chunk_texts)[:60]
        chapters.append(f"{int(chunk_start//60)}:{int(chunk_start%60):02d} {title}")
        chunk_start = seg["start"]
        chunk_texts = [seg["text"].strip()]
    else:
        chunk_texts.append(seg["text"].strip())

print("\n".join(chapters))
```

### Step 5: Update YouTube Description

Use `youtube-api` to update the video description with chapters:
```bash
python3 youtube-api/scripts/update_metadata.py \
    --video-id <ID> \
    --description "Chapters:\n00:00 Intro\n..."
```

## Performance (Apple Silicon)

- **Download**: ~30s-2min depending on video length
- **Upload**: ~2-5min for 100MB, resumable
- **Transcribe (mlx_whisper turbo)**: ~2min for 27min video
- **Transcribe (CPU whisper)**: ~28min for 27min video

Always prefer `mlx_whisper` on M-series Macs.

## Troubleshooting

### YouTube API not enabled
```bash
gcloud services enable youtube.googleapis.com --project=<PROJECT_ID>
```

### OAuth redirect fails
- Ensure port 8080 is free: `lsof -i :8080`
- GCP OAuth must have `http://localhost` in redirect URIs

### mlx_whisper not found
```bash
pipx install mlx-whisper
```

### X/Twitter download fails
Twitter may require authentication for some videos:
```bash
yt-dlp --cookies-from-browser chrome "https://x.com/..."
```
