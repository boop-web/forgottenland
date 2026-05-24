# Safety Rules for AI Agents

## CRITICAL: Never overwrite ForgottenlandGame.tsx without a backup
Before editing `src/components/ForgottenlandGame.tsx`, ALWAYS run:
```powershell
powershell -ExecutionPolicy Bypass -File backup.ps1
```
This saves a timestamped copy to `backups/ForgottenlandGame_YYYYMMDD-HHmmss.tsx`.

## Restoring from backup
Check `backups/` folder.
Copy the desired backup back to `src/components/ForgottenlandGame.tsx`.

## Working copy
Single project at: `C:\Users\UCA\Documents\.forgottenland`
Dev server: `bun run dev` (via `C:\Users\UCA\.bun\bin\bun.exe`)
Build: `bun run build`
Typecheck: `bunx tsc --noEmit` or `node_modules\.bin\tsc --noEmit`
