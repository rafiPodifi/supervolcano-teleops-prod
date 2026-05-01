# Security

## Reporting

Email security reports to **security@supervolcano.com** (or open a private
GitHub security advisory). Do not file public issues for vulnerabilities.

## Known issues (open)

### Robot API key leaked in git history (priority: high)

A demo Robot API key was committed in plaintext starting in commit
`0c636c4` (2025) and propagated across multiple docs and example files.
The key was scrubbed from the working tree on 2026-05-01 (repo cleanup
Phase D), but **remains accessible in git history**.

**Required actions:**

1. **Rotate the leaked key.** Until rotated, anyone with read access to
   the repo (or its mirror/forks) can authenticate as the demo robot.
2. After rotation, decide:
   - **Accept the leak**: leaked key is rotated, no further action.
   - **Scrub history**: run `git filter-repo` or BFG-Repo-Cleaner against
     the leaked hash. This rewrites history — every fork/clone must
     re-clone afterward. Coordinate with anyone holding a working copy
     before doing this.

The leaked hash (for the scrub script):

```
9c5eff2e114ebed6a5f93f132cfb9adb7f2dc9c551c9451aa6360237d699284ef
```

## Secret-handling rules

- Never commit live API keys, service-account JSON, signing certs, or
  credentials of any form.
- `.env*` and `*.env` are gitignored. Confirm before any `git add -A`.
- Service-account files are gitignored by exact filename in `.gitignore`.
  Add new ones to `.gitignore` before downloading.
- Place sample values in `.env.example` (Phase E adds these). Use
  obvious placeholders like `<YOUR_KEY>` or `your-project-id`.

## Auth model

See `docs/architecture/ARCHITECTURE.md` for the role/permission system
and `docs/runbooks/SECURITY_AUDIT.md` for the most recent audit notes.
