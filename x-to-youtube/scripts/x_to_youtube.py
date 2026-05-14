#!/usr/bin/env python3
"""
Full pipeline: X/Twitter video → YouTube unlisted + transcription with timestamps.

This is the orchestrator script for x-to-youtube. It delegates:
  - Download:     inline (yt-dlp, X-specific URL handling)
  - Upload:       youtube-api skill (youtube-api/scripts/upload_video.py)
  - Transcription: mlx_whisper CLI or whisper CLI (can also use transcribe-anything)
  - Chapters:      inline (garbage-filtered, word-boundary truncated)

Usage:
    x_to_youtube.py <twitter-url> [--title TITLE] [--privacy unlisted|private|public]
                    [--diarize] [--no-upload] [--chapter-interval SECONDS]
"""
import os, sys, subprocess, json, tempfile, argparse
from pathlib import Path

# Add scripts dir to path for sibling imports
SCRIPT_DIR = Path(__file__).resolve().parent
SKILL_DIR = SCRIPT_DIR.parent
sys.path.insert(0, str(SCRIPT_DIR))

from download_x_video import download_x_video

# ── YouTube Upload (delegates to youtube-api skill) ───────────────

def upload_youtube(video_path: str, title: str, description: str = "", privacy: str = "unlisted") -> str:
    """Upload to YouTube using the youtube-api skill's upload_video.py."""
    # Try youtube-api skill's script first
    youtube_api_script = SKILL_DIR.parent / "youtube-api" / "scripts" / "upload_video.py"
    if youtube_api_script.exists():
        print("Uploading via youtube-api skill...", file=sys.stderr)
        cmd = [
            sys.executable, str(youtube_api_script),
            "--file", video_path,
            "--title", title,
            "--description", description,
            "--privacy", privacy,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        if result.returncode != 0:
            raise RuntimeError(f"youtube-api upload failed: {result.stderr}")
        # Parse video URL from output
        for line in result.stdout.splitlines():
            if "youtube.com/watch?v=" in line or "youtu.be/" in line:
                return line.strip()
        # If youtube-api printed a video ID
        for line in result.stdout.splitlines():
            if len(line) == 11 and line.isalnum():  # YouTube ID is 11 chars
                return f"https://www.youtube.com/watch?v={line}"
        raise RuntimeError(f"Could not parse YouTube URL from: {result.stdout}")
    else:
        # Fallback: inline upload
        print("youtube-api skill not found, using inline upload...", file=sys.stderr)
        return _upload_inline(video_path, title, description, privacy)


def _upload_inline(video_path: str, title: str, description: str, privacy: str) -> str:
    """Fallback inline YouTube upload using google-api-python-client."""
    import pickle
    from google.auth.transport.requests import Request
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload

    SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]
    CLIENT_SECRET = os.path.expanduser("~/.config/gws/client_secret.json")
    TOKEN_FILE = os.path.expanduser("~/.config/gws/youtube_token.pickle")

    creds = None
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, "rb") as token:
            creds = pickle.load(token)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                CLIENT_SECRET, SCOPES, redirect_uri="http://localhost:8080"
            )
            creds = flow.run_local_server(port=8080, open_browser=True,
                success_message="Authorized! Close this tab.")

        os.makedirs(os.path.dirname(TOKEN_FILE), exist_ok=True)
        with open(TOKEN_FILE, "wb") as token:
            pickle.dump(creds, token)

    youtube = build("youtube", "v3", credentials=creds)
    body = {"snippet": {"title": title, "description": description}, "status": {"privacyStatus": privacy}}
    media = MediaFileUpload(video_path, mimetype="video/mp4", resumable=True)
    request = youtube.videos().insert(part="snippet,status", body=body, media_body=media)

    size_mb = os.path.getsize(video_path) / 1024 / 1024
    print(f"Uploading '{title}' ({size_mb:.1f} MB) as {privacy}...", file=sys.stderr)
    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            print(f"  {int(status.progress() * 100)}%", file=sys.stderr)

    vid = response["id"]
    return f"https://www.youtube.com/watch?v={vid}"


# ── Transcription ──────────────────────────────────────────────

MLX_WHISPER_BIN = os.path.expanduser("~/.local/bin/mlx_whisper")
WHISPER_BIN = os.path.expanduser("~/.local/bin/whisper")

def transcribe(video_path: str, model: str = "turbo") -> dict:
    """Transcribe using mlx_whisper (preferred) or whisper CLI."""
    with tempfile.TemporaryDirectory() as tmpdir:
        if os.path.exists(MLX_WHISPER_BIN):
            mlx_model = f"mlx-community/whisper-{model}"
            print(f"Transcribing with mlx_whisper ({mlx_model})...", file=sys.stderr)
            cmd = [MLX_WHISPER_BIN, video_path, "--model", mlx_model,
                   "--output-dir", tmpdir, "--output-format", "json",
                   "--word-timestamps", "True", "--verbose", "False"]
        else:
            print(f"Transcribing with whisper CLI ({model})...", file=sys.stderr)
            cmd = [WHISPER_BIN, video_path, "--model", model,
                   "--output_format", "json", "--output_dir", tmpdir,
                   "--word_timestamps", "True", "--verbose", "False"]

        subprocess.run(cmd, check=True, timeout=900)

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


