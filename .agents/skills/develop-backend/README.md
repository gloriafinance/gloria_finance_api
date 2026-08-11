# develop-backend

Generic senior backend engineering skill for Codex and OpenCode.

This skill is intentionally independent of:

- any specific repository;
- any product or business domain;
- any database;
- any cloud provider;
- any programming language;
- any framework.

It contains reusable principles for architecture, implementation, debugging, testing, reviews, queues, integrations, security, observability, databases, and deployment.

## Files

```text
develop-backend/
├── SKILL.md
└── README.md
```

## OpenCode

Project-local:

```text
.agents/skills/develop-backend/SKILL.md
```

or:

```text
.opencode/skills/develop-backend/SKILL.md
```

Global:

```text
~/.config/opencode/skills/develop-backend/SKILL.md
```

Example:

```bash
mkdir -p .agents/skills/develop-backend
cp SKILL.md .agents/skills/develop-backend/SKILL.md
```

## Codex

Install or import the folder containing `SKILL.md` through the Skills mechanism available in your Codex environment.

Keep the folder name and `SKILL.md` filename unchanged.

## Suggested usage

```text
Use develop-backend to implement this API endpoint.
```

```text
Use develop-backend to review this pull request.
```

```text
Use develop-backend to debug this worker and propose the minimum safe fix.
```

```text
Use develop-backend to design the persistence and concurrency model for this feature.
```
