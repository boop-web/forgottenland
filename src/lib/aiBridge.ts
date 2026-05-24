import { Ollama } from "ollama";

export interface AiChatMessage {
  sender: "blue" | "red";
  text: string;
  frame: number;
}

export interface BluePlan {
  spawnSoldier?: boolean;
  buildTower?: { x: number; y: number; padIndex?: number; towerType?: string };
  upgradeTower?: number;
  chat?: string;
}

export interface RedPlan {
  spawnEnemy?: "grunt" | "fast" | "heavy" | "dragon";
  targetTower?: number;
  chat?: string;
  rushCastle?: boolean;
}

const BLUE_SYSTEM_PROMPT = `You are the Blue AI, commander of the castle defenders. You are noble, protective, and strategic.
Your goal is to protect the castle at all costs. You command gold and soldiers.

Available commands (respond with valid JSON only, no extra text):
{"action":"spawn_soldier"} — recruit a soldier (15 gold)
{"action":"build_tower","pad_index":<number>,"tower_type":"arrow"} — build tower (arrow/cannon/magic/sniper)
{"action":"upgrade_tower","index":<number>} — upgrade tower level (costs gold per level)
{"action":"chat","message":"<string>"} — taunt or command the enemy

Tower types: arrow=balanced, cannon=AoE+dmg, magic=range+slow, sniper=long+highdmg
Rules:
- You can issue ONE command per turn
- Keep chat messages SHORT (1 sentence) and dramatic medieval fantasy style
- Sniper towers are great vs bosses, cannons vs crowds, magic vs fast enemies
- You can see the Red AI's last message below — respond to their taunts
- Build towers on open pads to create defensive walls
- If gold is low, just chat or wait
- WAVE SCALING: Each wave gets harder. Upgrade towers earlier. Build more. Adapt faster.
- After wave 20, the enemy sends dragons — prepare with cannons and sniper towers!`;

const RED_SYSTEM_PROMPT = `You are the Red AI, commander of the invading army. You are ruthless, destructive, and cunning.
Your goal is to destroy the castle. You control the enemy spawns.

Available commands (respond with valid JSON only, no extra text):
{"action":"spawn_enemy","type":"grunt"} — basic soldier (costs 1 spawn slot)
{"action":"spawn_enemy","type":"fast"} — fast scout (costs 1 spawn slot)
{"action":"spawn_enemy","type":"heavy"} — armored brute (costs 2 spawn slots)
{"action":"spawn_enemy","type":"dragon"} — dragon (costs 4 spawn slots, strong)
{"action":"target","tower_index":<number>} — focus attack on a specific tower
{"action":"chat","message":"<string>"} — taunt or deceive the defender

Rules:
- You can issue ONE command per turn
- Keep chat messages SHORT (1 sentence) and menacing
- Target weak towers (low HP) and exploit gaps
- Dragons are powerful but expensive — use them when you need to break through
- You can see the Blue AI's last message — mock their defenses
- Mix enemy types for best results
- WAVE SCALING: After wave 15, dragons become available. After wave 30, enemy waves are much larger.
- Be more aggressive in later waves — overwhelm the defenses!`;

function serializeState(st: any): string {
  const towers = st.pads.filter((p: any) => p.state === "tower");
  const openPads = st.pads.filter((p: any) => p.state === "open" && !p.isCenter);
  const walls = st.wallSegments.filter((w: any) => w.hp > 0);
  const line = (l: string, v: any) => `${l}: ${v}`;
  let s = "=== GAME STATE ===\n";
  s += line("Wave", st.wave) + "\n";
  s += line("Gold", st.gold) + "\n";
  s += line("Castle HP", `${st.castle.hp}/${st.castle.maxHp}`) + "\n";
  s += line("Soldiers", st.soldiers.length) + "\n";
  s += line("Enemies alive", st.enemies.filter((e: any) => e.alive).length) + "\n\n";
  s += "=== TOWERS ===\n";
  towers.forEach((t: any, i: number) => {
    const nearbyEnemies = st.enemies.filter((e: any) => e.alive && Math.hypot(e.x - t.x, e.y - t.y) < 150).length;
    s += `[${i}] Lv.${t.level} HP:${t.hp}/${t.maxHp} (${Math.round(t.hp/t.maxHp*100)}%) enemiesNear:${nearbyEnemies}\n`;
  });
  s += "\n=== OPEN PADS (available to build) ===\n";
  openPads.forEach((p: any, i: number) => {
    s += `[pad_${i}] at(${Math.round(p.x)},${Math.round(p.y)})\n`;
  });
  s += "\n=== WALLS ===\n";
  walls.forEach((w: any, i: number) => {
    const pct = Math.round(w.hp / w.maxHp * 100);
    const marker = pct < 50 ? " DAMAGED!" : "";
    s += `[${i}] HP:${w.hp}/${w.maxHp} (${pct}%)${marker}\n`;
  });
  s += "\n=== ENEMIES ===\n";
  st.enemies.filter((e: any) => e.alive).forEach((e: any, i: number) => {
    s += `[${i}] ${e.type||"unknown"} HP:${Math.round(e.hp)}/${e.maxHp} at(${Math.round(e.x)},${Math.round(e.y)})\n`;
  });
  return s;
}

