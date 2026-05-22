# swyxio Skills

Reusable skills for Claude Code, Codex, Cursor, and similar agent environments.

Each folder is a self-contained workflow with a `SKILL.md`, optional supporting scripts, and a focused trigger description so an agent can pick the right tool quickly.

## Skill Index

### Coding, Agents, And Workstations

- [codebase-maintainability-guardrails](./codebase-maintainability-guardrails) — guardrails for substantial coding work, especially frontend/fullstack apps, production refactors, UI migrations, and greenfield builds. Keeps files small, typed, feature-owned, contract-driven, behavior-preserving, and visually verified.
- [maintainability-migration](./maintainability-migration) — runs a behavior-preserving maintainability migration for messy or prototype codebases: analyze repo needs, plan staged refactors, use concurrent workers safely, validate in green slices, and finish with a migration audit microsite.
- [new-mac-setup](./new-mac-setup) — opinionated Apple Silicon Mac bootstrap for fullstack and AI work. Installs Homebrew, shell tooling, editors, AI tools, terminal setup, and macOS defaults in a repeatable run order.
- [claude-session-introspect](./claude-session-introspect) — inspects Claude Code session JSONL files at `~/.claude/projects/` for token totals, prompt counts, assistant turns, tool calls, compaction boundaries, and compaction summaries.
- [smart-entity-resolution](./smart-entity-resolution) — resolves named people or organizations in messy databases with aliases, duplicates, sparse records, common names, LLM retrieval repair, reranking, and visible runner-up candidates.

### Media Download And Transformation

- [media-transform](./media-transform) — orchestrates video pipelines across download, upload, transcription, chapters, thumbnails, and title testing by routing to the right atomic skill for each stage.
- [download-video](./download-video) — downloads embedded videos from web pages by resolving the real player URL and calling `yt-dlp` with the right referer/origin headers.
- [download-x-video](./download-x-video) — downloads X/Twitter post videos with `yt-dlp`, including HLS streams and reliable final-path detection.
- [zoom-download](./zoom-download) — downloads Zoom cloud recordings, verifies filenames/file types, and supports ffmpeg-based content analysis.

### Transcription, Extraction, And Summarization

- [transcribe-anything](./transcribe-anything) — transcribes audio and video files using pluggable ASR backends including local Whisper, whisperX, faster-whisper, OpenAI, Groq, Deepgram, AssemblyAI, Gemini, and Hugging Face models.
- [conference-transcribe](./conference-transcribe) — splits long conference livestreams or YouTube videos into per-talk transcripts using chapter timestamps, segment transcription, and LLM cleanup.
- [multimodal-extraction](./multimodal-extraction) — turns local videos or video URLs into Markdown timelines with slide screenshots, key frames, and transcript spans aligned by timestamp.
- [summarize-anything](./summarize-anything) — recursively summarizes long text with pluggable LLM backends and can emit executive summaries, YouTube descriptions, chapters, posts, titles, thumbnail prompts, blog outlines, and pull quotes.
- [podcast-publishing-assistant](./podcast-publishing-assistant) — turns podcasts, interviews, panels, and long-form audio/video into transcripts, summaries, chapter markers, show notes, titles, descriptions, and promo copy.

### YouTube Publishing And Thumbnails

- [youtube-api](./youtube-api) — manages YouTube videos programmatically through the YouTube Data API v3, including uploads, thumbnails, metadata updates, and channel video listing.
- [youtube-publish](./youtube-publish) — publishes videos on YouTube, edits titles/descriptions/timestamps, assigns playlists, and manages YouTube Studio metadata workflows.
- [youtube-thumbnails](./youtube-thumbnails) — creates AI-generated YouTube thumbnails with prompt engineering, image generation, compression, and upload guidance.
- [thumbnail-extraction](./thumbnail-extraction) — extracts interesting video frames, face crops, presentation slides, and transparent cutouts for thumbnail compositing.

## Repo Shape

- One skill per top-level folder.
- Every skill must include `SKILL.md`.
- Add scripts only when they make the workflow more reliable or repeatable.
- Keep auxiliary docs minimal; the skill body should carry the agent-facing workflow.

Click into each folder for the detailed workflow, prerequisites, and command examples.
