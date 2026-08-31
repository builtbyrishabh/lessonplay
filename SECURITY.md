# Security Policy

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately through GitHub:
[**Report a vulnerability**](https://github.com/builtbyrishabh/lessonplay-mastra/security/advisories/new)
— this opens a private advisory visible only to maintainers.

Expect an acknowledgement within 72 hours and an assessment within a week.
If a fix is warranted, you'll be credited in the advisory unless you'd rather
not be.

## Supported versions

This project is pre-1.0 and actively developed. Only `main` receives security
fixes.

## Scope

This repo runs model-generated code, so a few areas deserve extra scrutiny.
Findings here are especially welcome:

- **Sandbox escape.** The agent executes generated code in a Daytona VM.
  Anything that reaches the host, another tenant, or another user's thread.
- **The publish gate.** Any path that reaches `current/index.html` without
  passing validation — the gate is the project's core safety property.
- **Cross-tenant storage access.** Objects are keyed
  `games/<userId>/<threadId>/`. Anything that lets one user read or write
  another's prefix.
- **Prompt injection with real consequences.** Uploaded chapter text is
  untrusted input. Injection that causes data exfiltration or unauthorized tool
  calls — not merely a rude reply — is in scope.
- **Auth bypass** around Clerk middleware and tRPC `protectedProcedure`.

### Known and accepted

These are documented design tradeoffs, not vulnerabilities:

- **Published games are public by key.** The R2 bucket serves objects to anyone
  holding the URL; secrecy rests on the random path prefix. This is deliberate —
  a teacher shares one link with a class, and the AI Gateway must be able to
  re-fetch uploads on every turn, so the URLs cannot expire. Do not put anything
  confidential in a game.
- **Generated games run arbitrary JS in the player's browser**, sandboxed by
  the same-origin rules of the iframe that hosts them.

## For contributors

Never commit a `.env`. Only `.env.example` belongs in the repo, and it must
contain placeholders — never a real key. If you push a live credential, rotate
it immediately; assume anything that reached GitHub is compromised.