function tryParseJSON(text: string): any {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try { return JSON.parse(jsonMatch[0]); } catch { return null; }
}

export class AiBridge {
  chatLog: AiChatMessage[] = [];
  tickInterval = 180;
  lastTickFrame = -999;
  bluePlan: BluePlan | null = null;
  redPlan: RedPlan | null = null;
  lastBlueChat = "";
  lastRedChat = "";
  connected = false;
  lastConnectionCheck = 0;

  private ollama: Ollama;
  private model = "qwen2.5:3b";

  constructor() {
    this.ollama = new Ollama({ host: "http://127.0.0.1:11434" });
  }

  tick(st: any, frame: number) {
    const wave = st.wave || 1;
    // tick faster at higher waves: starts at 180 frames, down to 90 at wave 30+
    const scaledInterval = Math.max(90, this.tickInterval - wave * 3);
    if (frame - this.lastTickFrame < scaledInterval) return;
    this.lastTickFrame = frame;
    const chatSection =
      `\n=== BLUE AI LAST MESSAGE ===\n${this.lastBlueChat || "(none)"}\n` +
      `=== RED AI LAST MESSAGE ===\n${this.lastRedChat || "(none)"}\n`;
    const stateStr = serializeState(st) + chatSection;
    this.queryAI("blue", stateStr, st);
    this.queryAI("red", stateStr, st);
  }