def try_diarize(video_path: str, model: str = "turbo") -> dict:
    """Attempt diarization via whisperX. Falls back to basic transcription."""
    try:
        import whisperx
    except ImportError:
        print("whisperX not installed. Falling back to basic transcription.", file=sys.stderr)
        return transcribe(video_path, model)

    print("Transcribing with whisperX + diarization...", file=sys.stderr)
    device = "cpu"
    try:
        import torch
        if torch.backends.mps.is_available():
            device = "mps"
    except Exception:
        pass

    audio = whisperx.load_audio(video_path)
    m = whisperx.load_model(model, device)
    result = m.transcribe(audio, batch_size=8)
    model_a, metadata = whisperx.load_align_model(language_code=result["language"], device=device)
    result = whisperx.align(result["segments"], model_a, metadata, audio, device)

    try:
        diarize_model = whisperx.DiarizationPipeline(use_auth_token=None, device=device)
        diarize_segments = diarize_model(audio)
        result = whisperx.assign_word_speakers(diarize_segments, result)
    except Exception as e:
        print(f"Diarization failed ({e}), continuing without speakers.", file=sys.stderr)

    return result


# ── Chapter Generation ──────────────────────────────────────────

GARBAGE = {"yeah", "yep", "mm-hmm", "uh-huh", "cool", "okay", "right", "sure", "no", "yes"}

def is_garbage(text: str) -> bool:
    cleaned = text.strip().lower().rstrip(".!?")
    if cleaned in GARBAGE:
        return True
    words = [w.strip(".,!?") for w in cleaned.split()]
    if len(words) >= 3 and all(w in GARBAGE for w in words):
        return True
    return False

def clean_title(texts: list) -> str:
    raw = " ".join(t for t in texts if not is_garbage(t)).strip()
    if len(raw) <= 60:
        return raw
    cut = raw[:60].rstrip()
    last_space = cut.rfind(" ")
    return raw[:last_space] if last_space > 0 else cut

def _format_timestamp(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    return f"{h}:{m:02d}:{s:02d}" if h > 0 else f"{m}:{s:02d}"

def segments_to_chapters(segments: list, interval_sec: int = 30) -> list:
    """Convert segments to YouTube chapter markers with garbage filtering."""
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

def build_description(title: str, source_url: str, chapters: list) -> str:
    lines = [title, "", f"Source: {source_url}", "", "Chapters:", ""]
    for ts, chap in chapters:
        lines.append(f"{ts} {chap}")
    return "\n".join(lines)


# ── Main Pipeline ──────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="X/Twitter video → YouTube + transcription + chapters")
    parser.add_argument("url", help="Twitter/X video URL")
    parser.add_argument("--title", "-t", help="Video title")
    parser.add_argument("--privacy", "-p", default="unlisted", choices=["unlisted", "private", "public"])
    parser.add_argument("--diarize", "-d", action="store_true", help="Attempt speaker diarization (requires whisperX)")
    parser.add_argument("--no-upload", action="store_true", help="Skip YouTube upload")
    parser.add_argument("--whisper-model", default="turbo", choices=["tiny", "base", "small", "medium", "large", "turbo"])
    parser.add_argument("--chapter-interval", type=int, default=30, help="Seconds between chapter markers")
    args = parser.parse_args()

    # 1. Download
    print("=" * 60, file=sys.stderr)
    print("Step 1/4: Downloading from X...", file=sys.stderr)
    video_path = download_x_video(args.url)
    title = args.title or f"Twitter Video from {args.url.split('/')[3]}"
    print(f"  Downloaded: {video_path}", file=sys.stderr)
    print(f"  Title: {title}", file=sys.stderr)

    # 2. Upload
    youtube_url = None
    if not args.no_upload:
        print("\nStep 2/4: Uploading to YouTube...", file=sys.stderr)
        youtube_url = upload_youtube(video_path, title, privacy=args.privacy)
        print(f"  URL: {youtube_url}", file=sys.stderr)
    else:
        print("\nStep 2/4: Skipped (--no-upload)", file=sys.stderr)

    # 3. Transcribe
    print("\nStep 3/4: Transcribing...", file=sys.stderr)
    if args.diarize:
        result = try_diarize(video_path, model=args.whisper_model)
    else:
        result = transcribe(video_path, model=args.whisper_model)

    # 4. Chapters
    print("\nStep 4/4: Building chapters...", file=sys.stderr)
    segments = result.get("segments", [])
    chapters = segments_to_chapters(segments, args.chapter_interval)
    description = build_description(title, args.url, chapters)

    print(f"\n  Transcript: {len(segments)} segments, {len(result.get('text', ''))} chars", file=sys.stderr)
    print(f"  Chapters: {len(chapters)} markers", file=sys.stderr)

    print("\n📋 Chapters:", file=sys.stderr)
    for ts, chap in chapters:
        print(f"  {ts} {chap}", file=sys.stderr)

    # Output JSON
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
