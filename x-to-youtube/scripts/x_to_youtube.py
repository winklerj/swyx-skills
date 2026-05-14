#!/usr/bin/env python3
"""
Full pipeline: X/Twitter video → YouTube unlisted + transcription with timestamps.

Usage:
    x_to_youtube.py <twitter-url> [--title TITLE] [--privacy unlisted|private|public]
                    [--diarize] [--no-upload]

Steps:
    1. Download video from X/Twitter via yt-dlp
    2. Upload to YouTube as unlisted (unless --no-upload)
    3. Transcribe with word-level timestamps using Whisper
    4. If --diarize, attempt speaker diarization via whisperX
    5. Add timestamped chapters to YouTube description

Requirements:
    - yt-dlp (brew install yt-dlp)
    - openai-whisper (pip install openai-whisper)
    - Google OAuth for YouTube (gws setup)
    - whisperX (optional, for diarization: pip install whisperx)
"""
import os, sys, subprocess, json, tempfile, argparse
from pathlib import Path

# Add scripts dir to path for sibling imports
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from download_x_video import download_x_video
from upload_to_youtube import upload

# ── Transcription ──────────────────────────────────────────────

# Prefer mlx_whisper on Apple Silicon (10x faster), fallback to whisper CLI
MLX_WHISPER_BIN = os.path.expanduser("~/.local/bin/mlx_whisper")
WHISPER_BIN = os.path.expanduser("~/.local/bin/whisper")

def transcribe_with_whisper(video_path: str, model: str = "turbo") -> dict:
    """Transcribe video using mlx_whisper (preferred) or openai-whisper CLI."""
    with tempfile.TemporaryDirectory() as tmpdir:
        # Try mlx_whisper first (fast on Apple Silicon)
        if os.path.exists(MLX_WHISPER_BIN):
            mlx_model = f"mlx-community/whisper-{model}"
            print(f"Transcribing with mlx_whisper ({mlx_model})...", file=sys.stderr)
            cmd = [
                MLX_WHISPER_BIN,
                video_path,
                "--model", mlx_model,
                "--output-dir", tmpdir,
                "--output-format", "json",
                "--word-timestamps", "True",
                "--verbose", "False",
            ]
        else:
            print(f"Transcribing with whisper CLI ({model})...", file=sys.stderr)
            cmd = [
                WHISPER_BIN,
                video_path,
                "--model", model,
                "--output_format", "json",
                "--output_dir", tmpdir,
                "--word_timestamps", "True",
                "--verbose", "False",
            ]

        subprocess.run(cmd, check=True, timeout=900)

        # Find the json output file
        base = os.path.splitext(os.path.basename(video_path))[0]
        json_path = os.path.join(tmpdir, f"{base}.json")
        if not os.path.exists(json_path):
            candidates = list(Path(tmpdir).glob("*.json"))
            if candidates:
                json_path = str(candidates[0])
            else:
                raise RuntimeError("Whisper produced no JSON output")

        with open(json_path) as f:
            return json.load(f)


def try_diarize(video_path: str, model: str = "medium") -> dict:
    """Attempt diarization via whisperX. Falls back to basic whisper if unavailable."""
    try:
        import whisperx
    except ImportError:
        print("whisperX not installed. Falling back to basic transcription.", file=sys.stderr)
        return transcribe_with_whisper(video_path, model)

    print("Transcribing with whisperX...", file=sys.stderr)

    device = "cpu"
    try:
        import torch
        if torch.backends.mps.is_available():
            device = "mps"
    except Exception:
        pass

    # 1. Transcribe
    audio = whisperx.load_audio(video_path)
    m = whisperx.load_model(model, device)
    result = m.transcribe(audio, batch_size=8)

    # 2. Align
    model_a, metadata = whisperx.load_align_model(language_code=result["language"], device=device)
    result = whisperx.align(result["segments"], model_a, metadata, audio, device)

    # 3. Diarize
    try:
        diarize_model = whisperx.DiarizationPipeline(use_auth_token=None, device=device)
        diarize_segments = diarize_model(audio)
        result = whisperx.assign_word_speakers(diarize_segments, result)
    except Exception as e:
        print(f"Diarization failed ({e}), using transcription without speakers.", file=sys.stderr)

    return result


# ── YouTube Chapter Formatting ─────────────────────────────────

