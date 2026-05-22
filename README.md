# swyxio Skills

Reusable skills for Claude Code, Codex, Cursor, and similar agent environments.

Each folder is a self-contained workflow with a `SKILL.md`, optional supporting scripts, and a focused trigger description so an agent can pick the right tool quickly.

## Skill Index

### Coding, Agents, And Workstations

#### Kakuna Codebase Hardening Suite

Use these skills as a hardening progression: prevent new slop, harden the existing codebase as-is, add product services, then tighten safety, operability, and quality gates.

<img src="./assets/kakuna-codebase-hardening.png" alt="Kakuna Codebase Hardening Suite logo: a cute armored cocoon mascot inside a code shield" height="250" align="left">

**Foundation**

- [codebase-maintainability-guardrails](./codebase-maintainability-guardrails) — **Default engineering standards.** Always-on rules for small, typed, feature-owned, contract-driven, behavior-preserving, visually verified app work.
- [antislop-codebase](./antislop-codebase) — **Structural cleanup/migration.** Staged refactors for messy or prototype repos as they already are, with concurrent workers, better tests, smaller files, clearer module boundaries, and a final migration audit microsite.

**Productization**

- [productionize-app-with-services](./productionize-app-with-services) — **Operational/product hardening.** Adds product services after the codebase is coherent enough to operate: audit trails, role-aware permissions, API keys, REST/OpenAPI/agent docs, PostHog instrumentation, feature flags, admin UX, deploy smokes, and a final audit microsite.

**Safety**

- [security-hardening](./security-hardening) — **Practical appsec pass.** Reviews auth/session risk, secrets, dependency exposure, SSRF/uploads, CORS/CSRF, rate limits, input validation, unsafe logging, permission bypasses, and security headers.

**Operability**

- [observability-hardening](./observability-hardening) — **Production visibility.** Adds privacy-safe structured logs, error classes, request IDs, traces, metrics, dashboards, alert thresholds, user-visible operation status, and debug paths.
- [release-readiness-hardening](./release-readiness-hardening) — **Safe ship gates.** Defines env validation, deploy checklist, smoke tests, rollback path, feature flags, migration checks, production verification, and post-deploy monitoring.

**Quality**

- [test-strategy-hardening](./test-strategy-hardening) — **Trustworthy tests.** Audits whether tests carry their weight, then hardens flaky tests, contract tests, golden-path e2e, regression fixtures, runtime, dedupe, and coverage quality.

<br clear="left">

#### Other coding/workstation skills

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
