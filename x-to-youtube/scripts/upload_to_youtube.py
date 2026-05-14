#!/usr/bin/env python3
"""
Upload a video to YouTube as unlisted.
Uses OAuth — first run opens a browser for consent, token is cached for subsequent runs.

Usage:
    upload_to_youtube.py <video_path> [title] [--privacy unlisted|private|public]
"""
import os, sys, pickle
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]
CLIENT_SECRET = os.path.expanduser("~/.config/gws/client_secret.json")
TOKEN_FILE = os.path.expanduser("~/.config/gws/youtube_token.pickle")
REDIRECT_URI = "http://localhost:8080"

def authenticate():
    """Authenticate with YouTube OAuth. Returns YouTube API service."""
    creds = None
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, "rb") as token:
            creds = pickle.load(token)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(CLIENT_SECRET):
                raise RuntimeError(
                    "Google OAuth client secret not found at ~/.config/gws/client_secret.json. "
                    "Set up GWS OAuth first."
                )
            flow = InstalledAppFlow.from_client_secrets_file(
                CLIENT_SECRET, SCOPES, redirect_uri=REDIRECT_URI
            )
            creds = flow.run_local_server(
                port=8080, open_browser=True,
                success_message="✅ Authorized! You can close this tab."
            )
        with open(TOKEN_FILE, "wb") as token:
            pickle.dump(creds, token)

    return build("youtube", "v3", credentials=creds)

def upload(video_path: str, title: str, description: str = "", privacy: str = "unlisted") -> str:
    """
    Upload a video to YouTube.
    Returns the YouTube video URL.
    """
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video not found: {video_path}")

    youtube = authenticate()

    body = {
        "snippet": {
            "title": title,
            "description": description,
        },
        "status": {
            "privacyStatus": privacy,
        },
    }

    media = MediaFileUpload(video_path, mimetype="video/mp4", resumable=True)
    request = youtube.videos().insert(part="snippet,status", body=body, media_body=media)

    size_mb = os.path.getsize(video_path) / 1024 / 1024
    print(f"Uploading '{title}' ({size_mb:.1f} MB) as {privacy}...", file=sys.stderr)

    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            print(f"  {int(status.progress() * 100)}%", file=sys.stderr)

    video_id = response["id"]
    url = f"https://www.youtube.com/watch?v={video_id}"
    print(f"\n✅ Uploaded: {url}", file=sys.stderr)
    return url

def main():
    if len(sys.argv) < 2:
        print("Usage: upload_to_youtube.py <video_path> [title] [--privacy unlisted|private|public]", file=sys.stderr)
        sys.exit(1)

    video_path = sys.argv[1]
    title = sys.argv[2] if len(sys.argv) > 2 else "Video"

    # Parse optional flags
    privacy = "unlisted"
    description = ""
    args = sys.argv[3:]
    while args:
        if args[0] == "--privacy" and len(args) > 1:
            privacy = args[1]
            args = args[2:]
        elif args[0] == "--description" and len(args) > 1:
            description = args[1]
            args = args[2:]
        else:
            args = args[1:]

    try:
        url = upload(video_path, title, description, privacy)
        print(url)
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