def segments_to_chapters(segments: list, interval_sec: int = 30) -> list:
    """
    Convert transcription segments to YouTube chapter markers.
    Groups segments into ~interval_sec chunks, filters garbage, and cleans titles.
    """
    # Garbage patterns: pure filler words and vocalizations
    garbage = {
        "yeah", "yeah.", "yep.", "yep", "mm-hmm.", "mm-hmm", "uh-huh.",
        "uh-huh", "cool.", "cool", "okay.", "okay", "right.", "right",
        "sure.", "sure", "no.", "yes.", "yes",
    }

    def is_garbage(text: str) -> bool:
        cleaned = text.strip().lower().rstrip(".!?")
        if cleaned in garbage:
            return True
        words = [w.strip(".,!?") for w in cleaned.split()]
        if len(words) >= 3 and all(w in garbage for w in words):
            return True
        return False

    def clean_title(texts: list) -> str:
        """Join texts, filter garbage, truncate at word boundary."""
        raw = " ".join(t for t in texts if not is_garbage(t)).strip()
        if len(raw) <= 60:
            return raw
        cut = raw[:60].rstrip()
        last_space = cut.rfind(" ")
        return raw[:last_space] if last_space > 0 else cut

    chapters = []
    chunk_start = 0.0
    chunk_texts = []

    for seg in segments:
        start = seg["start"]
        text = seg["text"].strip()
        if start - chunk_start >= interval_sec and chunk_texts:
            title = clean_title(chunk_texts)
            if title:
                chapters.append((_format_timestamp(chunk_start), title))
            chunk_start = start
            chunk_texts = [text] if not is_garbage(text) else []
        elif not is_garbage(text):
            chunk_texts.append(text)

    if chunk_texts:
        title = clean_title(chunk_texts)
        if title:
            chapters.append((_format_timestamp(chunk_start), title))

    return chapters


def _format_timestamp(seconds: float) -> str:
    """Format seconds as HH:MM:SS or MM:SS."""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    if h > 0:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m}:{s:02d}"


def build_description(title: str, source_url: str, chapters: list) -> str:
    """Build a YouTube description with timestamped chapters."""
    lines = [title, "", f"Source: {source_url}", "", "Chapters:", ""]
    for ts, chap in chapters:
        lines.append(f"{ts} {chap}")
    return "\n".join(lines)


# ── Main Pipeline ──────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="X/Twitter video → YouTube + transcription")
    parser.add_argument("url", help="Twitter/X video URL")
    parser.add_argument("--title", "-t", help="Video title")
    parser.add_argument("--privacy", "-p", default="unlisted",
                        choices=["unlisted", "private", "public"])
    parser.add_argument("--diarize", "-d", action="store_true",
                        help="Attempt speaker diarization (requires whisperX)")
    parser.add_argument("--no-upload", action="store_true",
                        help="Skip YouTube upload (download + transcribe only)")
    parser.add_argument("--whisper-model", default="turbo",
                        choices=["tiny", "base", "small", "medium", "large", "turbo"],
                        help="Whisper model size")
    parser.add_argument("--chapter-interval", type=int, default=30,
                        help="Seconds between chapter markers")
    args = parser.parse_args()

    # ── Step 1: Download ──
    print("=" * 60, file=sys.stderr)
    print("Step 1/4: Downloading from X...", file=sys.stderr)
    video_path = download_x_video(args.url)

    # Derive title from filename if not provided
    title = args.title or f"Twitter Video from {args.url.split('/')[3]}"
    print(f"  Downloaded: {video_path}", file=sys.stderr)
    print(f"  Title: {title}", file=sys.stderr)

    # ── Step 2: Upload ──
    youtube_url = None
    if not args.no_upload:
        print("\nStep 2/4: Uploading to YouTube...", file=sys.stderr)
        youtube_url = upload(video_path, title, privacy=args.privacy)
    else:
        print("\nStep 2/4: Skipped (--no-upload)", file=sys.stderr)

    # ── Step 3: Transcribe ──
    print("\nStep 3/4: Transcribing...", file=sys.stderr)
    if args.diarize:
        result = try_diarize(video_path, model=args.whisper_model)
    else:
        result = transcribe_with_whisper(video_path, model=args.whisper_model)

    # ── Step 4: Chapters ──
    print("\nStep 4/4: Building chapters...", file=sys.stderr)
    segments = result.get("segments", [])
    chapters = segments_to_chapters(segments, args.chapter_interval)
    description = build_description(title, args.url, chapters)

    print(f"\n  Transcript ({len(segments)} segments):", file=sys.stderr)
    print(f"  Chapters: {len(chapters)} markers", file=sys.stderr)

    # Print chapter markers
    print("\n📋 Chapters:", file=sys.stderr)
    for ts, chap in chapters:
        print(f"  {ts} {chap}", file=sys.stderr)

    # Print full description
    print("\n" + "=" * 60, file=sys.stderr)
    print("DESCRIPTION:", file=sys.stderr)
    print(description, file=sys.stderr)

    # Output JSON for programmatic use
    output = {
        "video_path": video_path,
        "youtube_url": youtube_url,
        "title": title,
        "segments": segments,
        "chapters": [{"time": ts, "title": chap} for ts, chap in chapters],
        "description": description,
    }
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()
