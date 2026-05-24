# CONTINUE HERE - Checkpoint

## Current state
All Phase 1 (rule-based AI) completed. Phase 2 (AiBridge) completed. Yuka.js integrated.

## Phases remaining
- **Phase 3**: Dual AI control hooks (advanced) — refine what commands the LLM can issue, add build position selection, wave targeting influence, better chat flow
- **Phase 4**: Config UI (model selection, temperature per AI, personality prompt editing)
- **Phase 5**: Captain system (wave 10+ special units)

## Key files
- `src/components/KingshotGame.tsx` (~4772 lines) — all game code
- `src/lib/aiBridge.ts` (173 lines) — AiBridge class (state serializer, dual Ollama clients, chat log)

## AiBridge interface
```typescript
// Create instance once (after `const game = {...}`):
const aiBridge = new AiBridge();

// Call every frame in update():
aiBridge.tick(game, frame);

// Consume plans (done in update() loop):
if (aiBridge.bluePlan) {
  aiBridge.bluePlan = null;
  // handle spawnSoldier, buildTower, upgradeTower
}
if (aiBridge.redPlan) {
  aiBridge.redPlan = null;
  // handle spawnEnemy
}
```

## AI Bridge fallback
When Ollama is offline (throws), AiBridge uses fallback plans:
- Blue: 60% chance `spawnSoldier`
- Red: random enemy type spawn

## Road graph + yuka AStar
- `buildRoadGraph()` in `refreshWallSegments()` and `init()`
- `yukaGraph: Graph` maintained alongside `roadNodes: RoadNode[]`
- `findPath(fromId, toId)` uses `AStar.search(yukaGraph, fromId, toId, HeuristicPolicyEuclidSquared)`
- `snapToNearestRoad(x, y)` → node index
- `Soldier.setRoadTarget(tx, ty)` + `Soldier.followRoad(maxSpd)` methods
- Fallback: direct `walkToward` when `roadNodes.length <= 1`

## Soldier behavior
- `postTower: TowerPad | null` — assigned on spawn to nearest perimeter tower
- Threat targeting prioritizes damaged walls/towers near `postTower` (-40 weight bonus)
- Heals both damaged walls (30px range) and towers (30px range)
- Wall-assigned soldiers defend their wall segment preferentially

## Chat rendering
Canvas HUD on right side: last 8 AI chat messages. Blue = `#52aaff`, Red = `#ff5252`.

## Key commands
```bash
cd "C:\Users\UCA\Documents\ksr-clean"
& "C:\Users\UCA\.bun\bin\bun.exe" dev  # run dev server
ollama serve                            # start Ollama
ollama pull qwen2.5:3b                  # pull model
```

## Known pre-existing TS errors (not from our changes)
- Line 3465: `Math.max(0, 1 - t * 2.5)` — `t` not typed as number
- Line 4143: `const tip = pri => ...` — `pri` implicitly `any`

## Next improvement to make
The most impactful next step is Phase 3: make the AI actually control the game effectively. Currently the AiBridge sends state and parses commands, but the command set is basic. Improve the LLM prompts with richer state info and more nuanced commands (e.g., "build_tower at position near damaged wall", "target_tower for focused attack").
