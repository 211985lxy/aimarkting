## Project Overview

`social-auto-upload` is the Python social-platform automation subsystem. The current mainline is the `sau` CLI plus platform skills; the historical Flask/Vue web UI remains in the tree but is not the preferred integration path for new work.

Supported mainline CLI platforms:

- Douyin
- Kuaishou
- Xiaohongshu
- Bilibili

Browser automation depends on real platform login state and real local account cookie files. Do not add fake upload success paths or mocked platform responses.

## Setup

Prefer the documented installer:

```bash
cd social-auto-upload
python -m venv .venv
source .venv/bin/activate
pip install -e .
```

See `docs/install.md`, `docs/update.md`, and `docs/CLI.md` for the user-facing flow.

## CLI

Login:

```bash
sau douyin login --account <account_name>
```

Check:

```bash
sau douyin check --account <account_name>
```

Upload video:

```bash
sau douyin upload-video --account <account_name> --file <video_file> --title <title> --desc <desc>
```

Upload note:

```bash
sau douyin upload-note --account <account_name> --images image1.png image2.png --title <title> --note <body>
```

## Development Conventions

- Platform implementations live under `uploader/`.
- CLI/docs/skill surfaces should stay aligned: if a platform command changes, update `docs/CLI.md` and the matching `skills/*/SKILL.md`.
- `requirements.txt` and `sau_frontend/` are compatibility paths; prefer `pyproject.toml` and the `sau` CLI for new work.
- Saved login state lives under `cookies/`; treat it as local runtime state, not source material.
