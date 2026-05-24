# Safety Rules for AI Agents

## CRITICAL: Never overwrite KingshotGame.tsx without a backup
Before editing `src/components/KingshotGame.tsx`, ALWAYS run:
```powershell
powershell -ExecutionPolicy Bypass -File backup.ps1
```
This saves a timestamped copy to `backups/KingshotGame_YYYYMMDD-HHmmss.tsx`.

## Restoring from backup
Check `backups/` folder — files are named `KingshotGame_20260524-183000.tsx`.
Copy the desired backup back to `src/components/KingshotGame.tsx`.

## Working copy
Single project at: `C:\Users\UCA\Documents\kingshot`
Dev server: `bun run dev` (via `C:\Users\UCA\.bun\bin\bun.exe`)
Build: `bun run build`
Typecheck: `bunx tsc --noEmit` or `node_modules\.bin\tsc --noEmit`
