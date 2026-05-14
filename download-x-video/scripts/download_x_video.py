#!/usr/bin/env python3
"""Download a video from X/Twitter using yt-dlp."""
import subprocess, sys, os

def download_x_video(url: str, output_dir: str = "/tmp") -> str:
    """
    Download video from X/Twitter URL.
    Returns the path to the downloaded video file.
    """
    # Ensure yt-dlp is available
    if not os.path.exists("/opt/homebrew/bin/yt-dlp"):
        raise RuntimeError("yt-dlp not found at /opt/homebrew/bin/yt-dlp")

    output_template = os.path.join(output_dir, "x_video_%(id)s.%(ext)s")
    cmd = [
        "/opt/homebrew/bin/yt-dlp",
        "-o", output_template,
        "--no-playlist",
        "--print", "after_move:filepath",
        url
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)

    if result.returncode != 0:
        print(f"yt-dlp error: {result.stderr}", file=sys.stderr)
        raise RuntimeError(f"Failed to download video: {result.stderr}")

    # yt-dlp --print after_move:filepath outputs the final file path
    path = result.stdout.strip()
    if path and os.path.exists(path):
        return path

    # Fallback: look for created mp4 files matching our template
    for f in sorted(os.listdir(output_dir), reverse=True):
        if f.startswith("x_video_") and f.endswith(".mp4"):
            return os.path.join(output_dir, f)

    raise RuntimeError("Could not locate downloaded file")

def main():
    if len(sys.argv) < 2:
        print("Usage: download_x_video.py <twitter-url> [output-dir]", file=sys.stderr)
        sys.exit(1)

    url = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "/tmp"

    try:
        path = download_x_video(url, output_dir)
        print(path)
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
