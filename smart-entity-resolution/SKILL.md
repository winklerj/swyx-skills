---
name: smart-entity-resolution
description: Use when designing, debugging, or reviewing named-entity search and resolution for people or organizations in messy databases with aliases, duplicates, sparse records, common names, candidate reranking, or misleading search results.
---

# Smart Entity Resolution

Search wide, decide late, and expose alternates. The goal is not to make one perfect string query. The goal is to turn a fuzzy person or organization request into a transparent candidate set, enrich that set with evidence, let an LLM or reranker choose with context, and preserve enough runner-up information that a human or later agent can correct mistakes quickly.

This skill applies to celebrity/reference-image search, casts and groups, CRM/contact databases, org directories, IMDB-like profiles, public-company databases, and any system where many records can share names, aliases, or partial identifiers.

## Core Principle

Treat entity resolution as a staged investigation, not a lookup. Exact search, slug lookup, popularity, and LLM judgment are all useful signals, but none should silently dominate the others.

Always separate three questions:

- Coverage: did we enumerate all requested entities?
- Identity: does this candidate represent the requested person or organization?
- Utility: is this the best usable record for the task?

A high-utility record with weak identity evidence is a false-positive risk. A correct but sparse record may be acceptable, but the system should show richer alternates if they plausibly represent the same entity.

## Workflow

1. Classify the query before searching. Detect whether it is a single entity, a list of entities, or a fuzzy group/cast/member/team/org query. Terms like `members`, `cast`, `lineup`, `team`, `company`, `subsidiaries`, and `leadership` usually mean expansion is needed.

2. Expand fuzzy queries into entity groups. Use LLM plus web/search tools when needed to enumerate individuals or organizations. Keep aliases grouped under one entity, such as a stage name plus legal name plus romanization. Do not flatten aliases so early that different entities compete in one global pool.

3. Search wide per entity group. For each entity, search multiple aliases, cleaned variants, exact slug or direct-id candidates when the target database supports them, and contextualized short-name queries such as `<group> <short name>`. Use local per-entity query tracking; global query de-duping can starve later entities with common aliases.

4. Merge candidates by stable record identity. Deduplicate by profile id, slug, canonical URL, database id, or another stable key. Preserve every query and source that found the candidate rather than keeping only the highest-scoring path.

5. Enrich candidates before reranking. Gather conceptual evidence across identity, provenance, utility, ambiguity, and confidence. The reranker should never be asked to choose from names alone.

6. Run an adaptive LLM rerank loop with a hard budget. Default to at most 3 loops. Continue only when coverage is incomplete, candidates are all low-confidence, or more evidence is likely to distinguish between top candidates. Stop when all requested entities have plausible candidates, the budget is exhausted, or additional search is unlikely to help.

7. Return or show alternates every time. The output should include the selected candidate plus the top 3-6 runner-ups with enough evidence for a user or agent to understand and override the choice.

8. Treat unresolved and uncertain as first-class outcomes. Prefer `needs review`, `no plausible match`, or `ambiguous` over silently filling a high-utility false positive.

## Evidence Model

Keep the evidence conceptual and portable. Do not overfit to one site's fields.

- Identity evidence: exact name or id match, aliases, stage names, legal names, romanization variants, shared tokens, missing primary tokens, context match, known organization/group relationship, and conflicting names.
- Provenance evidence: which query found the candidate, whether it came from search, exact slug, direct URL, database id, API lookup, web result, user-provided source, or a recovery pass.
- Utility evidence: image count, profile completeness, activity, popularity, views, votes, list count, employee count, relationship count, verified status, recency, and whether the record has usable media or metadata for the task.
- Ambiguity evidence: short/common name, surname-only match, initials, duplicate records, group/project pages, "and the" pages, sparse records, conflicting aliases, old names, merged organizations, subsidiaries, or similarly named public figures.
- Confidence evidence: selected candidate, runner-up candidates, reranker reason, unresolved status, needs-human-review flag, and coverage status for the original query.

## Reranking Rules

Prefer LLM reranking when the database is messy, but constrain it with evidence and budgets.

- Give the reranker the original query, resolved entity label, aliases, candidate names/ids/URLs, provenance, identity evidence, utility evidence, and ambiguity warnings.
- Instruct it to choose identity before utility. It must not pick an image-rich or popular candidate if identity evidence is weak.
- For plausibly same-identity candidates, let utility decide. Public stage-name or brand-name records can be better than legal-name records if they have stronger task-relevant evidence.
- Treat one-token aliases as ambiguous unless supported by context, exact id/slug, richer alias overlap, or strong external evidence.
- Avoid hard accept rules. A direct alias hit is a signal, not proof.
- Avoid hard reject rules. Romanized, rebranded, sparse, or stage-name records can look incomplete but still be correct.
- If the LLM chooses a low-utility candidate while a same-identity candidate has much better utility, prefer a second rerank or expose the richer alternate rather than silently overriding.
- Log or display the reason for the selected candidate and keep alternates visible.

## Failure Modes

Use these as review checks when a resolver "mostly works" but feels wrong.

- Exact database search can miss real records. Probe exact slugs, direct URLs, ids, or alternate endpoints when available.
- Short names create false positives. `Lisa`, `Rose`, `Sunny`, `Tiffany`, `Yuri`, and similar one-token names need contextual searches and ambiguity warnings.
- Legal names can be worse utility records. Public/stage names or brand names may have the fuller profile, more images, or more current metadata.
- Utility signals are powerful but unsafe alone. Counts, votes, views, and popularity should break ties only after identity plausibility.
- Composite aliases are useful context but often poor literal search strings. Split them into aliases while preserving the group identity.
- Hard direct-accept logic is brittle. It can grab a generic duplicate just because one alias matched.
- Hard identity gates are brittle. They can hide correct records when names are sparse, translated, romanized, rebranded, or stage-name-only.
- Coverage count is not correctness. Finding 6 of 6 entities is not success if one selected record is the wrong person or organization.
- Global query de-duping can starve later entities. Common aliases should be tracked per entity group.
- Source flakiness is part of the result. Timeouts, 403s, 404s, retries, and partial data should be surfaced in provenance or debug logs.

## Output Pattern

For each requested entity, prefer an output shape with these concepts:

- Resolved entity label and aliases.
- Selected candidate with stable id/slug/URL.
- Selection reason and confidence or review status.
- Top alternates with enough evidence to compare.
- Coverage state: matched, ambiguous, no plausible match, no usable data, or needs review.
- Provenance: searched queries, source endpoints, retry/recovery attempts, and failure notes.

For user-facing tools, make manual correction easy. Good controls include `choose this candidate`, `search only this candidate`, `copy id/slug`, `show evidence`, and `mark unresolved`.

## Review Questions

Before claiming a resolver works, ask:

- Did expansion enumerate every requested person or organization?
- Are aliases grouped by entity, or did all aliases become one global bag?
- Does each entity have multiple candidate searches, including contextual searches for short/common aliases?
- Does the reranker see evidence beyond names?
- Are selected candidates and runner-ups visible?
- Can a user override a wrong #1 without restarting the whole workflow?
- Are identity, utility, and coverage measured separately?
- Are unresolved and ambiguous outcomes allowed?
- Did tests include common-name false positives, sparse correct records, rich wrong records, duplicate records, exact-search misses, and direct-id/slug recovery?
- Are source failures and retries visible enough to debug inconsistent results?
