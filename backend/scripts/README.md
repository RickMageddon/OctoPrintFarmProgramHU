set-admin-flags.js
===================

Purpose
-------
Small utility to set `github_org_member` and `is_admin` flags in the project's SQLite database. Useful when you can't test locally and need to flip a user's admin flag on the mini PC.

Location
--------
backend/scripts/set-admin-flags.js

Examples
--------
Run in PowerShell on the mini PC (from project root):

```powershell
cd C:\path\to\OctoPrintFarmProgramHU\backend
node scripts\set-admin-flags.js --username RickMageddon --org 1 --admin 1
```

Dry-run (no changes):

```powershell
node scripts\set-admin-flags.js --username RickMageddon --org 1 --admin 1 --dry-run
```

Set for all users (careful):

```powershell
node scripts\set-admin-flags.js --all --org 0 --admin 0
```

Notes
-----
- The script creates a timestamped backup of `database/database.db` before changing it.
- It requires Node.js and uses the existing `sqlite3` dependency included in `backend/package.json`.
- If you need to target by email or id, use `--email` or `--id` instead of `--username`.