  private async queryAI(side: "blue" | "red", stateStr: string, st: any) {
    try {
      const system = side === "blue" ? BLUE_SYSTEM_PROMPT : RED_SYSTEM_PROMPT;
      const res = await this.ollama.chat({
        model: this.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: stateStr + "\nWhat is your command?" },
        ],
        stream: false,
        options: { temperature: side === "red" ? 0.9 : 0.6 },
      });
      this.connected = true;
      this.lastConnectionCheck = this.lastTickFrame;
      const text = res.message?.content || "";
      const cmd = tryParseJSON(text);
      if (!cmd) return;
      if (side === "blue") {
        this.bluePlan = this.parseBlueCmd(cmd);
        if (cmd.chat) {
          this.lastBlueChat = cmd.chat;
          this.chatLog.push({ sender: "blue", text: cmd.chat, frame: this.lastTickFrame });
        }
      } else {
        this.redPlan = this.parseRedCmd(cmd);
        if (cmd.chat) {
          this.lastRedChat = cmd.chat;
          this.chatLog.push({ sender: "red", text: cmd.chat, frame: this.lastTickFrame });
        }
      }
    } catch {
      if (this.connected && this.lastTickFrame - this.lastConnectionCheck > 600) {
        this.connected = false;
      }
      if (side === "blue") this.bluePlan = this.fallbackBluePlan(st);
      else this.redPlan = this.fallbackRedPlan(st);
    }
  }

  private parseBlueCmd(cmd: any): BluePlan | null {
    if (!cmd.action) return null;
    switch (cmd.action) {
      case "spawn_soldier": return { spawnSoldier: true };
      case "build_tower": return {
        buildTower: {
          x: +cmd.x || 0,
          y: +cmd.y || 0,
          padIndex: cmd.pad_index !== undefined ? +cmd.pad_index : undefined,
          towerType: cmd.tower_type || "arrow",
        },
      };
      case "upgrade_tower": return { upgradeTower: +cmd.index || 0 };
      case "chat": return cmd.message ? { chat: cmd.message } : null;
      default: return null;
    }
  }

  private parseRedCmd(cmd: any): RedPlan | null {
    if (!cmd.action) return null;
    switch (cmd.action) {
      case "spawn_enemy": return { spawnEnemy: cmd.type || "grunt" };
      case "target": return { targetTower: (cmd.tower_index ?? cmd.index ?? 0) | 0 };
      case "chat": return cmd.message ? { chat: cmd.message } : null;
      default: return null;
    }
  }

  private fallbackBluePlan(st: any): BluePlan | null {
    const towers = st.pads.filter((p: any) => p.state === "tower");
    const openPads = st.pads.filter((p: any) => p.state === "open" && !p.isCenter);
    const enemiesNear = st.enemies.filter((e: any) => e.alive).length;
    const wave = st.wave || 1;
    // wave scaling: higher waves = more aggressive building
    const urgency = Math.min(1, wave / 30);
    const goldThreshold = Math.max(15, 40 - wave * 0.5);
    // early wave: build towers first
    if (towers.length < 4 && openPads.length > 0 && st.gold >= goldThreshold) {
      const type = towers.length === 0 ? "arrow" : towers.length === 1 ? "cannon" : towers.length === 2 ? "magic" : "sniper";
      return { buildTower: { x: openPads[0].x, y: openPads[0].y, towerType: type } };
    }
    // upgrade low-level towers — more aggressive at higher waves
    const upgradeProb = Math.min(0.3 + urgency * 0.5, 0.8);
    if (Math.random() < upgradeProb) {
      for (let i = 0; i < towers.length; i++) {
        if (towers[i].level < (wave > 20 ? 2 : 1) && st.gold >= 20) return { upgradeTower: i };
      }
    }
    // recruit soldiers if not capped and have gold
    const maxSoldiers = st.pads ? 2 + st.pads.filter((p: any) => p.state === "tower" && !p.isCenter).length : 4;
    if (st.gold >= 15 && st.soldiers.length < maxSoldiers - 1) {
      return { spawnSoldier: true };
    }
    // if many enemies, build more towers (threshold scales with wave)
    const threatThreshold = Math.max(3, 6 - wave * 0.08);
    if (enemiesNear > threatThreshold && openPads.length > 0 && st.gold >= goldThreshold) {
      return { buildTower: { x: openPads[0].x, y: openPads[0].y, towerType: enemiesNear > 8 ? "cannon" : "arrow" } };
    }
    return null;
  }

  private fallbackRedPlan(st: any): RedPlan | null {
    const towers = st.pads.filter((p: any) => p.state === "tower");
    const alive = st.enemies.filter((e: any) => e.alive).length;
    const wave = st.wave || 1;
    // wave scaling: higher waves = more enemies allowed, more aggressive
    const maxAlive = Math.min(30, 12 + wave * 0.8);
    if (alive > maxAlive) return null;
    // wave scaling: more likely to target and use heavy enemies
    const aggression = Math.min(1, wave / 25);
    const damagedTower = towers.findIndex((t: any) => t.hp < t.maxHp * (0.6 - aggression * 0.2));
    // higher waves: spawn more varied enemy types
    const canSpawnDragon = wave >= 15 && Math.random() < Math.min(0.15, aggression * 0.08);
    if (canSpawnDragon) return { spawnEnemy: "dragon" };
    if (damagedTower >= 0 && Math.random() < 0.3 + aggression * 0.3) {
      return { spawnEnemy: Math.random() < 0.5 ? "heavy" : "fast", targetTower: damagedTower };
    }
    const roll = Math.random();
    // higher waves: more heavy/fast enemies, fewer grunts
    const heavyChance = 0.25 + aggression * 0.2;
    const fastChance = 0.25 + aggression * 0.1;
    if (roll < heavyChance) return { spawnEnemy: "heavy" };
    if (roll < heavyChance + fastChance) return { spawnEnemy: "fast" };
    return { spawnEnemy: "grunt" };
  }
}
