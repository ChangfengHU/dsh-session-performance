# DSH Session Performance

A small, reversible host plugin for DeepSeek Harness. Session lists carry navigation metadata, not the full prompt and tool schemas for every conversation.

## What It Changes

The native session.list response retains every session, its title, timestamps, running/blank status, workspace path, agent preset and lineage. Projection data is restricted to title, sessionListMetadata and subagent. The native gateway still performs its normal visibility, persistence and error handling.

This release does not claim server-side list pagination. It preserves native message-history pagination and full selected-session history, including Context and Trace data. Cursor pagination and explicit diagnostic reads are separate work and must preserve search, direct links and reconnect behavior.

## Install

Install the package into the existing DSH Web profile using the normal plugin installer, then restart when no turn is active. No new server, database or browser asset is added.

## Development

Run npm test and npm run check. Tests cover metadata fidelity, no mutation, errors, 1000 summaries, untouched history and disposal. All source and Git operations for this deployment run on Linux 114.

## Security And Data

No session data is deleted or rewritten. No credentials, models, prompts, filesystem permissions or API authentication are changed. Unloading the plugin restores its response boundary.

