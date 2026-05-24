import { useEffect, useRef } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Vec = { x: number; y: number };
type PowerType = "speed" | "damage" | "shield" | "viking";

const COST_CASTLE = [40, 90, 180];
const COST_WALL = 25;
const COST_GARRISON = 35;
const MAP_W = 2000;
const MAP_H = 2000;

export default function ForgottenlandGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const goldRef = useRef<HTMLSpanElement>(null);
  const waveRef = useRef<HTMLSpanElement>(null);
  const armyRef = useRef<HTMLSpanElement>(null);
  const hpRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;

    const resize = () => {
      const size = Math.min(window.innerWidth, window.innerHeight) * 0.96;
      canvas.width = size;
      canvas.height = size;
    };
    resize();
    window.addEventListener("resize", resize);

    const W = () => canvas.width;
    const H = () => canvas.height;
    const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    /* snow + decor */
    const snow = Array.from({ length: 90 }, () => ({
      x: Math.random() * 1000, y: Math.random() * 1000,
      r: Math.random() * 2 + 0.5,
      vy: Math.random() * 0.6 + 0.3, vx: (Math.random() - 0.5) * 0.3,
    }));
    const trees: { x: number; y: number; s: number }[] = [];
    const rocks: { x: number; y: number; r: number }[] = [];

    const seedWorld = () => {
      trees.length = 0; rocks.length = 0;
      const safe = (x: number, y: number, m = 60) => {
        for (const p of game.pads) if (Math.hypot(p.x - x, p.y - y) < m) return false;
        if (game.castle && Math.hypot(game.castle.x - x, game.castle.y - y) < 110) return false;
        return true;
      };
      for (let i = 0; i < 60; i++) {
        let x = 0, y = 0, tries = 0;
        do { x = Math.random() * MAP_W; y = Math.random() * MAP_H; tries++; }
        while (!safe(x, y, 70) && tries < 20);
        trees.push({ x, y, s: 0.7 + Math.random() * 0.7 });
      }
      for (let i = 0; i < 30; i++) {
        let x = 0, y = 0, tries = 0;
        do { x = Math.random() * MAP_W; y = Math.random() * MAP_H; tries++; }
        while (!safe(x, y, 50) && tries < 20);
        rocks.push({ x, y, r: 4 + Math.random() * 6 });
      }
    };

    /* particles */
    const particles: any[] = [];
    const addBurst = (x: number, y: number, color: string, n = 8, speed = 3) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = Math.random() * speed + 1;
        particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 28, max: 28, color, r: Math.random() * 2 + 1 });
      }
    };

    const addRing = (x: number, y: number, color: string) => {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const s = 4;
        particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 16, max: 16, color, r: 2.5 });
      }
    };

    /* FloatText */
    class FloatText {
      x: number; y: number; text: string; color: string; alpha = 1; life = 0; dead = false;
      constructor(x: number, y: number, text: string, color: string) { this.x = x; this.y = y; this.text = text; this.color = color; }
      update() { this.y -= 1.1; this.life++; if (this.life > 26) this.alpha -= 0.045; if (this.alpha <= 0) this.dead = true; }
      draw() {
        ctx.globalAlpha = this.alpha;
        ctx.font = "bold 14px 'Cinzel', serif";
        ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,0.85)";
        ctx.textAlign = "center";
        ctx.strokeText(this.text, this.x, this.y);
        ctx.fillStyle = this.color; ctx.fillText(this.text, this.x, this.y);
        ctx.globalAlpha = 1; ctx.textAlign = "start";
      }
    }

    /* Coin */
    class Coin {
      x: number; y: number; r = 7; collected = false; life = 480; spin = Math.random() * Math.PI;
      constructor(x: number, y: number) { this.x = x; this.y = y; }
      update() { if (!this.collected) { this.life--; this.spin += 0.16; } }
      draw() {
        if (this.collected) return;
        const sw = Math.abs(Math.cos(this.spin)) * this.r + 2;
        const g = ctx.createLinearGradient(this.x - sw, 0, this.x + sw, 0);
        g.addColorStop(0, "#8a5a10"); g.addColorStop(0.5, "#ffd86b"); g.addColorStop(1, "#8a5a10");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(this.x, this.y, sw, this.r, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#5a3a08"; ctx.lineWidth = 1; ctx.stroke();
      }
    }

    /* PowerUp */
    class PowerUp {
      x: number; y: number; type: PowerType; r = 12; life = 600; collected = false; bob = Math.random() * 6;
      constructor(x: number, y: number, type: PowerType) { this.x = x; this.y = y; this.type = type; }
      update() { this.life--; this.bob += 0.1; }
      draw() {
        if (this.collected) return;
        const by = Math.sin(this.bob) * 3;
        const col = ({ speed: "#ffd86b", damage: "#ff5252", shield: "#52aaff" } as any)[this.type];
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath(); ctx.ellipse(this.x, this.y + this.r + by + 1, this.r * 0.8, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = col + "30";
        ctx.beginPath(); ctx.arc(this.x, this.y + by, this.r + 6, 0, Math.PI * 2); ctx.fill();
        const g = ctx.createRadialGradient(this.x - 3, this.y - 3 + by, 2, this.x, this.y + by, this.r);
        g.addColorStop(0, col); g.addColorStop(1, "#1a1a2a");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(this.x, this.y + by, this.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(({ speed: "⚡", damage: "🗡", shield: "🛡" } as any)[this.type], this.x, this.y + by + 1);
        ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
      }
    }

    /* SkillOrb — tower skill power-up that beeps on minimap */
    class SkillOrb {
      x: number; y: number; r = 10; life = 1200; collected = false; bob = Math.random() * 6;
      skillType: "firestorm" | "icewall" | "lightning";
      glow = Math.random() * 6;
      constructor(x: number, y: number) {
        this.x = x; this.y = y;
        const types: SkillOrb["skillType"][] = ["firestorm", "icewall", "lightning"];
        this.skillType = types[Math.floor(Math.random() * types.length)];
      }
      update() { this.life--; this.bob += 0.08; this.glow += 0.05; }
      draw() {
        if (this.collected) return;
        const by = Math.sin(this.bob) * 3;
        const col = { firestorm: "#ff6a20", icewall: "#52cfff", lightning: "#ffd86b" }[this.skillType];
        const icon = { firestorm: "🔥", icewall: "❄️", lightning: "⚡" }[this.skillType];
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath(); ctx.ellipse(this.x, this.y + this.r + by + 1, this.r * 0.7, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = col + "25";
        ctx.beginPath(); ctx.arc(this.x, this.y + by, this.r + 6, 0, Math.PI * 2); ctx.fill();
        const g = ctx.createRadialGradient(this.x - 2, this.y - 2 + by, 1, this.x, this.y + by, this.r);
        g.addColorStop(0, col); g.addColorStop(0.6, col + "80"); g.addColorStop(1, "#1a1a2a");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(this.x, this.y + by, this.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.font = "12px serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(icon, this.x, this.y + 1 + by);
        ctx.textAlign = "start"; ctx.textBaseline = "alphabetic";
      }
    }

    /* BloodDrop — trail behind viking player, spawns flowers later */
    class BloodDrop {
      x: number; y: number; life = 60; maxLife = 60; r = 2 + Math.random() * 2;
      constructor(x: number, y: number) { this.x = x; this.y = y; }
      update() { this.life--; }
      draw() {
        const a = this.life / this.maxLife;
        ctx.globalAlpha = a * 0.7;
        ctx.fillStyle = "#8a1a1a";
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r * (0.5 + a * 0.5), 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    /* Flower — blooms where blood fades */
    class Flower {
      x: number; y: number; life = 180; maxLife = 180; phase = 0;
      constructor(x: number, y: number) { this.x = x; this.y = y; }
      update() { this.life--; this.phase += 0.06; }
      draw() {
        const a = this.life / this.maxLife;
        const grow = Math.min(1, (1 - a) * 3);
        const sway = Math.sin(this.phase) * 2;
        const colors = ["#ff6b8a", "#ffd86b", "#c09aff", "#ff8a50", "#fff"];
        const col = colors[Math.floor(Math.abs(Math.sin(this.x * 0.1 + this.y * 0.07)) * colors.length)];
        ctx.globalAlpha = a * 0.9;
        // stem
        ctx.strokeStyle = "#3a7a2a"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(this.x, this.y + 6 * grow);
        ctx.quadraticCurveTo(this.x + sway, this.y + 3 * grow, this.x, this.y);
        ctx.stroke();
        // petals
        for (let i = 0; i < 5; i++) {
          const pa = (i / 5) * Math.PI * 2 + this.phase * 0.2;
          const pr = 3 * grow;
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.ellipse(this.x + Math.cos(pa) * pr, this.y + Math.sin(pa) * pr, 3 * grow, 2 * grow, pa, 0, Math.PI * 2); ctx.fill();
        }
        // center
        ctx.fillStyle = "#ffd86b";
        ctx.beginPath(); ctx.arc(this.x, this.y, 1.5 * grow, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    /* TreasureChest */
    class TreasureChest {
      x: number; y: number; r = 16; life = 900; collected = false; bob = Math.random() * 6; glow = 0;
      constructor(x: number, y: number) { this.x = x; this.y = y; }
      update() { this.life--; this.bob += 0.08; this.glow += 0.04; }
      draw() {
        if (this.collected) return;
        const by = Math.sin(this.bob) * 2;
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath(); ctx.ellipse(this.x, this.y + this.r + by + 2, this.r * 0.9, 4, 0, 0, Math.PI * 2); ctx.fill();
        // glow pulse
        ctx.fillStyle = `rgba(255,216,107,${0.15 + Math.sin(this.glow) * 0.1})`;
        ctx.beginPath(); ctx.arc(this.x, this.y + by, this.r + 8, 0, Math.PI * 2); ctx.fill();
        // chest body
        ctx.fillStyle = "#8a5a2a";
        ctx.fillRect(this.x - this.r, this.y - this.r + by, this.r * 2, this.r * 1.5);
        ctx.strokeStyle = "#3a2010"; ctx.lineWidth = 2;
        ctx.strokeRect(this.x - this.r, this.y - this.r + by, this.r * 2, this.r * 1.5);
        // lid
        ctx.fillStyle = "#a06a3a";
        ctx.fillRect(this.x - this.r - 2, this.y - this.r - 4 + by, this.r * 2 + 4, 8);
        ctx.strokeStyle = "#3a2010"; ctx.lineWidth = 2;
        ctx.strokeRect(this.x - this.r - 2, this.y - this.r - 4 + by, this.r * 2 + 4, 8);
        // lock
        ctx.fillStyle = "#ffd86b";
        ctx.fillRect(this.x - 3, this.y - 3 + by, 6, 6);
        ctx.fillStyle = "#8a5a10";
        ctx.beginPath(); ctx.arc(this.x, this.y + by, 3, 0, Math.PI * 2); ctx.fill();
      }
    }

    /* Player */
    class Player {
      x: number; y: number; r = 20; speed = 3.2; bob = 0;
      hp = 150; maxHp = 150; shield = 50; maxShield = 50; shieldRegenCd = 0;
      atkCd = 0; atkRate = 28; atk = 25; range = 75;
      collectR = 90; hitFlash = 0;
      dashCd = 0; dashTimer = 0; dashDir = { x: 0, y: 0 };
      slashAngle = 0; slashShow = 0;
      powerTimer = 0; powerType: PowerType | null = null;
      combo = 0; comboTimer = 0;
      bloodTrail: BloodDrop[] = []; bloodTimer = 0; axeSwing = 0; vikingAura = 0;
      constructor(x: number, y: number) { this.x = x; this.y = y; }
      update() {
        let dx = 0, dy = 0;
        if (game.joy.active) { dx = game.joy.dir.x; dy = game.joy.dir.y; }
        if (keys["ArrowUp"] || keys["KeyW"]) dy = -1;
        if (keys["ArrowDown"] || keys["KeyS"]) dy = 1;
        if (keys["ArrowLeft"] || keys["KeyA"]) dx = -1;
        if (keys["ArrowRight"] || keys["KeyD"]) dx = 1;
        const m = Math.hypot(dx, dy);
        if (m > 1) { dx /= m; dy /= m; }
        const spd = this.powerType === "speed" ? this.speed * 1.6 : this.speed;

        this.dashCd--;
        if (this.dashTimer > 0) {
          this.x += this.dashDir.x * 12;
          this.y += this.dashDir.y * 12;
          this.dashTimer--;
          addBurst(this.x, this.y, "#cfe9ff", 2, 3);
        } else {
          this.x += dx * spd; this.y += dy * spd;
        }
        if (m > 0.1 && this.dashTimer <= 0) this.bob += 0.25;
        this.x = Math.max(this.r, Math.min(W() - this.r, this.x));
        this.y = Math.max(this.r, Math.min(H() - this.r, this.y));

        if ((keys["Space"] || game.joyDash) && this.dashCd <= 0 && this.dashTimer <= 0 && (m > 0.1 || game.joy.active)) {
          this.dashTimer = 6; this.dashCd = 50;
          this.dashDir.x = dx || game.joy.dir.x; this.dashDir.y = dy || game.joy.dir.y;
          game.joyDash = false;
          addRing(this.x, this.y, "#fff");
        }

        if (this.shieldRegenCd > 0) this.shieldRegenCd--;
        else if (this.shield < this.maxShield) this.shield = Math.min(this.maxShield, this.shield + 0.15);

        if (this.powerTimer > 0) { this.powerTimer--; if (this.powerTimer <= 0) this.powerType = null; }
        if (this.comboTimer > 0) this.comboTimer--;
        else this.combo = 0;

        for (const c of game.coins) {
          if (c.collected) continue;
          const d = dist(this, c);
          if (d < this.collectR) {
            const a = Math.atan2(this.y - c.y, this.x - c.x);
            c.x += Math.cos(a) * 7; c.y += Math.sin(a) * 7;
            if (d < 20) { c.collected = true; game.gold++; game.stats.goldEarned++; }
          }
        }

        for (const p of game.powerups) {
          if (p.collected) continue;
          if (dist(this, p) < this.r + p.r) {
            p.collected = true;
            if (p.type === "viking") {
              this.powerType = "viking"; this.powerTimer = 1800;
              this.maxHp = 300; this.hp = Math.min(this.hp + 150, 300);
              this.atk = 50; this.r = 20;
              notify("⚔ VIKING POWER! 2× size, 2× HP!", "#8a1a1a");
              addBurst(this.x, this.y, "#8a1a1a", 30, 8);
              game.shake = 15;
            } else {
              this.powerType = p.type; this.powerTimer = 600;
              const labels: any = { speed: "⚡ SPEED BOOST!", damage: "🗡 DMG BOOST!", shield: "🛡 SHIELD UP!" };
              const cols: any = { speed: "#ffd86b", damage: "#ff5252", shield: "#52aaff" };
              game.texts.push(new FloatText(this.x, this.y - 20, labels[p.type], cols[p.type]));
              addBurst(this.x, this.y, cols[p.type], 20, 5);
            }
          }
        }

        // skill orb collection → assign to nearest tower
        for (const o of game.skillOrbs) {
          if (o.collected) continue;
          if (dist(this, o) < this.r + o.r + 6) {
            o.collected = true;
            const towers = game.pads.filter(p => p.state === "tower");
            if (towers.length > 0) {
              let best = towers[0], bestD = dist(towers[0], o);
              for (const t of towers) {
                const d = dist(t, o);
                if (d < bestD) { best = t; bestD = d; }
              }
              const skillNames: Record<string, string> = { firestorm: "🔥 FIRE STORM", icewall: "❄️ ICE WALL", lightning: "⚡ LIGHTNING" };
              notify(`${skillNames[o.skillType]} — tower powered!`, "#cfe9ff");
              addRing(best.x, best.y, "#cfe9ff");
              best.bonusAtk += o.skillType === "lightning" ? 15 : 0;
              best.range += o.skillType === "icewall" ? 40 : 0;
              best.atkRate = Math.max(20, best.atkRate - (o.skillType === "firestorm" ? 5 : 0));
            }
          }
        }

        for (const t of game.chests) {
          if (t.collected) continue;
          if (dist(this, t) < this.r + t.r) {
            t.collected = true;
            const reward = Math.round((10 + Math.floor(Math.random() * 15)) * (game.goldMult || 1));
            game.gold += reward;
            game.texts.push(new FloatText(t.x, t.y - 20, `💰 +${reward} GOLD!`, "#ffd86b"));
            addBurst(t.x, t.y, "#ffd86b", 25, 6);
            addRing(t.x, t.y, "#ffd86b");
            // sometimes spawn a power-up too
            if (Math.random() < 0.4) {
              const types: PowerType[] = ["speed", "damage", "shield"];
              const type = types[Math.floor(Math.random() * 3)];
              game.powerups.push(new PowerUp(t.x + (Math.random() - 0.5) * 40, t.y + (Math.random() - 0.5) * 40, type));
            }
          }
        }

        this.atkCd--;
        const dmgBonus = this.powerType === "damage" ? 1.5 : 1;
        if (this.atkCd <= 0) {
          let best: any = null, bestD = this.range;
          for (const e of game.enemies) {
            const d = dist(this, e);
            if (d < bestD + e.r) { best = e; bestD = d; }
          }
          if (best) {
            const dmg = Math.round(this.atk * (game.dmgMult || 1));
            this.combo++; this.comboTimer = 60;
            const crit = this.combo >= 5 && Math.random() < 0.3;
            const finalDmg = crit ? Math.round(dmg * 2) : dmg;
            best.hp -= finalDmg;
            game.texts.push(new FloatText(best.x, best.y - 10, crit ? `⚡${finalDmg} CRIT!` : `-${finalDmg}`, crit ? "#fff" : "#ffd86b"));
            if (crit) addRing(best.x, best.y, "#fff");
            addBurst(best.x, best.y, crit ? "#fff" : "#ffd86b", crit ? 16 : 6, crit ? 5 : 3);
            this.slashAngle = Math.atan2(best.y - this.y, best.x - this.x);
            this.slashShow = 8;
            this.atkCd = this.atkRate;
            if (best.hp <= 0) best.kill();
          }
        }
        if (this.slashShow > 0) this.slashShow--;
        if (this.hitFlash > 0) this.hitFlash--;
        // viking blood trail
        if (this.powerType === "viking") {
          this.vikingAura += 0.06;
          this.bloodTimer--;
          if (this.bloodTimer <= 0 && (this.slashShow > 0 || Math.random() < 0.1)) {
            this.bloodTrail.push(new BloodDrop(this.x + (Math.random() - 0.5) * 20, this.y + (Math.random() - 0.5) * 20));
            this.bloodTimer = 4;
            if (this.bloodTrail.length > 50) this.bloodTrail.shift();
          }
          for (const b of this.bloodTrail) b.update();
          for (let bi = this.bloodTrail.length - 1; bi >= 0; bi--) {
            const b = this.bloodTrail[bi];
            if (b.life <= 0) {
              game.flowers.push(new Flower(b.x, b.y));
              this.bloodTrail.splice(bi, 1);
            }
          }
          if (frame % 120 === 0 && this.bloodTrail.length > 3) {
            const bt = this.bloodTrail[Math.floor(Math.random() * this.bloodTrail.length)];
            if (bt && !trees.some(t => dist(t, bt) < 30)) {
              trees.push({ x: bt.x + (Math.random() - 0.5) * 40, y: bt.y + (Math.random() - 0.5) * 40, s: 0.4 + Math.random() * 0.6 });
              if (trees.length > 60) trees.shift();
            }
          }
        } else {
          this.bloodTrail = [];
          this.vikingAura = 0;
        }
      }
      draw() {
        const isViking = this.powerType === "viking";
        const scale = isViking ? 2 : 1;
        const by = Math.sin(this.bob) * 2 * scale;
        ctx.save();
        ctx.translate(this.x, this.y + by);
        ctx.scale(scale, scale);
        ctx.translate(-this.x, -this.y - by);

        ctx.strokeStyle = "rgba(255,216,107,0.18)"; ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.beginPath(); ctx.arc(this.x, this.y, this.range * (isViking ? 1.5 : 1), 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath(); ctx.ellipse(this.x, this.y + this.r * scale + 2, this.r * scale * 0.9, 5 * scale, 0, 0, Math.PI * 2); ctx.fill();
        if (this.powerType) {
          const col = ({ speed: "#ffd86b", damage: "#ff5252", shield: "#52aaff", viking: "#8a1a1a" } as any)[this.powerType];
          ctx.fillStyle = col + "25";
          ctx.beginPath(); ctx.arc(this.x, this.y, this.r * scale + 14 + Math.sin(this.bob * 2) * 4, 0, Math.PI * 2); ctx.fill();
        }
        // body
        ctx.fillStyle = "#7a1f3a";
        ctx.beginPath();
        ctx.moveTo(this.x - 14 * scale, this.y - 4 + by);
        ctx.quadraticCurveTo(this.x, this.y + 20 * scale + by, this.x + 14 * scale, this.y - 4 + by);
        ctx.lineTo(this.x + 10 * scale, this.y + 16 * scale + by);
        ctx.quadraticCurveTo(this.x, this.y + 26 * scale + by, this.x - 10 * scale, this.y + 16 * scale + by);
        ctx.closePath(); ctx.fill();
        const bg = ctx.createRadialGradient(this.x - 6 * scale, this.y - 6 * scale + by, 3 * scale, this.x, this.y + by, this.r * scale);
        bg.addColorStop(0, this.hitFlash > 0 ? "#ffd0d0" : "#5aa6ff");
        bg.addColorStop(1, "#1f4b8f");
        ctx.fillStyle = bg;
        ctx.beginPath(); ctx.arc(this.x, this.y + by, this.r * scale, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#0d1f3d"; ctx.lineWidth = 2; ctx.stroke();
        // crown
        const cx2 = this.x, cy2 = this.y - this.r * scale - 4 + by;
        ctx.fillStyle = "#ffd86b";
        ctx.beginPath();
        ctx.moveTo(cx2 - 12 * scale, cy2 + 6); ctx.lineTo(cx2 - 12 * scale, cy2);
        ctx.lineTo(cx2 - 6 * scale, cy2 + 4); ctx.lineTo(cx2, cy2 - 4);
        ctx.lineTo(cx2 + 6 * scale, cy2 + 4); ctx.lineTo(cx2 + 12 * scale, cy2);
        ctx.lineTo(cx2 + 12 * scale, cy2 + 6); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#8a5a10"; ctx.lineWidth = 1; ctx.stroke();
        // weapon
        if (isViking) {
          // viking axe: 3 slashing lines
          this.axeSwing += 0.15;
          for (let li = 0; li < 3; li++) {
            const la = this.slashAngle + li * 0.4 - 0.4 + Math.sin(this.axeSwing + li) * 0.15;
            const ld = 28 * scale;
            ctx.strokeStyle = `rgba(180,180,190,0.8)`;
            ctx.lineWidth = 4 + li * 2;
            ctx.beginPath();
            ctx.moveTo(this.x + Math.cos(la) * 10 * scale, this.y + by + Math.sin(la) * 10 * scale);
            ctx.lineTo(this.x + Math.cos(la) * ld, this.y + by + Math.sin(la) * ld);
            ctx.stroke();
            // axe head
            const ahx = this.x + Math.cos(la) * ld;
            const ahy = this.y + by + Math.sin(la) * ld;
            ctx.fillStyle = "#6a6a7a";
            ctx.beginPath();
            ctx.moveTo(ahx, ahy);
            ctx.lineTo(ahx + Math.cos(la + 0.5) * 8, ahy + Math.sin(la + 0.5) * 8);
            ctx.lineTo(ahx + Math.cos(la - 0.5) * 8, ahy + Math.sin(la - 0.5) * 8);
            ctx.closePath(); ctx.fill();
          }
        } else {
          const sa = this.slashShow > 0 ? this.slashAngle : -Math.PI / 4 + Math.sin(this.bob * 0.5) * 0.2;
          ctx.save();
          ctx.translate(this.x + Math.cos(sa) * this.r * scale * 0.7, this.y + by + Math.sin(sa) * this.r * scale * 0.7);
          ctx.rotate(sa);
          ctx.fillStyle = "#d0d0d0";
          ctx.fillRect(-1, -2, 24, 4);
          ctx.fillStyle = "#8a5a10";
          ctx.fillRect(22, -3, 6, 6);
          ctx.strokeStyle = "#666"; ctx.lineWidth = 1;
          ctx.strokeRect(-1, -2, 24, 4);
          ctx.restore();
        }
        // slash arc
        if (this.slashShow > 0) {
          ctx.strokeStyle = `rgba(255,245,194,${(this.slashShow / 8) * 0.7})`;
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.arc(this.x, this.y + by, this.range * 0.55, this.slashAngle - 0.7, this.slashAngle + 0.7);
          ctx.stroke();
          ctx.strokeStyle = `rgba(255,255,255,${(this.slashShow / 8) * 0.3})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(this.x, this.y + by, this.range * 0.55, this.slashAngle - 0.3, this.slashAngle + 0.3);
          ctx.stroke();
        }
        ctx.restore();
        if (this.shield > 0) {
          drawHpBar(this.x, this.y - this.r * scale - 20, 40, this.shield, this.maxShield, false, "#52aaff");
        }
        drawHpBar(this.x, this.y - this.r * scale - 14, 40, this.hp, this.maxHp);
        if (isViking) {
          ctx.fillStyle = "#8a1a1a"; ctx.font = "bold 14px 'Cinzel', serif"; ctx.textAlign = "center";
          ctx.fillText("⚔ VIKING ⚔", this.x, this.y - this.r * scale - 30);
          ctx.textAlign = "start";
        }
        if (this.combo > 2) {
          ctx.fillStyle = this.combo >= 5 ? "#ff0" : "#ffd86b";
          ctx.font = "bold 12px 'Cinzel', serif"; ctx.textAlign = "center";
          ctx.fillText(`${this.combo}x COMBO`, this.x, this.y - this.r * scale - 28);
          ctx.textAlign = "start";
        }
      }
      hurt(d: number) {
        if (this.shield > 0) {
          const absorbed = Math.min(this.shield, d);
          this.shield -= absorbed; d -= absorbed;
          this.shieldRegenCd = 90;
          if (this.shield <= 0) game.texts.push(new FloatText(this.x, this.y - 10, "SHIELD BROKEN!", "#ff5252"));
        }
        this.hp -= d;
        this.hitFlash = 8;
        game.texts.push(new FloatText(this.x, this.y - 10, `-${Math.round(d)}`, "#ff5252"));
      }
    }

    type SoldierType = "warrior" | "healer" | "builder" | "food";
    type Personality = "brave" | "cautious" | "aggressive" | "lazy";

    /* Soldier — AI-controlled with types, personalities, and blue army */
    class Soldier {
      x: number; y: number; vx = 0; vy = 0; r = 11; bob = Math.random() * 6;
      hp = 60; maxHp = 60; atkCd = 0; atkRate = 45; atk = 12; range = 50;
      assignedPad: TowerPad | null = null;
      state: "idle" | "follow" | "patrol" = "idle";
      shiftTimer = 120 + Math.random() * 180;
      patrolTarget: Vec | null = null;
      postIdx = -1;
      type: SoldierType;
      personality: Personality;
      carryFood = 0; healTimer = 0; buildTimer = 0;
      color: string; glow = Math.random() * 6;
      constructor(x: number, y: number) {
        this.x = x; this.y = y;
        const types: SoldierType[] = ["warrior", "healer", "builder", "food"];
        const weights = [0.5, 0.2, 0.2, 0.1];
        let r2 = Math.random(), i = 0;
        for (; i < weights.length; i++) { r2 -= weights[i]; if (r2 <= 0) break; }
        this.type = types[Math.min(i, types.length - 1)];
        const pers: Personality[] = ["brave", "cautious", "aggressive", "lazy"];
        this.personality = pers[Math.floor(Math.random() * pers.length)];
        const colors: Record<SoldierType, string> = { warrior: "#3a7aff", healer: "#5affaa", builder: "#ffaa3a", food: "#ffd86b" };
        this.color = colors[this.type];
      }
      get typeLabel() {
        const labels: Record<SoldierType, string> = { warrior: "⚔", healer: "💚", builder: "🔨", food: "🍞" };
        return labels[this.type];
      }
      get persLabel() {
        const labels: Record<Personality, string> = { brave: "B", cautious: "C", aggressive: "A", lazy: "L" };
        return labels[this.personality];
      }
      moveToward(tx: number, ty: number, strength: number, maxS: number) {
        const persMult: Record<Personality, number> = { brave: 1.2, cautious: 0.8, aggressive: 1.4, lazy: 0.6 };
        const sm = persMult[this.personality] || 1;
        let sx = (tx - this.x) * strength * sm;
        let sy = (ty - this.y) * strength * sm;
        for (const o of game.soldiers) {
          if (o === this) continue;
          const d = dist(this, o);
          if (d < 22) { sx -= (o.x - this.x) * 0.06; sy -= (o.y - this.y) * 0.06; }
        }
        if (dist(this, game.player) < 28) {
          const pa = Math.atan2(this.y - game.player.y, this.x - game.player.x);
          sx += Math.cos(pa) * 0.15; sy += Math.sin(pa) * 0.15;
        }
        this.vx = lerp(this.vx, sx, 0.15); this.vy = lerp(this.vy, sy, 0.15);
        const s = Math.hypot(this.vx, this.vy);
        if (s > maxS * sm) { this.vx = (this.vx / s) * maxS * sm; this.vy = (this.vy / s) * maxS * sm; }
        this.x += this.vx; this.y += this.vy;
        this.bob += 0.2;
      }
      update() {
        this.atkCd--;
        this.shiftTimer--;
        this.glow += 0.05;
        if (this.shiftTimer <= 0) {
          if (this.state === "patrol" || this.state === "follow") {
            this.state = "idle";
            this.shiftTimer = 180 + Math.random() * 150;
          } else {
            this.state = "patrol";
            this.shiftTimer = 250 + Math.random() * 200;
            this.pickPost();
          }
        }
        // builder: construct houses / water walls when idle near castle
        if (this.type === "builder" && this.state === "idle" && dist(this, game.castle) < 120) {
          this.buildTimer++;
          if (this.buildTimer > 120 && Math.random() < 0.01) {
            game.texts.push(new FloatText(this.x, this.y - 20, "🔨 Building...", "#ffaa3a"));
            addBurst(this.x, this.y, "#b0a070", 4, 2);
            this.buildTimer = 0;
          }
        }
        // healer: heal nearby soldiers
        if (this.type === "healer" && this.state !== "idle") {
          this.healTimer--;
          if (this.healTimer <= 0) {
            for (const s of game.soldiers) {
              if (s !== this && s.hp < s.maxHp && dist(this, s) < 40) {
                s.hp = Math.min(s.maxHp, s.hp + 3);
                addBurst(s.x, s.y - 8, "#5affaa", 2, 1);
                this.healTimer = 30;
                break;
              }
            }
          }
        }
        // food: share food buff nearby
        if (this.type === "food" && this.state !== "idle") {
          this.carryFood = Math.min(100, this.carryFood + 0.05);
          for (const s of game.soldiers) {
            if (s !== this && dist(this, s) < 30 && s.hp < s.maxHp) {
              s.hp = Math.min(s.maxHp, s.hp + 0.5);
              this.carryFood = Math.max(0, this.carryFood - 0.3);
            }
          }
        }
        if (this.state === "idle") {
          this.moveToward(game.castle.x, game.castle.y, 0.015, 2.2);
          if (dist(this, game.castle) < 55) this.hp = Math.min(this.maxHp, this.hp + 0.12);
        } else if (this.state === "follow") {
          this.moveToward(game.player.x, game.player.y, 0.012, 3.4);
        } else if (this.state === "patrol") {
          if (!this.patrolTarget || dist(this, this.patrolTarget) < 12) this.pickPost();
          if (this.patrolTarget) this.moveToward(this.patrolTarget.x, this.patrolTarget.y, 0.025, 3.0);
        }
        if (this.atkCd <= 0 && this.type !== "healer" && this.type !== "food") {
          let best: Enemy | null = null;
          let bestD = this.range + (this.state === "patrol" ? 25 : 0);
          for (const e of game.enemies) {
            if (!e.alive) continue;
            const d = dist(this, e);
            if (d < bestD + e.r) { best = e; bestD = d; }
          }
          if (best) {
            const dmg = this.type === "builder" ? Math.round(this.atk * 0.6) : this.atk;
            best.hp -= dmg;
            game.texts.push(new FloatText(best.x, best.y - 10, `-${dmg}`, "#5aa6ff"));
            addBurst(best.x, best.y, "#5aa6ff", 4);
            this.atkCd = this.atkRate;
            if (best.hp <= 0) best.kill();
          }
        }
      }
      pickPost() {
        const posts = game.pads.filter(p => p.state === "tower" || p.state === "wall");
        if (posts.length === 0) {
          const a = Math.random() * Math.PI * 2;
          const r = 40 + Math.random() * 40;
          this.patrolTarget = { x: game.castle.x + Math.cos(a) * r, y: game.castle.y + Math.sin(a) * r };
          return;
        }
        if (Math.random() < 0.4) {
          const p = posts[Math.floor(Math.random() * posts.length)];
          const t = 0.3 + Math.random() * 0.4;
          this.patrolTarget = {
            x: game.castle.x + (p.x - game.castle.x) * t + (Math.random() - 0.5) * 16,
            y: game.castle.y + (p.y - game.castle.y) * t + (Math.random() - 0.5) * 16,
          };
          return;
        }
        const taken = new Set<string>();
        for (const s of game.soldiers) {
          if (s !== this && s.state === "patrol" && s.patrolTarget)
            taken.add(Math.round(s.patrolTarget.x / 5) + "," + Math.round(s.patrolTarget.y / 5));
        }
        const free = posts.filter(p => !taken.has(Math.round(p.x / 5) + "," + Math.round(p.y / 5)));
        if (free.length > 0) {
          const p = free[Math.floor(Math.random() * free.length)];
          this.patrolTarget = { x: p.x, y: p.y };
        } else {
          const p = posts[Math.floor(Math.random() * posts.length)];
          this.patrolTarget = { x: p.x + (Math.random() - 0.5) * 40, y: p.y + (Math.random() - 0.5) * 40 };
        }
      }
      draw() {
        const by = Math.sin(this.bob) * 1.5;
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath(); ctx.ellipse(this.x, this.y + this.r + 1, this.r * 0.8, 3, 0, 0, Math.PI * 2); ctx.fill();
        // blue-colored body with type tint
        const g = ctx.createRadialGradient(this.x - 3, this.y - 3 + by, 2, this.x, this.y + by, this.r);
        g.addColorStop(0, this.color); g.addColorStop(1, "#1a3a6a");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(this.x, this.y + by, this.r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#0d1f3d"; ctx.lineWidth = 1.2; ctx.stroke();
        // type icon above head
        ctx.font = "8px serif"; ctx.textAlign = "center";
        ctx.fillText(this.typeLabel, this.x, this.y - this.r - 2 + by);
        ctx.textAlign = "start";
        // personality indicator ring
        ctx.strokeStyle = this.personality === "brave" ? "#ffd86b" : this.personality === "aggressive" ? "#ff5252" : this.personality === "cautious" ? "#52aaff" : "#aaa";
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(this.x, this.y + by, this.r + 3 + Math.sin(this.glow) * 1, 0, Math.PI * 2); ctx.stroke();
        // state indicator
        if (this.state === "patrol") {
          ctx.fillStyle = "#ffd86b";
          ctx.beginPath(); ctx.arc(this.x + 8, this.y - this.r + by, 3, 0, Math.PI * 2); ctx.fill();
        } else if (this.state === "follow") {
          ctx.fillStyle = "#5aa6ff";
          ctx.beginPath(); ctx.arc(this.x + 8, this.y - this.r + by, 2.5, 0, Math.PI * 2); ctx.fill();
        }
        drawHpBar(this.x, this.y - this.r - 8, 26, this.hp, this.maxHp);
      }
      orderToPost() {
        this.state = "patrol";
        this.shiftTimer = 350 + Math.random() * 150;
        this.pickPost();
      }
    }

    /* Enemy types */
    class Enemy {
      x: number; y: number;
      type: "imp" | "brute" | "boss" | "ghost" | "dragon" | "blackDragon";
      r: number; speed: number; hp: number; maxHp: number; atk: number; atkRate: number; atkCd = 0;
      alive = true; bob = Math.random() * 6; target: any = null;
      glow = 0; born = 0; flyH = 0; shieldHp = 0;
      constructor(x: number, y: number, type: Enemy["type"], waveScale: number) {
        this.x = x; this.y = y; this.type = type;
        const base = type === "imp" ? { r: 14, sp: 1.6, hp: 25, atk: 4, ar: 55 }
                   : type === "brute" ? { r: 22, sp: 1.1, hp: 70, atk: 10, ar: 65 }
                   : type === "boss" ? { r: 32, sp: 0.85, hp: 200, atk: 20, ar: 75 }
                   : type === "ghost" ? { r: 16, sp: 1.4, hp: 18, atk: 3, ar: 50 }
                   : type === "dragon" ? { r: 28, sp: 0.9, hp: 120, atk: 15, ar: 40 }
                   : { r: 36, sp: 0.7, hp: 300, atk: 25, ar: 35 };
        this.r = base.r;
        this.speed = base.sp * (1 - Math.min(0.25, (waveScale - 1) * 0.04));
        this.hp = Math.round(base.hp * waveScale * 0.85 * (game.enemyHpMult || 1));
        this.maxHp = this.hp;
        this.atk = base.atk;
        this.atkRate = base.ar;
        if (type === "dragon" || type === "blackDragon") this.flyH = 60 + Math.random() * 30;
        if (type === "blackDragon") this.shieldHp = Math.round(this.hp * 0.3);
      }
      pickTarget() {
        let best: any = null; let bestPri = -1; let bestD = Infinity;
        const consider = (obj: any, pri: number) => {
          const d = dist(this, obj);
          if (pri > bestPri || (pri === bestPri && d < bestD)) { best = obj; bestPri = pri; bestD = d; }
        };
        for (const p of game.pads) {
          if (p.state === "wall" || p.state === "tower") consider({ x: p.x, y: p.y, r: 28, _pad: p }, p.state === "tower" ? 3 : 2);
        }
        for (const s of game.soldiers) consider({ x: s.x, y: s.y, r: s.r, _sol: s }, 2);
        consider({ x: game.player.x, y: game.player.y, r: game.player.r, _pl: true }, 1);
        consider({ x: game.castle.x, y: game.castle.y, r: 40, _castle: true }, 0);
        return best;
      }
      update() {
        this.born++;
        this.glow += 0.08;
        if (this.type === "ghost") {
          // ghost phases through: can't be targeted by towers as easily (ignored)
        }
        if (!this.target || (this.target._sol && this.target._sol.hp <= 0) ||
            (this.target._pad && this.target._pad.state === "open")) {
          this.target = this.pickTarget();
        }
        const t = this.target; if (!t) return;
        const d = dist(this, t);
        if (d > this.r + t.r - 2) {
          const a = Math.atan2(t.y - this.y, t.x - this.x);
          const nx = this.x + Math.cos(a) * this.speed;
          const ny = this.y + Math.sin(a) * this.speed;
          // wall collision: enemies must destroy walls to pass
          if (this.type !== "dragon" && this.type !== "ghost") {
            let wallHit: TowerPad | null = null;
            for (const p of game.pads) {
              if (p.state !== "wall" && p.state !== "tower") continue;
              if (dist({ x: nx, y: ny }, p) < (p.state === "tower" ? 24 : 28)) {
                wallHit = p; break;
              }
            }
            if (wallHit) {
              if (this.atkCd <= 0) {
                wallHit.hp -= Math.max(1, Math.floor(this.atk * 0.5));
                this.atkCd = this.atkRate;
                addBurst(wallHit.x, wallHit.y, "#8a6a4a", 2, 2);
                if (wallHit.state === "wall" && wallHit.hp <= 0) {
                  notify("🧱 Wall destroyed!", "#ff5252");
                  wallHit.hp = 0; wallHit.state = "open"; wallHit.payProg = 0;
                }
                if (wallHit.state === "tower" && wallHit.hp <= 0) wallHit.destroy();
              }
            } else {
              this.x = nx; this.y = ny;
            }
          } else {
            this.x = nx; this.y = ny;
          }
        } else {
          this.atkCd--;
          if (this.atkCd <= 0) {
            this.atkCd = this.atkRate;
            if (t._castle) { game.castle.hurt(this.atk); game.shake = 4; }
            else if (t._pl) { game.player.hurt(this.atk); game.shake = 3; }
            else if (t._sol) {
              t._sol.hp -= this.atk;
              game.texts.push(new FloatText(t._sol.x, t._sol.y - 10, `-${this.atk}`, "#ff5252"));
              if (t._sol.hp <= 0) { addBurst(t._sol.x, t._sol.y, "#5aa6ff", 12); t._sol.hp = 0; }
            } else if (t._pad) {
              t._pad.hp -= this.atk;
              game.texts.push(new FloatText(t._pad.x, t._pad.y - 10, `-${this.atk}`, "#ff5252"));
              if (t._pad.hp <= 0) t._pad.destroy();
            }
          }
        }
        this.bob += 0.18;
      }
      kill() {
        this.alive = false;
        game.stats.kills++;
        game.stats.damageDealt += this.maxHp;
        if (this.type === "dragon" || this.type === "blackDragon") game.stats.dragonsSlain++;
        addBurst(this.x, this.y, this.type === "blackDragon" ? "#1a0000" : "#ff5252", 14);
        addRing(this.x, this.y, "#ff5252");
        game.shake = Math.max(game.shake, this.type === "blackDragon" ? 18 : 5);
        const drops = this.type === "boss" ? 10 : this.type === "brute" ? 5 : this.type === "ghost" ? 3 : 2;
        const multi = this.type === "blackDragon" ? 30 : 1;
        for (let i = 0; i < drops * multi; i++)
          game.coins.push(new Coin(this.x + (Math.random() - 0.5) * 30, this.y + (Math.random() - 0.5) * 30));
        const bonusGold = Math.floor((game.goldMult || 1) * 3 * multi) - 3;
        if (bonusGold > 0) game.gold += bonusGold;
        if (this.type === "boss") {
          game.texts.push(new FloatText(this.x, this.y - 40, "💀 BOSS SLAIN! 💀", "#ffd86b"));
          addRing(this.x, this.y, "#ffd86b");
          setTimeout(() => addRing(this.x, this.y, "#ffd86b"), 200);
          setTimeout(() => addRing(this.x, this.y, "#ffd86b"), 400);
        }
        if (this.type === "blackDragon") {
          game.texts.push(new FloatText(this.x, this.y - 50, "🐉 BLACK DRAGON DEFEATED! 🐉", "#ff3030"));
          addBurst(this.x, this.y, "#8a1a1a", 30, 10);
          notify("🐉 BLACK DRAGON SLAIN — VIKING POWER DROPPED!", "#8a1a1a");
          game.powerups.push(new PowerUp(this.x, this.y - 20, "viking"));
        } else if (Math.random() < 0.005) {
          // 0.5% rare viking power-up from normal enemies
          game.powerups.push(new PowerUp(this.x + (Math.random() - 0.5) * 20, this.y + (Math.random() - 0.5) * 20, "viking"));
          notify("⚔ RARE VIKING POWER-UP DROPPED!", "#8a1a1a");
        }
        // skill orb drop
        if (this.type === "blackDragon" || (this.type === "dragon" && Math.random() < 0.15) || Math.random() < 0.005) {
          game.skillOrbs.push(new SkillOrb(this.x + (Math.random() - 0.5) * 30, this.y + (Math.random() - 0.5) * 30));
        }
        // combat log
        const killLabel: Record<string, string> = { imp: "Imp", brute: "Brute", boss: "Boss", ghost: "Ghost", dragon: "Dragon", blackDragon: "🐉 Black Dragon" };
        game.combatLog.unshift({ text: `💀 ${killLabel[this.type] || this.type} slain`, frame, color: this.type === "blackDragon" ? "#ff3030" : "#ffd86b" });
        if (game.combatLog.length > 20) game.combatLog.pop();
      }
      draw() {
        const by = Math.sin(this.bob) * 1.5;
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath(); ctx.ellipse(this.x, this.y + this.r + 2, this.r * 0.9, 4, 0, 0, Math.PI * 2); ctx.fill();

        if (this.type === "imp") {
          // Triangle imp with horns
          const g = ctx.createRadialGradient(this.x - 3, this.y - 3 + by, 2, this.x, this.y + by, this.r);
          g.addColorStop(0, "#e06040"); g.addColorStop(1, "#5a0a0a");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(this.x - this.r, this.y + this.r * 0.6 + by);
          ctx.lineTo(this.x + this.r, this.y + this.r * 0.6 + by);
          ctx.lineTo(this.x, this.y - this.r * 1.1 + by);
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = "#2a0202"; ctx.lineWidth = 1.5; ctx.stroke();
          // horns
          ctx.fillStyle = "#8a3a2a";
          ctx.beginPath(); ctx.moveTo(this.x - 6, this.y - this.r * 0.7 + by);
          ctx.lineTo(this.x - 10, this.y - this.r * 1.6 + by);
          ctx.lineTo(this.x - 2, this.y - this.r * 0.9 + by);
          ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(this.x + 6, this.y - this.r * 0.7 + by);
          ctx.lineTo(this.x + 10, this.y - this.r * 1.6 + by);
          ctx.lineTo(this.x + 2, this.y - this.r * 0.9 + by);
          ctx.closePath(); ctx.fill();
          // eyes
          ctx.fillStyle = "#ffd86b";
          ctx.beginPath(); ctx.arc(this.x - 5, this.y - 2 + by, 2.5, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(this.x + 5, this.y - 2 + by, 2.5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#1a0000";
          ctx.beginPath(); ctx.arc(this.x - 4, this.y - 1 + by, 1.2, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(this.x + 6, this.y - 1 + by, 1.2, 0, Math.PI * 2); ctx.fill();
          // grin
          ctx.strokeStyle = "#3a0202"; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(this.x, this.y + 4 + by, 5, 0.2, Math.PI - 0.2); ctx.stroke();
        } else if (this.type === "brute") {
          // Square-ish bulky brute with spikes
          const g = ctx.createRadialGradient(this.x - 4, this.y - 4 + by, 2, this.x, this.y + by, this.r);
          g.addColorStop(0, "#a03030"); g.addColorStop(1, "#2a0202");
          ctx.fillStyle = g;
          const hs = this.r * 0.85;
          ctx.beginPath();
          // spiked polygon
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
            const rr = i % 2 === 0 ? this.r : this.r * 1.2;
            if (i === 0) ctx.moveTo(this.x + Math.cos(a) * rr, this.y + by + Math.sin(a) * rr);
            else ctx.lineTo(this.x + Math.cos(a) * rr, this.y + by + Math.sin(a) * rr);
          }
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = "#1a0202"; ctx.lineWidth = 2; ctx.stroke();
          // angry eyes
          ctx.fillStyle = "#ff5252";
          ctx.beginPath(); ctx.arc(this.x - 7, this.y - 2 + by, 3, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(this.x + 7, this.y - 2 + by, 3, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#1a0000";
          ctx.beginPath(); ctx.arc(this.x - 6, this.y - 1 + by, 1.5, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(this.x + 8, this.y - 1 + by, 1.5, 0, Math.PI * 2); ctx.fill();
          // mouth
          ctx.fillStyle = "#1a0202";
          ctx.fillRect(this.x - 6, this.y + 5 + by, 12, 4);
          ctx.fillStyle = "#fff";
          ctx.fillRect(this.x - 5, this.y + 6 + by, 3, 2);
          ctx.fillRect(this.x + 2, this.y + 6 + by, 3, 2);
        } else if (this.type === "dragon") {
          const df = this.flyH;
          ctx.fillStyle = "rgba(0,0,0,0.25)";
          ctx.beginPath(); ctx.ellipse(this.x, this.y + 34 + df * 0.3, this.r * 1.2, 6, 0, 0, Math.PI * 2); ctx.fill();
          const g = ctx.createRadialGradient(this.x - 4, this.y - 6, 3, this.x, this.y, this.r);
          g.addColorStop(0, "#c04040"); g.addColorStop(1, "#4a0a0a");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(this.x - this.r, this.y + 4);
          ctx.quadraticCurveTo(this.x - this.r - 8, this.y - this.r * 0.4, this.x - 4, this.y - this.r);
          ctx.quadraticCurveTo(this.x, this.y - this.r - 6, this.x + 4, this.y - this.r);
          ctx.quadraticCurveTo(this.x + this.r + 8, this.y - this.r * 0.4, this.x + this.r, this.y + 4);
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = "#2a0202"; ctx.lineWidth = 2; ctx.stroke();
          // wings
          const wingFlap = Math.sin(this.bob * 0.8) * 0.4 + 0.6;
          ctx.fillStyle = "#8a2020d0";
          ctx.beginPath();
          ctx.moveTo(this.x - this.r * 0.6, this.y - this.r * 0.3);
          ctx.quadraticCurveTo(this.x - this.r * 1.8, this.y - this.r * wingFlap, this.x - this.r * 0.3, this.y + 2);
          ctx.closePath(); ctx.fill();
          ctx.beginPath();
          ctx.moveTo(this.x + this.r * 0.6, this.y - this.r * 0.3);
          ctx.quadraticCurveTo(this.x + this.r * 1.8, this.y - this.r * wingFlap, this.x + this.r * 0.3, this.y + 2);
          ctx.closePath(); ctx.fill();
          // eyes
          ctx.fillStyle = "#ffd86b";
          ctx.beginPath(); ctx.arc(this.x - 7, this.y - this.r * 0.3, 3.5, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(this.x + 7, this.y - this.r * 0.3, 3.5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#1a0000";
          ctx.beginPath(); ctx.arc(this.x - 6, this.y - this.r * 0.2, 1.8, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(this.x + 8, this.y - this.r * 0.2, 1.8, 0, Math.PI * 2); ctx.fill();
          // fire breath glow
          if (this.atkCd < 10) {
            ctx.fillStyle = `rgba(255,150,50,${(1 - this.atkCd / 10) * 0.4})`;
            ctx.beginPath(); ctx.arc(this.x + Math.cos(this.bob) * this.r * 0.7, this.y + 6, 14, 0, Math.PI * 2); ctx.fill();
          }
          drawHpBar(this.x, this.y - this.r - 8, 56, this.hp, this.maxHp);
          // shield bar
          if (this.shieldHp > 0) drawHpBar(this.x, this.y - this.r - 14, 56, this.shieldHp, Math.round(this.maxHp * 0.3), false, "#ff0000");
        } else if (this.type === "blackDragon") {
          const df = this.flyH;
          ctx.fillStyle = "rgba(0,0,0,0.35)";
          ctx.beginPath(); ctx.ellipse(this.x, this.y + 38 + df * 0.3, this.r * 1.3, 7, 0, 0, Math.PI * 2); ctx.fill();
          // shield glow
          ctx.fillStyle = `rgba(200,20,20,${0.08 + Math.sin(this.glow * 3) * 0.06})`;
          ctx.beginPath(); ctx.arc(this.x, this.y - 4, this.r + 10, 0, Math.PI * 2); ctx.fill();
          const g = ctx.createRadialGradient(this.x - 5, this.y - 8, 4, this.x, this.y, this.r);
          g.addColorStop(0, "#1a1a1a"); g.addColorStop(0.5, "#2a0a0a"); g.addColorStop(1, "#0a0000");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(this.x - this.r, this.y + 4);
          ctx.quadraticCurveTo(this.x - this.r - 8, this.y - this.r * 0.4, this.x - 4, this.y - this.r);
          ctx.quadraticCurveTo(this.x, this.y - this.r - 8, this.x + 4, this.y - this.r);
          ctx.quadraticCurveTo(this.x + this.r + 8, this.y - this.r * 0.4, this.x + this.r, this.y + 4);
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = "#8a0a0a"; ctx.lineWidth = 2.5; ctx.stroke();
          const wingFlap2 = Math.sin(this.bob * 0.8) * 0.4 + 0.6;
          ctx.fillStyle = "#2a0a0af0";
          ctx.beginPath();
          ctx.moveTo(this.x - this.r * 0.6, this.y - this.r * 0.3);
          ctx.quadraticCurveTo(this.x - this.r * 2.0, this.y - this.r * wingFlap2, this.x - this.r * 0.3, this.y + 2);
          ctx.closePath(); ctx.fill();
          ctx.beginPath();
          ctx.moveTo(this.x + this.r * 0.6, this.y - this.r * 0.3);
          ctx.quadraticCurveTo(this.x + this.r * 2.0, this.y - this.r * wingFlap2, this.x + this.r * 0.3, this.y + 2);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = "#ff3030";
          ctx.beginPath(); ctx.arc(this.x - 8, this.y - this.r * 0.3, 4, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(this.x + 8, this.y - this.r * 0.3, 4, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#1a0000";
          ctx.beginPath(); ctx.arc(this.x - 7, this.y - this.r * 0.2, 2, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(this.x + 9, this.y - this.r * 0.2, 2, 0, Math.PI * 2); ctx.fill();
          // fire breath
          if (this.atkCd < 10) {
            ctx.fillStyle = `rgba(255,60,20,${(1 - this.atkCd / 10) * 0.5})`;
            ctx.beginPath(); ctx.arc(this.x + Math.cos(this.bob) * this.r * 0.7, this.y + 8, 18, 0, Math.PI * 2); ctx.fill();
          }
          drawHpBar(this.x, this.y - this.r - 8, 64, this.hp, this.maxHp);
          ctx.strokeStyle = "#ff0000"; ctx.lineWidth = 1;
          ctx.strokeRect(this.x - 32, this.y - this.r - 14, 64, 7);
        } else if (this.type === "ghost") {
          // ghostly floaty translucent
          ctx.globalAlpha = 0.7 + Math.sin(this.glow * 2) * 0.15;
          const g = ctx.createRadialGradient(this.x - 3, this.y - 5 + by, 2, this.x, this.y + by, this.r);
          g.addColorStop(0, "#aacfff"); g.addColorStop(1, "#3a5a8a");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(this.x, this.y + by - 4, this.r * 0.7, Math.PI, 0);
          ctx.bezierCurveTo(
            this.x + this.r, this.y + by + 4,
            this.x + this.r * 0.5, this.y + by + this.r * 0.5,
            this.x, this.y + by + this.r * 0.4
          );
          ctx.bezierCurveTo(
            this.x - this.r * 0.5, this.y + by + this.r * 0.5,
            this.x - this.r, this.y + by + 4,
            this.x - this.r * 0.7, this.y + by - 4
          );
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = "#6a8aaa"; ctx.lineWidth = 1.2; ctx.stroke();
          ctx.globalAlpha = 1;
          // ghost eyes
          ctx.fillStyle = "#1a2a3a";
          ctx.beginPath(); ctx.arc(this.x - 5, this.y - 2 + by, 2.5, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(this.x + 5, this.y - 2 + by, 2.5, 0, Math.PI * 2); ctx.fill();
          // ghost mouth O
          ctx.beginPath(); ctx.arc(this.x, this.y + 5 + by, 3, 0, Math.PI * 2); ctx.fill();
        } else {
          // boss - big skull shape
          const g = ctx.createRadialGradient(this.x - 5, this.y - 5 + by, 3, this.x, this.y + by, this.r);
          g.addColorStop(0, "#8a2020"); g.addColorStop(1, "#1a0202");
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(this.x, this.y + by, this.r * 0.9, 0, Math.PI * 2); ctx.fill();
          // jaw
          ctx.fillStyle = "#2a0a0a";
          ctx.fillRect(this.x - this.r * 0.7, this.y + by, this.r * 1.4, this.r * 0.6);
          // horns
          ctx.fillStyle = "#4a1010";
          ctx.beginPath(); ctx.moveTo(this.x - this.r * 0.5, this.y - this.r * 0.6 + by);
          ctx.lineTo(this.x - this.r * 1.0, this.y - this.r * 1.4 + by);
          ctx.lineTo(this.x - this.r * 0.3, this.y - this.r * 0.8 + by);
          ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(this.x + this.r * 0.5, this.y - this.r * 0.6 + by);
          ctx.lineTo(this.x + this.r * 1.0, this.y - this.r * 1.4 + by);
          ctx.lineTo(this.x + this.r * 0.3, this.y - this.r * 0.8 + by);
          ctx.closePath(); ctx.fill();
          // eyes
          ctx.fillStyle = "#ff5252";
          ctx.beginPath(); ctx.arc(this.x - 8, this.y - 3 + by, 4, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(this.x + 8, this.y - 3 + by, 4, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#3a0000";
          ctx.beginPath(); ctx.arc(this.x - 7, this.y - 2 + by, 2, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(this.x + 9, this.y - 2 + by, 2, 0, Math.PI * 2); ctx.fill();
          // teeth
          ctx.fillStyle = "#c0b080";
          for (let i = 0; i < 5; i++) {
            ctx.fillRect(this.x - 10 + i * 5, this.y + 3 + by, 3, 4);
          }
          ctx.strokeStyle = "#1a0202"; ctx.lineWidth = 2;
          ctx.strokeRect(this.x - this.r * 0.7, this.y + by, this.r * 1.4, this.r * 0.6);
        }
        drawHpBar(this.x, this.y - this.r - 10, this.type === "boss" ? 60 : this.type === "ghost" ? 30 : 36, this.hp, this.maxHp);
      }
    }

    /* Castle */
    class Castle {
      x: number; y: number; level = 1;
      hp = 200; maxHp = 200; payProg = 0; cap = 0;
      constructor(x: number, y: number) {
        this.x = x; this.y = y; this.cap = COST_CASTLE[0];
        this.hp = Math.round(200 * (game.castleHpMult || 1));
        this.maxHp = this.hp;
      }
      maxSoldiers() { return (game._maxSoldiers || 5) + this.level * 2; }
      tryUpgrade() {
        if (this.level >= 3) return false;
        if (game.gold <= 0) return false;
        game.gold--; this.payProg++;
        if (this.payProg >= this.cap) {
          this.payProg = 0; this.level++;
          const newMax = Math.round([200, 400, 800][this.level - 1] * (game.castleHpMult || 1));
          this.hp = newMax; this.maxHp = newMax;
          this.cap = this.level <= 2 ? COST_CASTLE[this.level - 1] : 0;
          for (let i = 0; i < 2; i++) spawnSoldier();
          addBurst(this.x, this.y, "#ffd86b", 30); game.shake = 12;
          game.texts.push(new FloatText(this.x, this.y - 50, `🏰 CASTLE LV.${this.level}!`, "#ffd86b"));
          setTimeout(() => addRing(this.x, this.y, "#ffd86b"), 150);
        }
        return true;
      }
      hurt(d: number) {
        this.hp = Math.max(0, this.hp - d);
        game.texts.push(new FloatText(this.x, this.y - 30, `-${d}`, "#ff7b3a"));
      }
      draw() {
        const x = this.x, y = this.y;
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath(); ctx.ellipse(x, y + 34, 50, 9, 0, 0, Math.PI * 2); ctx.fill();
        if (this.level === 1) {
          ctx.fillStyle = "#6a1f3a";
          ctx.beginPath(); ctx.moveTo(x, y - 36); ctx.lineTo(x - 34, y + 28); ctx.lineTo(x + 34, y + 28); ctx.closePath(); ctx.fill();
          ctx.strokeStyle = "#2d0a18"; ctx.lineWidth = 2; ctx.stroke();
          ctx.fillStyle = "#ffd86b";
          ctx.beginPath(); ctx.moveTo(x - 6, y - 20); ctx.lineTo(x - 12, y + 28);
          ctx.lineTo(x - 4, y + 28); ctx.lineTo(x, y - 36); ctx.closePath(); ctx.fill();
        } else if (this.level === 2) {
          ctx.fillStyle = "#8a5a2a"; ctx.fillRect(x - 36, y - 30, 72, 60);
          ctx.strokeStyle = "#3a2410"; ctx.lineWidth = 2; ctx.strokeRect(x - 36, y - 30, 72, 60);
          ctx.fillStyle = "#5a3a18"; ctx.fillRect(x - 40, y - 32, 80, 8);
          ctx.fillStyle = "#2d1a08"; ctx.fillRect(x - 8, y + 8, 16, 22);
          ctx.fillStyle = "#ffd86b"; ctx.fillRect(x - 18, y - 18, 6, 8); ctx.fillRect(x + 12, y - 18, 6, 8);
        } else {
          ctx.fillStyle = "#b0b8c4"; ctx.fillRect(x - 42, y - 36, 84, 70);
          ctx.strokeStyle = "#3a4250"; ctx.lineWidth = 2; ctx.strokeRect(x - 42, y - 36, 84, 70);
          for (let i = 0; i < 6; i++) { ctx.fillStyle = "#7a8290"; ctx.fillRect(x - 42 + i * 14, y - 46, 10, 10); }
          ctx.fillStyle = "#2d1a08"; ctx.fillRect(x - 10, y + 8, 20, 26);
          ctx.fillStyle = "#ffd86b"; ctx.fillRect(x - 5, y + 14, 10, 14);
        }
        ctx.fillStyle = "#8a5a10"; ctx.fillRect(x - 1, y - 56, 2, 16);
        ctx.fillStyle = "#ffd86b";
        ctx.beginPath(); ctx.moveTo(x + 1, y - 56); ctx.lineTo(x + 14, y - 52);
        ctx.lineTo(x + 1, y - 48); ctx.closePath(); ctx.fill();
        drawHpBar(x, y - 64, 80, this.hp, this.maxHp, true);
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = i < this.level ? "#ffd86b" : "rgba(255,216,107,0.2)";
          ctx.beginPath(); ctx.arc(x - 16 + i * 16, y + 40, 3.5, 0, Math.PI * 2); ctx.fill();
        }
        if (game.player && dist(game.player, this) < 60 && this.level < 3) {
          const pct = this.payProg / this.cap;
          ctx.fillStyle = "rgba(0,0,0,0.75)"; ctx.fillRect(x - 40, y - 80, 80, 12);
          ctx.strokeStyle = "#ffd86b"; ctx.strokeRect(x - 40, y - 80, 80, 12);
          ctx.fillStyle = "#ffd86b"; ctx.fillRect(x - 39, y - 79, 78 * pct, 10);
          ctx.fillStyle = "#0d1f3d"; ctx.font = "bold 9px 'Cinzel', serif"; ctx.textAlign = "center";
          ctx.fillText(`UPGRADE  ${this.payProg}/${this.cap}g`, x, y - 71);
          ctx.textAlign = "start";
        }
      }
    }

    /* RedCastle — the Red AI fortress on the opposite side of the map */
    class RedCastle {
      x: number; y: number; level = 1;
      hp = 400; maxHp = 400; gold = 0; buildTimer = 0;
      pads: TowerPad[] = []; alive = true;
      constructor(x: number, y: number) {
        this.x = x; this.y = y;
        const off = 120;
        this.pads = [
          new TowerPad(x - off, y - off),
          new TowerPad(x + off, y - off),
          new TowerPad(x - off, y + off),
          new TowerPad(x + off, y + off),
        ];
        // mark red pads as pre-paid walls
        for (const p of this.pads) {
          p.state = "wall"; p.maxHp = 150; p.hp = 150; p.payProg = 0;
        }
      }
      update() {
        if (!this.alive) return;
        this.buildTimer++;
        // auto-upgrade walls to towers over time
        if (this.buildTimer > 300 && this.level < 3 && Math.random() < 0.005) {
          const openWalls = this.pads.filter(p => p.state === "wall");
          if (openWalls.length > 0) {
            const p = openWalls[Math.floor(Math.random() * openWalls.length)];
            p.state = "tower"; p.maxHp = 200; p.hp = 200;
            p.towerType = (["arrow", "cannon"] as TowerType[])[Math.floor(Math.random() * 2)];
            p.applyTowerType();
            p.bonusAtk = 0; p.bonusRange = 0;
            addBurst(p.x, p.y, "#ff5252", 12);
          }
        }
        // level up based on wave count
        const targetLvl = Math.min(3, 1 + Math.floor(game.wave / 4));
        if (targetLvl > this.level && this.buildTimer > 600) {
          this.level++;
          this.maxHp += 200; this.hp = Math.min(this.hp + 150, this.maxHp);
          notify(`🔴 RED CASTLE LV.${this.level}!`, "#ff5252");
          addRing(this.x, this.y, "#ff5252");
          setTimeout(() => addRing(this.x, this.y, "#ff5252"), 200);
        }
        // repair nearby red walls
        if (this.buildTimer % 120 === 0) {
          for (const p of this.pads) {
            if (p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + 2);
          }
        }
      }
      hurt(d: number) {
        if (!this.alive) return;
        this.hp = Math.max(0, this.hp - d);
        if (this.hp <= 0) {
          this.alive = false;
          notify("🔥 RED CASTLE DESTROYED! VICTORY!", "#ffd86b");
          addBurst(this.x, this.y, "#ff5252", 40, 10);
          game.texts.push(new FloatText(this.x, this.y - 50, "🏴 RED CASTLE FALLEN!", "#ffd86b"));
          // big gold reward
          game.gold += 100;
          for (let i = 0; i < 20; i++) game.coins.push(new Coin(this.x + (Math.random() - 0.5) * 80, this.y + (Math.random() - 0.5) * 80));
          // spawn viking power-up
          game.powerups.push(new PowerUp(this.x, this.y - 30, "viking"));
        }
      }
      draw() {
        if (!this.alive) return;
        const x = this.x, y = this.y;
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath(); ctx.ellipse(x, y + 38, 55, 10, 0, 0, Math.PI * 2); ctx.fill();
        // red fortress body
        const lvlColors = ["#5a1a1a", "#7a2a2a", "#9a3a3a"];
        ctx.fillStyle = lvlColors[this.level - 1] || "#9a3a3a";
        ctx.beginPath();
        ctx.moveTo(x, y - 40); ctx.lineTo(x - 40, y + 30); ctx.lineTo(x + 40, y + 30); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "#2a0202"; ctx.lineWidth = 3; ctx.stroke();
        // red banner
        ctx.fillStyle = "#ff2020";
        ctx.fillRect(x - 2, y - 56, 4, 20);
        ctx.beginPath(); ctx.moveTo(x + 2, y - 56); ctx.lineTo(x + 18, y - 50); ctx.lineTo(x + 2, y - 44); ctx.closePath(); ctx.fill();
        // skull emblem
        ctx.fillStyle = "#1a0000";
        ctx.beginPath(); ctx.arc(x, y - 12, 11, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#ff3030";
        ctx.beginPath(); ctx.arc(x - 5, y - 14, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 5, y - 14, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#3a0000";
        ctx.fillRect(x - 4, y - 5, 8, 4);
        ctx.strokeStyle = "#ff0000"; ctx.lineWidth = 1;
        ctx.strokeRect(x - 6, y - 5, 12, 4);
        // level indicator
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = i < this.level ? "#ff5252" : "rgba(255,50,50,0.2)";
          ctx.beginPath(); ctx.arc(x - 16 + i * 16, y + 44, 4, 0, Math.PI * 2); ctx.fill();
        }
        // red pulsing aura
        const pulseA = 0.08 + Math.sin(game.mother.glowPulse * 0.8 + x * 0.01) * 0.04;
        ctx.fillStyle = `rgba(255,30,30,${pulseA})`;
        ctx.beginPath(); ctx.arc(x, y - 4, 50 + Math.sin(game.mother.glowPulse * 0.5) * 6, 0, Math.PI * 2); ctx.fill();
        drawHpBar(x, y - 68, 90, this.hp, this.maxHp, true, "#ff3030");
        // label
        ctx.fillStyle = "#ff6666"; ctx.font = "bold 10px 'Cinzel', serif"; ctx.textAlign = "center";
        ctx.fillText(`🔴 RED CASTLE LV.${this.level}`, x, y - 76);
        ctx.textAlign = "start";
      }
    }

    type PadState = "open" | "wall" | "tower";
    type TowerType = "arrow" | "cannon" | "magic" | "sniper";
    class TowerPad {
      x: number; y: number; state: PadState = "open";
      hp = 0; maxHp = 0; payProg = 0; pulse = Math.random() * Math.PI;
      garrison: Soldier | null = null; atkCd = 0; atkRate = 40; atk = 18; range = 180;
      towerType: TowerType = "arrow"; bonusAtk = 0; bonusRange = 0;
      constructor(x: number, y: number) { this.x = x; this.y = y; }
      interact() {
        const wallCost = game._wallCost || COST_WALL;
        const garrisonCost = game._garrisonCost || COST_GARRISON;
        if (game.gold <= 0) return;
        if (this.state === "open") {
          game.gold--; this.payProg++;
          if (this.payProg >= wallCost) {
            this.state = "wall"; this.maxHp = 150; this.hp = 150; this.payProg = 0;
            addBurst(this.x, this.y, "#b0b8c4", 18);
            notify("🧱 Wall built!", "#b0b8c4");
          }
        } else if (this.state === "wall") {
          const free = game.soldiers.find(s => !s.assignedPad);
          if (!free) return;
          game.gold--; this.payProg++;
          if (this.payProg >= garrisonCost) {
            this.state = "tower"; this.maxHp = 200; this.hp = 200; this.payProg = 0;
            this.garrison = free; free.assignedPad = this;
            game.soldiers = game.soldiers.filter(s => s !== free);
            game.stats.towersBuilt++;
            this.applyTowerType();
            addBurst(this.x, this.y, "#52ff7a", 22);
            notify("🏹 Tower garrisoned!", "#52ff7a");
          }
        }
      }
      applyTowerType() {
        const mods: Record<TowerType, { atk: number; range: number; rate: number }> = {
          arrow: { atk: 1, range: 1, rate: 1 },
          cannon: { atk: 1.6, range: 0.7, rate: 0.7 },
          magic: { atk: 0.8, range: 1.4, rate: 1.1 },
          sniper: { atk: 2.2, range: 1.8, rate: 0.5 },
        };
        const m = mods[this.towerType];
        this.atk = Math.round(18 * m.atk * game.towerAtkMult);
        this.range = Math.round(180 * m.range * game.towerRangeMult);
        this.atkRate = Math.round(40 * m.rate);
      }
      update() {
        this.pulse += 0.05;
        if (this.state === "tower") {
          this.atkCd--;
          if (this.atkCd <= 0) {
            let best: any = null, bestD = this.range;
            for (const e of game.enemies) {
              // ghosts dodge towers
              if (e.type === "ghost") continue;
              const d = dist(this, e);
              if (d < bestD) { best = e; bestD = d; }
            }
            if (best) {
              game.projectiles.push(new Projectile(this.x, this.y - 20, best, this.atk));
              this.atkCd = this.atkRate;
            }
          }
        }
      }
      destroy() {
        addBurst(this.x, this.y, "#8a8a94", 20); game.shake = 6;
        if (this.garrison) { this.garrison = null; }
        this.state = "open"; this.hp = 0; this.maxHp = 0; this.payProg = 0;
      }
      draw() {
        const x = this.x, y = this.y;
        if (this.state === "open") {
          const glow = 0.35 + Math.sin(this.pulse) * 0.18;
          ctx.fillStyle = `rgba(255,216,107,${glow * 0.3})`;
          ctx.beginPath(); ctx.arc(x, y, 34, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = `rgba(255,216,107,${glow + 0.5})`;
          ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
          ctx.strokeRect(x - 26, y - 26, 52, 52);
          ctx.setLineDash([]);
          const wallCost = game._wallCost || COST_WALL;
          const pct = this.payProg / wallCost;
          ctx.fillStyle = "rgba(0,0,0,0.75)"; ctx.fillRect(x - 28, y - 40, 56, 14);
          ctx.strokeStyle = "#ffd86b"; ctx.strokeRect(x - 28, y - 40, 56, 14);
          if (pct > 0) { ctx.fillStyle = "#ffd86b"; ctx.fillRect(x - 27, y - 39, 54 * pct, 12); }
          ctx.fillStyle = pct > 0.4 ? "#0d1f3d" : "#ffd86b";
          ctx.font = "bold 10px 'Cinzel', serif"; ctx.textAlign = "center";
          ctx.fillText(`WALL  ${wallCost}g`, x, y - 30);
          ctx.textAlign = "start";
          ctx.font = "18px serif"; ctx.fillStyle = "#ffd86b";
          ctx.textAlign = "center"; ctx.fillText("🧱", x, y + 6); ctx.textAlign = "start";
        } else if (this.state === "wall") {
          const wall3d = game.wall3d;
          // shadow
          ctx.fillStyle = "rgba(0,0,0,0.25)";
          ctx.beginPath(); ctx.ellipse(x + 3, y + 24, 30, 8, 0, 0, Math.PI * 2); ctx.fill();
          if (wall3d) {
            // 3D wall: front face
            const grad = ctx.createLinearGradient(x - 26, y - 20, x + 26, y + 20);
            const hpPct = this.hp / this.maxHp;
            const dark = hpPct < 0.3 ? 40 : hpPct < 0.6 ? 60 : 80;
            grad.addColorStop(0, `rgb(${dark + 60},${dark + 50},${dark + 70})`);
            grad.addColorStop(0.5, `rgb(${dark + 80},${dark + 70},${dark + 90})`);
            grad.addColorStop(1, `rgb(${dark + 40},${dark + 30},${dark + 50})`);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(x - 26, y - 20); ctx.lineTo(x + 26, y - 20);
            ctx.lineTo(x + 30, y + 20); ctx.lineTo(x - 22, y + 20);
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = "#3a3a44"; ctx.lineWidth = 2;
            ctx.stroke();
            // top cap (brighter)
            ctx.fillStyle = `rgb(${dark + 80},${dark + 70},${dark + 95})`;
            ctx.beginPath();
            ctx.moveTo(x - 26, y - 20); ctx.lineTo(x + 26, y - 20);
            ctx.lineTo(x + 30, y - 24); ctx.lineTo(x - 22, y - 24);
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = "#2a2a34"; ctx.lineWidth = 1; ctx.stroke();
            // stone texture lines
            ctx.strokeStyle = "rgba(60,60,70,0.4)"; ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(x - 24, y - 8); ctx.lineTo(x + 28, y - 8);
            ctx.moveTo(x - 23, y + 6); ctx.lineTo(x + 29, y + 6);
            ctx.stroke();
            // vertical stone joints (alternating offset)
            for (let i = 0; i < 4; i++) {
              const jx = x - 22 + i * 14;
              ctx.beginPath();
              ctx.moveTo(jx, y - 20); ctx.lineTo(jx + 2, y + 20);
              ctx.stroke();
            }
            // crenellations on top
            ctx.fillStyle = `rgb(${dark + 75},${dark + 65},${dark + 90})`;
            for (let i = 0; i < 4; i++) {
              const cx2 = x - 18 + i * 12;
              ctx.fillRect(cx2, y - 26, 8, 6);
              ctx.strokeStyle = "#2a2a34"; ctx.lineWidth = 0.8;
              ctx.strokeRect(cx2, y - 26, 8, 6);
            }
          } else {
            // flat wall (original)
            ctx.fillStyle = "#8a8a94"; ctx.fillRect(x - 26, y - 20, 52, 40);
            ctx.strokeStyle = "#3a3a44"; ctx.lineWidth = 2; ctx.strokeRect(x - 26, y - 20, 52, 40);
            ctx.strokeStyle = "#5a5a64"; ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(x - 26, y); ctx.lineTo(x + 26, y);
            ctx.moveTo(x, y - 20); ctx.lineTo(x, y);
            ctx.moveTo(x - 13, y); ctx.lineTo(x - 13, y + 20);
            ctx.moveTo(x + 13, y); ctx.lineTo(x + 13, y + 20);
            ctx.stroke();
          }
          drawHpBar(x, y - 28, 44, this.hp, this.maxHp);
          const garrisonCost = game._garrisonCost || COST_GARRISON;
          const pct = this.payProg / garrisonCost;
          const free = game.soldiers.find(s => !s.assignedPad);
          ctx.fillStyle = "rgba(0,0,0,0.75)"; ctx.fillRect(x - 32, y - 46, 64, 14);
          ctx.strokeStyle = free ? "#52ff7a" : "#666"; ctx.strokeRect(x - 32, y - 46, 64, 14);
          if (pct > 0) { ctx.fillStyle = "#52ff7a"; ctx.fillRect(x - 31, y - 45, 62 * pct, 12); }
          ctx.fillStyle = free ? "#52ff7a" : "#888";
          ctx.font = "bold 9px 'Cinzel', serif"; ctx.textAlign = "center";
          ctx.fillText(free ? `🏹 GARRISON ${garrisonCost}g` : `NEED SOLDIER`, x, y - 36);
          ctx.textAlign = "start";
        } else {
          ctx.fillStyle = "#8a8a94"; ctx.fillRect(x - 22, y - 12, 44, 34);
          ctx.strokeStyle = "#3a3a44"; ctx.lineWidth = 2; ctx.strokeRect(x - 22, y - 12, 44, 34);
          for (let i = 0; i < 4; i++) { ctx.fillStyle = "#7a8290"; ctx.fillRect(x - 22 + i * 12, y - 20, 8, 8); }
          ctx.fillStyle = "#2a6a3a";
          ctx.beginPath(); ctx.arc(x, y - 28, 9, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "#0d2a15"; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.strokeStyle = "#8a5a10"; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(x + 6, y - 28, 6, -Math.PI / 2, Math.PI / 2); ctx.stroke();
          ctx.strokeStyle = "rgba(82,255,122,0.12)"; ctx.lineWidth = 1;
          ctx.setLineDash([3, 6]);
          ctx.beginPath(); ctx.arc(x, y, this.range, 0, Math.PI * 2); ctx.stroke();
          ctx.setLineDash([]);
          drawHpBar(x, y - 40, 44, this.hp, this.maxHp);
          // tower type icon
          const icons: Record<string, string> = { arrow: "🏹", cannon: "💥", magic: "🔮", sniper: "🎯" };
          ctx.font = "14px serif"; ctx.textAlign = "center";
          ctx.fillText(icons[this.towerType] || "🏹", x, y + 18);
          ctx.textAlign = "start";
          // campfire on tower top at night
          if (game.nightCampfires) {
            const nightness = Math.max(0, -getDayPhase());
            if (nightness > 0.3) {
              const flicker = Math.sin(game.mother.glowPulse * 2 + this.x * 0.1) * 2;
              ctx.fillStyle = `rgba(255,150,50,${nightness * 0.2})`;
              ctx.beginPath(); ctx.arc(x, y - 24, 6 + flicker, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = `rgba(255,80,20,${nightness * 0.15})`;
              ctx.beginPath(); ctx.arc(x, y - 24, 10 + flicker, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = "#ff6a20";
              ctx.beginPath(); ctx.moveTo(x, y - 28); ctx.lineTo(x - 2, y - 22); ctx.lineTo(x + 2, y - 22); ctx.closePath(); ctx.fill();
              ctx.fillStyle = "#ffd86b";
              ctx.beginPath(); ctx.moveTo(x, y - 26); ctx.lineTo(x - 1, y - 22); ctx.lineTo(x + 1, y - 22); ctx.closePath(); ctx.fill();
            }
          }
        }
      }
    }

    class Projectile {
      x: number; y: number; target: Enemy; speed = 8; dmg: number; r = 3; dead = false;
      trail: Vec[] = []; life = 0;
      constructor(x: number, y: number, target: Enemy, dmg: number) {
        this.x = x; this.y = y; this.target = target; this.dmg = dmg;
      }
      update() {
        this.life++;
        if (!this.target || !this.target.alive) { this.dead = true; return; }
        const a = Math.atan2(this.target.y - this.y, this.target.x - this.x);
        this.x += Math.cos(a) * this.speed; this.y += Math.sin(a) * this.speed;
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 8) this.trail.shift();
        if (dist(this, this.target) < 12) {
          this.target.hp -= this.dmg;
          game.texts.push(new FloatText(this.target.x, this.target.y - 10, `-${this.dmg}`, "#ffd86b"));
          addBurst(this.target.x, this.target.y, "#ffd86b", 6);
          addRing(this.target.x, this.target.y, "#ffd86b");
          if (this.target.hp <= 0) this.target.kill();
          this.dead = true;
        }
      }
      draw() {
        // arrow shaft trail
        for (let i = 0; i < this.trail.length; i++) {
          const t = this.trail[i];
          ctx.globalAlpha = (i / this.trail.length) * 0.5;
          ctx.fillStyle = "#8a5a10";
          const tw = this.r * (i / this.trail.length) * 0.7;
          ctx.fillRect(t.x - tw / 2, t.y - tw / 2, tw, tw);
        }
        ctx.globalAlpha = 1;
        // arrow head
        const a = this.target && this.target.alive
          ? Math.atan2(this.target.y - this.y, this.target.x - this.x)
          : 0;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(a);
        ctx.fillStyle = "#8a5a10";
        ctx.fillRect(-1, -1, 8, 2);
        ctx.fillStyle = "#c0c0c0";
        ctx.beginPath();
        ctx.moveTo(8, -3); ctx.lineTo(14, 0); ctx.lineTo(8, 3);
        ctx.closePath(); ctx.fill();
        // fletching
        ctx.fillStyle = "#ff5252";
        ctx.beginPath();
        ctx.moveTo(-2, -4); ctx.lineTo(2, -1); ctx.lineTo(-2, 2);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }

    function drawHpBar(x: number, y: number, w: number, hp: number, maxHp: number, ornate = false, color?: string) {
      const pct = Math.max(0, hp) / maxHp;
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(x - w / 2 - 1, y, w + 2, ornate ? 8 : 5);
      if (color) {
        ctx.fillStyle = color;
      } else {
        const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
        g.addColorStop(0, "#ff5252"); g.addColorStop(0.5, "#ffd86b"); g.addColorStop(1, "#52ff7a");
        ctx.fillStyle = g;
      }
      ctx.fillRect(x - w / 2, y + 1, w * pct, ornate ? 6 : 3);
      if (ornate) {
        ctx.strokeStyle = "#ffd86b"; ctx.lineWidth = 1;
        ctx.strokeRect(x - w / 2 - 1, y, w + 2, 8);
      }
    }

    /* game state */
    const game = {
      player: null as any as Player,
      castle: null as any as Castle,
      soldiers: [] as Soldier[],
      enemies: [] as Enemy[],
      coins: [] as Coin[],
      pads: [] as TowerPad[],
      projectiles: [] as Projectile[],
      texts: [] as FloatText[],
      powerups: [] as PowerUp[],
      chests: [] as TreasureChest[],
      joy: { active: false, dir: { x: 0, y: 0 }, startX: 0, startY: 0, touchId: null as any, screenX: 0, screenY: 0 },
      joyDash: false,
      gold: 0, wave: 1, spawnTimer: 120, toSpawn: 0, shake: 0, gameOver: false,
      chestTimer: 0, dayTime: 0, showAdmin: false, adminTab: 0, adminDrag: false,
      adminDragOffX: 0, adminDragOffY: 0, adminAX: 0, adminAY: 0,
      mother: { msgTimer: 0, msgQueue: [] as string[], glowPulse: 0, phase: "idle" as "idle"|"speaking" },
      _portal: null as { x: number; y: number; angle: number; t: number } | null,
      dmgMult: 1, enemyHpMult: 1, spawnRateMult: 1, goldMult: 1,
      towerAtkMult: 1, towerRangeMult: 1, castleHpMult: 1,
      _wallCost: COST_WALL, _garrisonCost: COST_GARRISON, _waveBase: 4, _maxSoldiers: 5,
      motherEnabled: true, motherTipFreq: 1, autoPostOnWave: true, showSoldierUI: true,
      nightCampfires: true, wall3d: true, spellRespawnTimer: 0,
      superRareChance: 0.002,
      notifications: [] as { text: string; timer: number; maxT: number; color: string }[],
      _sliderDragKey: null as string | null, _sliderDragMin: 0, _sliderDragMax: 1, _sliderDragStep: 0.1, _sliderDragX: 0,
      skillOrbs: [] as SkillOrb[], flowers: [] as Flower[],
      camX: 0, camY: 0, redCastle: null as any as RedCastle,
      showStats: false, showCombat: false,
      stats: { kills: 0, goldEarned: 0, damageDealt: 0, wavesCompleted: 0, soldiersLost: 0, dragonsSlain: 0, towersBuilt: 0 },
      combatLog: [] as { text: string; frame: number; color: string }[],
      mouseX: 0, mouseY: 0,
    };

    function spawnSoldier() {
      if (game.soldiers.length + game.pads.filter(p => p.state === "tower").length >= game.castle.maxSoldiers()) return;
      const a = Math.random() * Math.PI * 2;
      game.soldiers.push(new Soldier(game.castle.x + Math.cos(a) * 50, game.castle.y + Math.sin(a) * 50));
    }

    function spawnChest() {
      let x = 0, y = 0, tries = 0;
      do {
        x = Math.random() * (W() - 60) + 30;
        y = Math.random() * (H() - 60) + 30;
        tries++;
      } while (tries < 20 && (
        dist({ x, y }, game.castle) < 100 ||
        game.pads.some(p => dist({ x, y }, p) < 60) ||
        dist({ x, y }, game.player) < 100
      ));
      game.chests.push(new TreasureChest(x, y));
    }

    /* AI Commander — controls every soldier with math + Red AI display for enemies */
    let redAiFlavor = 0;
    function aiCommander() {
      if (game.gameOver || game.soldiers.length === 0) return;
      redAiFlavor += 0.02;

      // 1. Threat-scoring: for each tower/wall, compute weighted threat
      const threats: { pad: TowerPad; score: number }[] = [];
      for (const p of game.pads) {
        if (p.state !== "tower" && p.state !== "wall") continue;
        let score = 0;
        for (const e of game.enemies) {
          if (!e.alive) continue;
          const d = dist(e, p);
          if (d < 250) {
            const closeness = 1 - d / 250;
            const typeWeight = e.type === "dragon" ? 3 : e.type === "boss" ? 2.5 : e.type === "brute" ? 1.3 : 1;
            score += closeness * typeWeight;
          }
        }
        if (score > 0.1) threats.push({ pad: p, score });
      }
      threats.sort((a, b) => b.score - a.score);

      // 2. Assignment: match idle/patrol soldiers to threats by proximity
      const used = new Set<Soldier>();
      for (const t of threats) {
        const candidates = game.soldiers.filter(s =>
          !used.has(s) &&
          (s.state === "idle" || s.state === "patrol") &&
          dist(s, t.pad) < 400
        );
        candidates.sort((a, b) => dist(a, t.pad) - dist(b, t.pad));
        const needed = Math.min(Math.ceil(t.score), candidates.length, 3);
        for (let i = 0; i < needed; i++) {
          const s = candidates[i];
          s.state = "patrol";
          s.patrolTarget = { x: t.pad.x, y: t.pad.y };
          s.shiftTimer = 200 + Math.random() * 100;
          used.add(s);
        }
      }

      // 3. Player protection: if player is low HP and enemies nearby, send closest idle soldiers
      if (game.player.hp < game.player.maxHp * 0.5) {
        const nearbyThreat = game.enemies.some(e => e.alive && dist(e, game.player) < 180);
        if (nearbyThreat) {
          const protectors = game.soldiers.filter(s =>
            !used.has(s) && s.state === "idle" && dist(s, game.player) < 350
          );
          protectors.sort((a, b) => dist(a, game.player) - dist(b, game.player));
          for (const s of protectors.slice(0, 2)) {
            s.state = "follow";
            s.shiftTimer = 150 + Math.random() * 80;
            used.add(s);
          }
        }
      }

      // 4. Night rest: soldiers rest near castle; enemies fear walls
      const nightness = Math.max(0, -getDayPhase());
      if (nightness > 0.5) {
        const patrolCount = game.soldiers.filter(s => s.state === "patrol").length;
        if (patrolCount > 2) {
          const extraPatrols = game.soldiers.filter(s => s.state === "patrol").slice(2);
          for (const s of extraPatrols) {
            s.state = "idle";
            s.shiftTimer = 200 + Math.random() * 150;
          }
        }
      }

      // 5. Periodic post rotation: shift idle soldiers who have rested enough
      if (frame % 120 === 0) {
        const wellRested = game.soldiers.filter(s =>
          s.state === "idle" && s.hp >= s.maxHp * 0.9 && Math.random() < 0.3
        );
        for (const s of wellRested.slice(0, Math.max(1, Math.floor(threats.length / 2)))) {
          s.state = "patrol";
          s.shiftTimer = 250 + Math.random() * 150;
          s.pickPost();
        }
      }

      // 6. Enemy wall-fear at night (enemies avoid walls when night > 0.6, skip castle)
      if (nightness > 0.6) {
        for (const e of game.enemies) {
          if (!e.alive || e.type === "dragon" || e.type === "blackDragon" || e.type === "ghost") continue;
          // find nearest wall - if too close, flee
          for (const p of game.pads) {
            if (p.state !== "wall" && p.state !== "tower") continue;
            if (dist(e, p) < 60 && Math.random() < 0.05) {
              const fa = Math.atan2(e.y - p.y, e.x - p.x);
              e.x += Math.cos(fa) * 3;
              e.y += Math.sin(fa) * 3;
            }
          }
        }
      }
    }

    function init() {
      game.castle = new Castle(MAP_W * 0.25, MAP_H / 2);
      game.player = new Player(MAP_W * 0.25, MAP_H / 2 + 100);
      game.redCastle = new RedCastle(MAP_W * 0.75, MAP_H / 2);
      const off = Math.min(W(), H()) * 0.28;
      game.pads = [
        new TowerPad(game.castle.x - off, game.castle.y - off),
        new TowerPad(game.castle.x + off, game.castle.y - off),
        new TowerPad(game.castle.x - off, game.castle.y + off),
        new TowerPad(game.castle.x + off, game.castle.y + off),
      ];
      game.soldiers = []; game.enemies = []; game.coins = [];
      game.projectiles = []; game.texts = []; game.powerups = []; game.chests = [];
      game.gold = 15; game.wave = 1; game.spawnTimer = 180; game.toSpawn = 0;
      game.gameOver = false; game.chestTimer = 300; game.dayTime = 0;
      game.mother.msgQueue = []; game.mother.msgTimer = 0; game._portal = null;
      seedWorld();
      startWave();
    }

    function startWave() {
      const base = game._waveBase || 4;
      game.toSpawn = base + Math.floor(game.wave * 1.5 + Math.pow(game.wave, 0.7) * 3);
      const baseDelay = game.wave === 1 ? 80 : Math.max(12, 60 - game.wave * 2.5);
      game.spawnTimer = Math.round(baseDelay / (game.spawnRateMult || 1));
    }

    function spawnEnemy() {
      const edge = Math.floor(Math.random() * 4);
      const m = 30; let ex = 0, ey = 0;
      if (edge === 0) { ex = Math.random() * W(); ey = -m; }
      else if (edge === 1) { ex = W() + m; ey = Math.random() * H(); }
      else if (edge === 2) { ex = Math.random() * W(); ey = H() + m; }
      else { ex = -m; ey = Math.random() * H(); }
      const r = Math.random();
      let type: Enemy["type"] = "imp";
      // super rare spawn (wave 5+): chance for black dragon or multiple bosses
      if (game.wave >= 5 && r < game.superRareChance) {
        const rareType = Math.random();
        if (rareType < 0.3) { type = "blackDragon"; notify("🐉 SUPER RARE: BLACK DRAGON APPEARS!", "#ff0000"); }
        else {
          type = "boss"; notify("💀 SUPER RARE: ELITE BOSS INVASION!", "#ff5252");
          // spawn extra minions with boss
          for (let i = 0; i < 3; i++) spawnEnemy();
        }
      } else if (game.wave >= 10 && r < 0.02) type = "blackDragon";
      else if (game.wave >= 8 && r < 0.06) type = "dragon";
      else if (game.wave >= 6 && r < 0.08) type = "boss";
      else if (game.wave >= 3 && r < 0.20) type = "brute";
      else if (game.wave >= 2 && r < 0.18) type = "ghost";
      const scale = 1 + (game.wave - 1) * 0.12;
      const e = new Enemy(ex, ey, type, scale);
      // spawn effect
      for (let i = 0; i < 5; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = Math.random() * 2 + 1;
        particles.push({ x: ex, y: ey, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 12, max: 12, color: "#ff525280", r: 2 });
      }
      game.enemies.push(e);
    }

    /* input */
    const keys: Record<string, boolean> = {};
    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.code] = true;
      if (e.ctrlKey && e.shiftKey && e.code === "KeyA") {
        e.preventDefault();
        game.showAdmin = !game.showAdmin;
        if (game.showAdmin) { game.adminAX = W() / 2 - 150; game.adminAY = H() / 2 - 120; }
      }
      if (e.code === "KeyP" && !game.gameOver) {
        for (const s of game.soldiers) s.orderToPost();
        game.texts.push(new FloatText(W() / 2, H() / 2 - 20, "⚔ TO YOUR POST! ⚔", "#ffd86b"));
        addRing(W() / 2, H() / 2, "#ffd86b");
      }
      if (e.code === "Tab") { e.preventDefault(); game.showStats = !game.showStats; }
      if (e.code === "KeyC") { game.showCombat = !game.showCombat; }
    };
    const onKeyUp = (e: KeyboardEvent) => { keys[e.code] = false; };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        if (game.joy.touchId === null) {
          const rect = canvas.getBoundingClientRect();
          game.joy.touchId = t.identifier;
          game.joy.startX = t.clientX; game.joy.startY = t.clientY;
          game.joy.screenX = t.clientX - rect.left; game.joy.screenY = t.clientY - rect.top;
          game.joy.active = true;
        } else if (t.identifier !== game.joy.touchId) {
          // second finger = dash
          game.joyDash = true;
        }
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === game.joy.touchId) {
          const dx = t.clientX - game.joy.startX, dy = t.clientY - game.joy.startY;
          const max = 50; const d = Math.hypot(dx, dy); const n = d > max ? max / d : 1;
          game.joy.dir.x = (dx * n) / max; game.joy.dir.y = (dy * n) / max;
        }
      }
    };
    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === game.joy.touchId) {
          game.joy.active = false; game.joy.dir.x = 0; game.joy.dir.y = 0; game.joy.touchId = null;
        }
      }
    };
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd, { passive: false });

    /* hints — with proper box sizing */
    function updateHint() {
      if (!hintRef.current) return;
      let msg = "WASD/arrows move · Space dash · [P] post · [Tab] stats · [C] combat log · Shift+A admin";
      if (game.player.powerTimer > 0) {
        const labels: any = { speed: "⚡ SPEED BOOST active", damage: "🗡 DMG BOOST active", shield: "🛡 SHIELD active", viking: "⚔ VIKING POWER active" };
        msg = labels[game.player.powerType || "speed"];
      } else if (game.castle.level < 3 && dist(game.player, game.castle) < 60)
        msg = `🏰 Upgrade castle: ${game.castle.payProg}/${game.castle.cap}g`;
      else {
        for (const p of game.pads) {
          if (dist(game.player, p) < 44) {
            if (p.state === "open") msg = `🧱 Build wall: ${p.payProg}/${COST_WALL}g`;
            else if (p.state === "wall") {
              const free = game.soldiers.find(s => !s.assignedPad);
              msg = free ? `🏹 Garrison soldier: ${p.payProg}/${COST_GARRISON}g` : `⚠ Need a free soldier`;
            }
            break;
          }
        }
      }
      hintRef.current.textContent = msg;
    }

    function notify(text: string, color = "#ffd86b") {
      game.notifications.push({ text, timer: 120, maxT: 120, color });
      if (game.notifications.length > 5) game.notifications.shift();
    }

    /* update */
    let frame = 0;
    function update() {
      if (game.gameOver) return;

      // wave spawning
      if (game.toSpawn > 0) {
        game.spawnTimer--;
        if (game.spawnTimer <= 0) {
          spawnEnemy(); game.toSpawn--;
          game.spawnTimer = Math.max(20, 70 - game.wave * 2);
        }
      } else if (game.enemies.length === 0) {
        game.spawnTimer--;
        if (game.spawnTimer <= 0) { game.wave++; game.stats.wavesCompleted++; startWave(); }
      }

      game.player.update();

      // AI commander: controls every soldier with logic & math (runs every 4 frames for perf)
      if (frame % 4 === 0) aiCommander();
      // "To your post" order auto-triggers at wave start
      if (game.autoPostOnWave && game.toSpawn > 0 && frame % 60 === 0 && frame < 180) {
        for (const s of game.soldiers) s.orderToPost();
      }

      for (const s of game.soldiers) s.update();
      for (const e of game.enemies) if (e.alive) e.update();
      for (const p of game.pads) p.update();
      for (const pr of game.projectiles) pr.update();
      for (const c of game.coins) c.update();
      for (const t of game.texts) t.update();
      for (const pu of game.powerups) pu.update();
      for (const ch of game.chests) ch.update();
      for (const o of game.skillOrbs) o.update();
      for (const f of game.flowers) f.update();
      for (const p of particles) { p.x += p.vx; p.y += p.vy; p.vx *= 0.92; p.vy *= 0.92; p.life--; }

      // treasure chest spawner
      game.chestTimer--;
      if (game.chestTimer <= 0 && game.chests.length < 2) {
        spawnChest();
        game.chestTimer = 400 + Math.floor(Math.random() * 300);
      }

      game.enemies = game.enemies.filter(e => e.alive);
      // red castle enemies also filtered
      if (game.redCastle && !game.redCastle.alive) {
        game.redCastle.pads = game.redCastle.pads.filter(p => p.hp > 0 || p.state !== "open");
      }
      game.coins = game.coins.filter(c => !c.collected && c.life > 0);
      game.projectiles = game.projectiles.filter(p => !p.dead);
      game.texts = game.texts.filter(t => !t.dead);
      game.soldiers = game.soldiers.filter(s => s.hp > 0);
      game.powerups = game.powerups.filter(p => !p.collected && p.life > 0);
      game.chests = game.chests.filter(c => !c.collected && c.life > 0);
      game.skillOrbs = game.skillOrbs.filter(o => !o.collected && o.life > 0);
      game.flowers = game.flowers.filter(f => {
        if (f.life <= 0) {
          for (let i = 0; i < 6; i++) {
            const a = Math.random() * Math.PI * 2; const s = Math.random() * 1.5 + 0.5;
            particles.push({ x: f.x, y: f.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 40, max: 40, color: "#6aff6a80", r: 2 + Math.random() * 2 });
          }
          return false;
        }
        return true;
      });
      while (particles.length && particles[0].life <= 0) particles.shift();

      if (frame % 4 === 0) {
        if (dist(game.player, game.castle) < 50) game.castle.tryUpgrade();
        for (const p of game.pads) {
          if (dist(game.player, p) < 38) { p.interact(); break; }
        }
      }

      // wall portal: player clips through walls with visual effect
      for (const p of game.pads) {
        if (p.state === "wall" && dist(game.player, p) < 30 && game._portal === null) {
          const a = Math.atan2(game.player.y - p.y, game.player.x - p.x);
          game._portal = { x: p.x, y: p.y, angle: a, t: 60 };
          addBurst(p.x, p.y, "#aacfff", 8, 4);
        }
      }
      if (game._portal && game._portal.t <= 0) game._portal = null;

      if (game.shake > 0) game.shake *= 0.85;

      for (const s of snow) {
        s.y += s.vy; s.x += s.vx;
        if (s.y > H()) { s.y = -2; s.x = Math.random() * W(); }
        if (s.x < 0) s.x = W(); if (s.x > W()) s.x = 0;
      }

      if (game.castle.hp <= 0 || game.player.hp <= 0) game.gameOver = true;

      // day/night cycle (0-1200)
      game.dayTime = (game.dayTime + 0.3) % 1200;

      // camera follows player, clamped to map
      game.camX = Math.max(0, Math.min(MAP_W - W(), game.player.x - W() / 2));
      game.camY = Math.max(0, Math.min(MAP_H - H(), game.player.y - H() / 2));

      // update Red Castle
      if (game.redCastle) {
        game.redCastle.update();
        for (const p of game.redCastle.pads) p.update();
      }

      // spell respawn timer: periodically respawns skill orbs on map
      game.spellRespawnTimer--;
      if (game.spellRespawnTimer <= 0 && game.skillOrbs.length < 3) {
        const sx = 30 + Math.random() * (W() - 60);
        const sy = 30 + Math.random() * (H() - 60);
        game.skillOrbs.push(new SkillOrb(sx, sy));
        game.spellRespawnTimer = 600 + Math.floor(Math.random() * 400);
      }

      // night: buff enemies, make them stronger but fear walls
      const nightness = Math.max(0, -getDayPhase());
      if (nightness > 0.5) {
        for (const e of game.enemies) {
          if (!e.alive) continue;
          // at night, enemies move 20% faster
          e.speed = 1.2 * (1 - Math.min(0.25, (game.wave - 1) * 0.04));
          // regenerate slowly at night
          if (frame % 60 === 0 && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + 0.5);
        }
      } else {
        // daytime restore base speed (recalc at spawn or via update)
      }

      // mother entity: contextual tips
      game.mother.glowPulse += 0.04;
      if (game.motherEnabled) {
        game.mother.msgTimer -= game.motherTipFreq;
        if (game.mother.msgTimer <= 0 && game.mother.msgQueue.length > 0) {
          const msg = game.mother.msgQueue.shift()!;
          game.texts.push(new FloatText(W() / 2, H() / 2 - 40, `🌿 MOTHER: ${msg}`, "#cfe9ff"));
          addRing(W() / 2, H() / 2 - 20, "#cfe9ff");
          game.mother.msgTimer = 300;
        }
        // auto-queue mother messages based on game state
        if (game.wave === 1 && game.toSpawn === 0 && game.enemies.length === 0 && !game.gameOver) {
          if (game.pads.filter(p => p.state === "tower").length < 1 && game.mother.msgQueue.length === 0 && game.mother.msgTimer < 0) {
            game.mother.msgQueue.push("Build walls and garrison archers to defend!");
            game.mother.msgTimer = 60;
          }
        }
        if (game.wave >= 3 && game.pads.filter(p => p.state === "tower").length < 2 && Math.random() < 0.002 * game.motherTipFreq) {
          game.mother.msgQueue.push("You need more towers to hold the line...");
        }
        if (game.gold < 5 && game.wave > 2 && Math.random() < 0.002 * game.motherTipFreq) {
          game.mother.msgQueue.push("Gold is low — explore for treasure chests!");
        }
      }

      if (goldRef.current) goldRef.current.textContent = String(game.gold);
      if (waveRef.current) waveRef.current.textContent = String(game.wave);
      if (armyRef.current) {
        const garr = game.pads.filter(p => p.state === "tower").length;
        armyRef.current.textContent = `${game.soldiers.length}+${garr}/${game.castle.maxSoldiers()}`;
      }
      if (hpRef.current) {
        const pct = Math.max(0, game.castle.hp) / game.castle.maxHp;
        hpRef.current.style.width = `${pct * 100}%`;
      }
      if (frame % 8 === 0) updateHint();
    }

    /* draw */
    function getDayPhase() {
      const t = game.dayTime;
      const day = Math.sin((t / 1200) * Math.PI * 2);
      return day; // -1 (midnight) to 1 (noon)
    }
    function drawBackground() {
      const phase = getDayPhase();
      const brightness = 0.5 + phase * 0.5;
      const r1 = Math.round(130 + (220 - 130) * brightness);
      const g1 = Math.round(160 + (230 - 160) * brightness);
      const b1 = Math.round(180 + (240 - 180) * brightness);
      const r2 = Math.round(60 + (180 - 60) * brightness);
      const g2 = Math.round(80 + (200 - 80) * brightness);
      const b2 = Math.round(100 + (220 - 100) * brightness);
      const grad = ctx.createRadialGradient(W() / 2, H() / 2, 80, W() / 2, H() / 2, W() * 0.85);
      grad.addColorStop(0, `rgb(${r1},${g1},${b1})`);
      grad.addColorStop(1, `rgb(${r2},${g2},${b2})`);
      ctx.fillStyle = grad; ctx.fillRect(0, 0, W(), H());

      // sun/moon
      const angle = (game.dayTime / 1200) * Math.PI * 2 - Math.PI / 2;
      const sx = W() / 2 + Math.cos(angle) * W() * 0.45;
      const sy = H() / 2 + Math.sin(angle) * W() * 0.45;
      if (phase > -0.2) {
        ctx.fillStyle = "#ffd86b";
        ctx.beginPath(); ctx.arc(sx, sy, 18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,216,107,0.15)";
        ctx.beginPath(); ctx.arc(sx, sy, 40, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = "#c0c8d0";
        ctx.beginPath(); ctx.arc(sx, sy, 14, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(200,200,210,0.1)";
        ctx.beginPath(); ctx.arc(sx, sy, 30, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(200,200,210,0.15)";
        ctx.beginPath(); ctx.arc(sx + 4, sy - 3, 14, 0, Math.PI * 2); ctx.fill();
      }

      for (const p of game.pads) {
        ctx.strokeStyle = "rgba(120,140,160,0.45)"; ctx.lineWidth = 22;
        ctx.beginPath(); ctx.moveTo(game.castle.x, game.castle.y); ctx.lineTo(p.x, p.y); ctx.stroke();
        ctx.strokeStyle = "rgba(220,230,240,0.25)"; ctx.lineWidth = 18;
        ctx.beginPath(); ctx.moveTo(game.castle.x, game.castle.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      }

      for (const r of rocks) {
        ctx.fillStyle = "#6a7282";
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.beginPath(); ctx.arc(r.x, r.y - r.r * 0.4, r.r * 0.7, Math.PI, 0); ctx.fill();
      }
      for (const t of trees) {
        const x = t.x, y = t.y, s = t.s;
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath(); ctx.ellipse(x, y + 4, 14 * s, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#1f3a24";
        ctx.beginPath(); ctx.moveTo(x, y - 22 * s); ctx.lineTo(x - 14 * s, y); ctx.lineTo(x + 14 * s, y); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x, y - 34 * s); ctx.lineTo(x - 11 * s, y - 10 * s); ctx.lineTo(x + 11 * s, y - 10 * s); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.beginPath(); ctx.moveTo(x, y - 34 * s); ctx.lineTo(x - 6 * s, y - 22 * s); ctx.lineTo(x + 6 * s, y - 22 * s); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      for (const s of snow) { ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill(); }
    }

    function draw() {
      ctx.save();
      if (game.shake > 0.5) ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
      ctx.clearRect(0, 0, W(), H());
      // camera transform: everything drawn in world coords gets offset
      ctx.save();
      ctx.translate(-game.camX, -game.camY);
      drawBackground();

      // draw both castle pad sets
      for (const p of game.pads) p.draw();
      if (game.redCastle) for (const p of game.redCastle.pads) p.draw();
      game.castle.draw();
      if (game.redCastle) game.redCastle.draw();

      // Distance radius: draw circle around castle when player is nearby
      if (dist(game.player, game.castle) < 300) {
        ctx.strokeStyle = "rgba(90,166,255,0.1)"; ctx.lineWidth = 1;
        ctx.setLineDash([4, 8]);
        ctx.beginPath(); ctx.arc(game.castle.x, game.castle.y, 120, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(90,166,255,0.3)"; ctx.font = "7px 'Cinzel', serif"; ctx.textAlign = "center";
        ctx.fillText("120m", game.castle.x, game.castle.y - 115);
        ctx.textAlign = "start";
      }
      for (const c of game.coins) c.draw();
      for (const ch of game.chests) ch.draw();
      for (const pu of game.powerups) pu.draw();
      for (const e of game.enemies) e.draw();
      for (const s of game.soldiers) s.draw();
      game.player.draw();
      // blood trail (under player)
      for (const b of game.player.bloodTrail) b.draw();
      // flowers
      for (const f of game.flowers) f.draw();
      // skill orbs
      for (const o of game.skillOrbs) o.draw();
      for (const pr of game.projectiles) pr.draw();

      // Zone control: blue territory (player) and red territory (enemy)
      const zonePulse = Math.sin(game.mother.glowPulse * 0.3) * 0.5 + 0.5;
      // blue zone around castle
      const blueZoneR = 160 + game.pads.filter(p => p.state === "tower").length * 20;
      ctx.strokeStyle = `rgba(90,166,255,${0.06 + zonePulse * 0.04})`; ctx.lineWidth = 2; ctx.setLineDash([8, 12]);
      ctx.beginPath(); ctx.arc(game.castle.x, game.castle.y, blueZoneR, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = `rgba(90,166,255,${0.02 + zonePulse * 0.02})`;
      ctx.beginPath(); ctx.arc(game.castle.x, game.castle.y, blueZoneR, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(90,166,255,${0.15 + zonePulse * 0.1})`; ctx.font = "8px 'Cinzel', serif"; ctx.textAlign = "center";
      ctx.fillText(`🔵 BLUE ZONE ${Math.round(blueZoneR)}m`, game.castle.x, game.castle.y - blueZoneR - 6);
      ctx.textAlign = "start";
      // red zone around red castle
      if (game.redCastle && game.redCastle.alive) {
        const redZoneR = 160 + game.redCastle.pads.filter(p => p.state === "tower").length * 20;
        ctx.strokeStyle = `rgba(255,50,50,${0.06 + (1 - zonePulse) * 0.04})`; ctx.lineWidth = 2; ctx.setLineDash([8, 12]);
        ctx.beginPath(); ctx.arc(game.redCastle.x, game.redCastle.y, redZoneR, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = `rgba(255,50,50,${0.02 + (1 - zonePulse) * 0.02})`;
        ctx.beginPath(); ctx.arc(game.redCastle.x, game.redCastle.y, redZoneR, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255,100,100,${0.15 + (1 - zonePulse) * 0.1})`; ctx.font = "8px 'Cinzel', serif"; ctx.textAlign = "center";
        ctx.fillText(`🔴 RED ZONE ${Math.round(redZoneR)}m`, game.redCastle.x, game.redCastle.y - redZoneR - 6);
        ctx.textAlign = "start";
      }

      // restore camera transform — UI draws in screen space
      ctx.restore();

      // AI soldier status display (top-left canvas) — BLUE ARMY UI
      if (game.showSoldierUI) {
        const idleC = game.soldiers.filter(s => s.state === "idle").length;
        const patrolC = game.soldiers.filter(s => s.state === "patrol").length;
        const followC = game.soldiers.filter(s => s.state === "follow").length;
        const warriorC = game.soldiers.filter(s => s.type === "warrior").length;
        const healerC = game.soldiers.filter(s => s.type === "healer").length;
        const builderC = game.soldiers.filter(s => s.type === "builder").length;
        const foodC = game.soldiers.filter(s => s.type === "food").length;
        const uiW = 160;
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.beginPath(); ctx.roundRect(4, 4, uiW, 56, 6); ctx.fill();
        ctx.fillStyle = "#5aa6ff"; ctx.font = "bold 9px 'Cinzel', serif"; ctx.textAlign = "start";
        ctx.fillText(`🔵 BLUE ARMY ${game.soldiers.length}`, 10, 14);
        ctx.fillStyle = "#ffd86b"; ctx.fillText(`●${patrolC}`, 10, 27);
        ctx.fillStyle = "#5aa6ff"; ctx.fillText(`◉${followC}`, 42, 27);
        ctx.fillStyle = "#aaa"; ctx.fillText(`○${idleC}`, 78, 27);
        const garrC = game.pads.filter(p => p.state === "tower").length;
        if (garrC > 0) { ctx.fillStyle = "#3a7aff"; ctx.fillText(`🏰${garrC}`, 110, 27); }
        ctx.font = "7px 'Cinzel', serif"; ctx.fillStyle = "#8af";
        ctx.fillText(`⚔${warriorC} 💚${healerC} 🔨${builderC} 🍞${foodC}`, 10, 42);
        ctx.fillStyle = "#888"; ctx.font = "7px 'Cinzel', serif";
        ctx.fillText(`🏰${game.castle.level} 📡${Math.round(dist(game.player, game.castle))}m`, 10, 54);
      }

      // RED AI ENEMY COMMANDER DISPLAY (big red text, top right area)
      const enemyCount = game.enemies.filter(e => e.alive).length;
      if (enemyCount > 0) {
        const redX = W() / 2 - 70;
        const redY = 8;
        ctx.fillStyle = "rgba(40,0,0,0.7)";
        ctx.beginPath(); ctx.roundRect(redX, redY, 140, 32, 6); ctx.fill();
        ctx.strokeStyle = `rgba(255,50,50,${0.3 + Math.sin(redAiFlavor * 2) * 0.15})`;
        ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = "#ff3030"; ctx.font = "bold 13px 'Cinzel', serif"; ctx.textAlign = "center";
        ctx.fillText(`🔴 RED AI`, redX + 70, redY + 12);
        ctx.font = "bold 10px 'Cinzel', serif"; ctx.fillStyle = "#ff6666";
        ctx.fillText(`👹 ${enemyCount} units · 🌙 ${Math.max(0, -getDayPhase()) > 0.3 ? "NIGHT" : "DAY"}`, redX + 70, redY + 26);
        ctx.textAlign = "start";
      }

      // Dragon Life Display — shows HP for dragons/black dragons
      const dragons = game.enemies.filter(e => e.alive && (e.type === "dragon" || e.type === "blackDragon"));
      if (dragons.length > 0) {
        const dgY = 50;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.beginPath(); ctx.roundRect(W() / 2 - 80, dgY, 160, 14 * dragons.length + 10, 6); ctx.fill();
        ctx.font = "bold 8px 'Cinzel', serif"; ctx.textAlign = "center";
        for (let di = 0; di < dragons.length; di++) {
          const d = dragons[di];
          const dy = dgY + 6 + di * 14;
          const col = d.type === "blackDragon" ? "#8a0a0a" : "#c04040";
          ctx.fillStyle = col; ctx.fillText(d.type === "blackDragon" ? "🐉 BLACK DRAGON" : "🐉 DRAGON", W() / 2, dy);
          const pct = d.hp / d.maxHp;
          ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(W() / 2 - 60, dy + 2, 120, 6);
          ctx.fillStyle = pct > 0.5 ? "#ff5252" : pct > 0.25 ? "#ff8a20" : "#ff0000";
          ctx.fillRect(W() / 2 - 59, dy + 3, 118 * pct, 4);
        }
        ctx.textAlign = "start";
      }

      // campfires at night
      const nightness = Math.max(0, -getDayPhase());
      if (nightness > 0.3) {
        const nFires = Math.min(3, 1 + Math.floor(game.pads.filter(p => p.state === "tower").length / 2));
        for (let i = 0; i < nFires; i++) {
          const fx = game.castle.x - 30 + i * 30 - (nFires - 1) * 15;
          const fy = game.castle.y + 40;
          const flicker = Math.sin(game.mother.glowPulse * 2 + i * 1.5) * 3;
          ctx.fillStyle = `rgba(255,150,50,${0.15 + Math.sin(game.mother.glowPulse + i) * 0.08})`;
          ctx.beginPath(); ctx.arc(fx, fy + 2, 22 + flicker, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = `rgba(255,80,20,${0.1 + Math.sin(game.mother.glowPulse * 1.5 + i * 2) * 0.05})`;
          ctx.beginPath(); ctx.arc(fx, fy + 2, 30 + flicker * 1.5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#8a5a10"; ctx.fillRect(fx - 6, fy + 2, 12, 6);
          ctx.fillStyle = "#ff6a20";
          ctx.beginPath(); ctx.moveTo(fx, fy - 4); ctx.lineTo(fx - 4, fy + 6); ctx.lineTo(fx + 4, fy + 6); ctx.closePath(); ctx.fill();
          ctx.fillStyle = "#ffd86b";
          ctx.beginPath(); ctx.moveTo(fx, fy - 2); ctx.lineTo(fx - 2, fy + 4); ctx.lineTo(fx + 2, fy + 4); ctx.closePath(); ctx.fill();
        }
      }

      // mother entity (floating guide spirit)
      const mx = game.castle.x + Math.sin(game.mother.glowPulse * 0.5) * 60;
      const my = game.castle.y - 80 + Math.sin(game.mother.glowPulse * 0.7) * 10;
      ctx.fillStyle = `rgba(160,200,255,${0.1 + Math.sin(game.mother.glowPulse) * 0.05})`;
      ctx.beginPath(); ctx.arc(mx, my, 30, 0, Math.PI * 2); ctx.fill();
      const mg = ctx.createRadialGradient(mx - 3, my - 3, 2, mx, my, 18);
      mg.addColorStop(0, "rgba(200,230,255,0.9)");
      mg.addColorStop(0.5, "rgba(120,180,255,0.5)");
      mg.addColorStop(1, "rgba(80,140,255,0.1)");
      ctx.fillStyle = mg;
      ctx.beginPath(); ctx.arc(mx, my, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "16px serif"; ctx.textAlign = "center";
      ctx.fillText("🌿", mx, my + 5);
      ctx.textAlign = "start";
      // wisps around mother
      for (let i = 0; i < 3; i++) {
        const wa = game.mother.glowPulse * 1.2 + i * 2.1;
        const wr = 22 + Math.sin(wa * 0.7) * 8;
        ctx.fillStyle = `rgba(180,220,255,${0.15 + Math.sin(wa) * 0.08})`;
        ctx.beginPath(); ctx.arc(mx + Math.cos(wa) * wr, my + Math.sin(wa) * wr, 3, 0, Math.PI * 2); ctx.fill();
      }
      // mother label
      if (game.mother.msgTimer > 200) {
        ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.font = "bold 10px 'Cinzel', serif"; ctx.textAlign = "center";
        ctx.fillText("MOTHER", mx, my - 26);
        ctx.textAlign = "start";
      }

      // wall portal effect
      const portal = game._portal;
      if (portal && portal.t > 0) {
        const pp = 1 - portal.t / 60;
        const pw = 8 + pp * 24;
        const ph = 30 + pp * 20;
        ctx.save();
        ctx.translate(portal.x, portal.y);
        ctx.rotate(portal.angle);
        ctx.fillStyle = `rgba(100,200,255,${pp * 0.3})`;
        ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
        ctx.strokeStyle = `rgba(100,200,255,${pp * 0.6})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(-pw / 2, -ph / 2, pw, ph);
        for (let i = 0; i < 4; i++) {
          const pa = i * Math.PI / 2 + portal.t * 0.1;
          const pr2 = pw / 2 + 4 + Math.sin(pa * 2) * 6;
          ctx.fillStyle = `rgba(150,220,255,${pp * 0.4})`;
          ctx.beginPath(); ctx.arc(Math.cos(pa) * pr2, Math.sin(pa) * pr2, 3, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
        portal.t--;
      }

      for (const p of particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.max);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (const t of game.texts) t.draw();

      if (game.joy.active) {
        const jx = game.joy.screenX, jy = game.joy.screenY;
        ctx.beginPath(); ctx.arc(jx, jy, 50, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,216,107,0.6)"; ctx.lineWidth = 3; ctx.stroke();
        ctx.beginPath(); ctx.arc(jx + game.joy.dir.x * 50, jy + game.joy.dir.y * 50, 24, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,216,107,0.5)"; ctx.fill();
        ctx.strokeStyle = "#ffd86b"; ctx.lineWidth = 2; ctx.stroke();
      }

      // sun/moon tracker (bottom center)
      const trackerY = H() - 18;
      const tw = Math.min(200, W() * 0.35);
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(W() / 2 - tw / 2, trackerY - 3, tw, 6);
      for (let i = 0; i < tw; i++) {
        const t = i / tw;
        const dayVal = Math.sin(t * Math.PI * 2 - Math.PI / 2);
        const b = 0.4 + dayVal * 0.6;
        ctx.fillStyle = `rgb(${Math.round(60 + 180 * b)},${Math.round(80 + 150 * b)},${Math.round(120 + 120 * b)})`;
        ctx.fillRect(W() / 2 - tw / 2 + i, trackerY - 2, 1, 4);
      }
      const sunX = W() / 2 - tw / 2 + ((game.dayTime % 1200) / 1200) * tw;
      ctx.fillStyle = game.dayTime < 600 ? "#ffd86b" : "#c0c8d0";
      ctx.beginPath(); ctx.arc(sunX, trackerY, 5, 0, Math.PI * 2); ctx.fill();
      const phaseLabel = game.dayTime < 300 ? "DAWN" : game.dayTime < 600 ? "DAY" : game.dayTime < 900 ? "DUSK" : "NIGHT";
      ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "8px 'Cinzel', serif"; ctx.textAlign = "center";
      // minimap (top-right corner)
      const mmSize = 120;
      const mmX = W() - mmSize - 8;
      const mmY = 8;
      const mmScale = Math.min(mmSize / W() * 0.85, mmSize / H() * 0.85);
      const mmOffX = (mmSize - W() * mmScale) / 2;
      const mmOffY = (mmSize - H() * mmScale) / 2;
      ctx.fillStyle = "rgba(10,10,25,0.75)";
      ctx.beginPath(); ctx.roundRect(mmX, mmY, mmSize, mmSize, 6); ctx.fill();
      ctx.strokeStyle = "rgba(255,216,107,0.3)"; ctx.lineWidth = 1; ctx.stroke();
      const mm = (wx: number, wy: number) => ({ x: mmX + mmOffX + wx * mmScale, y: mmY + mmOffY + wy * mmScale });
      if (game.castle) {
        const cp = mm(game.castle.x, game.castle.y);
        ctx.fillStyle = "#ffd86b";
        ctx.beginPath(); ctx.arc(cp.x, cp.y, 3, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(255,216,107,0.15)";
        ctx.beginPath(); ctx.arc(cp.x, cp.y, 3 + Math.sin(frame * 0.06) * 0.8, 0, Math.PI * 2); ctx.stroke();
      }
      {
        const pp = mm(game.player.x, game.player.y);
        ctx.fillStyle = game.player.powerType === "viking" ? "#8a1a1a" : "#5aa6ff";
        ctx.beginPath(); ctx.arc(pp.x, pp.y, game.player.powerType === "viking" ? 3.5 : 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(90,166,255,0.2)";
        ctx.beginPath(); ctx.arc(pp.x, pp.y, 4 + Math.sin(frame * 0.08) * 1.2, 0, Math.PI * 2); ctx.stroke();
      }
      for (const e of game.enemies) {
        if (!e.alive) continue;
        const ep = mm(e.x, e.y);
        if (e.type === "blackDragon") {
          ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(ep.x, ep.y, 4, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = `rgba(255,0,0,${0.3 + Math.sin(frame * 0.1) * 0.2})`; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(ep.x, ep.y, 6, 0, Math.PI * 2); ctx.stroke();
        } else if (e.type === "dragon") {
          ctx.fillStyle = "#c04040"; ctx.beginPath(); ctx.arc(ep.x, ep.y, 2.5, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "rgba(192,64,64,0.2)"; ctx.beginPath(); ctx.arc(ep.x, ep.y, 4.5 + Math.sin(frame * 0.05) * 0.5, 0, Math.PI * 2); ctx.stroke();
        } else if (e.type === "boss") {
          ctx.fillStyle = "#ff5252"; ctx.beginPath(); ctx.arc(ep.x, ep.y, 2, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.fillStyle = "#ff6b6b"; ctx.beginPath(); ctx.arc(ep.x, ep.y, 1.2, 0, Math.PI * 2); ctx.fill();
        }
      }
      for (const c of game.coins) {
        if (c.collected) continue;
        const cp2 = mm(c.x, c.y);
        ctx.fillStyle = "#ffd86b"; ctx.beginPath(); ctx.arc(cp2.x, cp2.y, 0.8, 0, Math.PI * 2); ctx.fill();
      }
      for (const ch of game.chests) {
        if (ch.collected) continue;
        const chp = mm(ch.x, ch.y);
        ctx.fillStyle = "#ff8a20"; ctx.beginPath(); ctx.arc(chp.x, chp.y, 2, 0, Math.PI * 2); ctx.fill();
      }
      for (const pu of game.powerups) {
        if (pu.collected) continue;
        const pup = mm(pu.x, pu.y);
        const cols: any = { speed: "#ffd86b", damage: "#ff5252", shield: "#52aaff", viking: "#8a1a1a" };
        ctx.fillStyle = cols[pu.type] || "#fff"; ctx.beginPath(); ctx.arc(pup.x, pup.y, 1.8 + Math.sin(frame * 0.08) * 0.3, 0, Math.PI * 2); ctx.fill();
      }
      for (const o of game.skillOrbs) {
        if (o.collected) continue;
        const sop = mm(o.x, o.y);
        ctx.fillStyle = "#a060ff"; ctx.beginPath(); ctx.arc(sop.x, sop.y, 2 + Math.sin(frame * 0.12) * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(160,96,255,0.25)"; ctx.beginPath(); ctx.arc(sop.x, sop.y, 4, 0, Math.PI * 2); ctx.stroke();
      }
      for (const p of game.pads) {
        const pp2 = mm(p.x, p.y);
        ctx.fillStyle = p.state === "tower" ? "#5aa6ff" : "#8a8a7a";
        ctx.fillRect(pp2.x - 1.5, pp2.y - 1.5, 3, 3);
      }

      // TOWER HOVER INFO — when mouse is near a tower, show stats
      if (!game.showAdmin) {
        const mWx = game.mouseX + game.camX, mWy = game.mouseY + game.camY;
        for (const p of game.pads) {
          if (p.state === "tower" && dist({ x: mWx, y: mWy }, p) < 40) {
            const tiX = W() / 2 - 120, tiY = H() / 2 - 60;
            ctx.fillStyle = "rgba(0,0,0,0.8)";
            ctx.beginPath(); ctx.roundRect(tiX, tiY, 240, 80, 8); ctx.fill();
            ctx.strokeStyle = "rgba(90,166,255,0.5)"; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.roundRect(tiX, tiY, 240, 80, 8); ctx.stroke();
            ctx.fillStyle = "#5aa6ff"; ctx.font = "bold 11px 'Cinzel', serif"; ctx.textAlign = "center";
            const icons: Record<string, string> = { arrow: "🏹", cannon: "💥", magic: "🔮", sniper: "🎯" };
            ctx.fillText(`${icons[p.towerType] || ""} ${p.towerType.toUpperCase()} TOWER`, tiX + 120, tiY + 18);
            ctx.font = "9px 'Cinzel', serif"; ctx.fillStyle = "#ddd";
            ctx.fillText(`ATK: ${p.atk + p.bonusAtk}  RNG: ${p.range + p.bonusRange}  SPD: ${Math.round(60 / p.atkRate)}/s`, tiX + 120, tiY + 36);
            ctx.fillStyle = "#ffd86b";
            ctx.fillText(`Type ${p.towerType.toUpperCase()}`, tiX + 120, tiY + 52);
            ctx.fillStyle = "#8af"; ctx.font = "7px 'Cinzel', serif";
            ctx.fillText(`[Click to cycle tower type]`, tiX + 120, tiY + 68);
            ctx.textAlign = "start";
            break;
          }
        }
      }

      // STATS PANEL (Tab key)
      if (game.showStats) {
        const spX = 8, spY = 100, spW = 200, spH = 180;
        ctx.fillStyle = "rgba(0,0,0,0.8)";
        ctx.beginPath(); ctx.roundRect(spX, spY, spW, spH, 8); ctx.fill();
        ctx.strokeStyle = "rgba(90,166,255,0.5)"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(spX, spY, spW, spH, 8); ctx.stroke();
        ctx.fillStyle = "#5aa6ff"; ctx.font = "bold 11px 'Cinzel', serif"; ctx.textAlign = "start";
        ctx.fillText("📊 STATISTICS", spX + 10, spY + 16);
        const s = game.stats;
        const lines = [
          `👹 Enemies Killed: ${s.kills}`,
          `🐉 Dragons Slain: ${s.dragonsSlain}`,
          `💰 Gold Earned: ${s.goldEarned}`,
          `⚔ Damage Dealt: ${s.damageDealt}`,
          `🌊 Waves Completed: ${s.wavesCompleted}`,
          `🏰 Towers Built: ${s.towersBuilt}`,
          `🔵 Soldiers Alive: ${game.soldiers.length}`,
          `🔴 Red Castle: ${game.redCastle && game.redCastle.alive ? "🟢 ALIVE" : "💀 DESTROYED"}`,
        ];
        ctx.font = "8px 'Cinzel', serif"; ctx.fillStyle = "#ccc";
        for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i], spX + 10, spY + 36 + i * 16);
        ctx.fillStyle = "#888"; ctx.font = "7px 'Cinzel', serif";
        ctx.fillText("[Tab] close", spX + spW - 50, spY + spH - 6);
      }

      // COMBAT LOG (C key)
      if (game.showCombat && game.combatLog.length > 0) {
        const clX = W() - 210, clY = 100, clW = 200, clH = Math.min(300, 30 + game.combatLog.length * 16);
        ctx.fillStyle = "rgba(0,0,0,0.8)";
        ctx.beginPath(); ctx.roundRect(clX, clY, clW, clH, 8); ctx.fill();
        ctx.strokeStyle = "rgba(255,216,107,0.4)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.roundRect(clX, clY, clW, clH, 8); ctx.stroke();
        ctx.fillStyle = "#ffd86b"; ctx.font = "bold 10px 'Cinzel', serif"; ctx.textAlign = "start";
        ctx.fillText("📜 COMBAT LOG", clX + 10, clY + 14);
        ctx.font = "8px 'Cinzel', serif";
        for (let i = 0; i < Math.min(game.combatLog.length, 16); i++) {
          const entry = game.combatLog[i];
          const age = frame - entry.frame;
          const alpha = Math.max(0.3, 1 - age / 600);
          ctx.globalAlpha = alpha;
          ctx.fillStyle = entry.color;
          ctx.fillText(entry.text, clX + 10, clY + 34 + i * 16);
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#888"; ctx.font = "7px 'Cinzel', serif";
        ctx.fillText("[C] close", clX + clW - 50, clY + clH - 6);
      }

      if (game.gameOver) {
        ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(0, 0, W(), H());
        ctx.fillStyle = "#ffd86b"; ctx.font = "bold 48px 'Cinzel', serif";
        ctx.textAlign = "center";
        ctx.fillText("KINGDOM FALLEN", W() / 2, H() / 2 - 40);
        ctx.font = "16px 'Cinzel', serif"; ctx.fillStyle = "#fff";
        ctx.fillText(`Survived ${game.wave - 1} waves`, W() / 2, H() / 2 + 6);
        ctx.font = "12px 'Cinzel', serif"; ctx.fillStyle = "#aaa";
        const s2 = game.stats;
        ctx.fillText(`Kills: ${s2.kills} · Dragons: ${s2.dragonsSlain} · Gold: ${s2.goldEarned} · Dmg: ${s2.damageDealt}`, W() / 2, H() / 2 + 30);
        ctx.font = "14px 'Cinzel', serif"; ctx.fillStyle = "#ffd86b";
        ctx.fillText(`Tap to restart`, W() / 2, H() / 2 + 60);
        ctx.textAlign = "start";
      }

      // admin panel (bigger, smoother)
      if (game.showAdmin) {
        const ax = game.adminAX || W() / 2 - 180;
        const ay = game.adminAY || H() / 2 - 160;
        const aw = 360, ah = 380;
        game.adminAX = ax; game.adminAY = ay;
        // semi-transparent backdrop — clicking outside closes admin
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fillRect(0, 0, W(), H());
        // panel body
        ctx.fillStyle = "rgba(10,10,25,0.95)";
        ctx.beginPath(); ctx.roundRect(ax, ay, aw, ah, 12); ctx.fill();
        ctx.strokeStyle = "#ffd86b"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(ax, ay, aw, ah, 12); ctx.stroke();
        ctx.fillStyle = "#ffd86b"; ctx.font = "bold 18px 'Cinzel', serif";
        ctx.textAlign = "center";
        ctx.fillText("⚙ ADMIN ⚙", ax + aw / 2, ay + 26);
        ctx.fillStyle = "#888"; ctx.font = "11px 'Cinzel', serif";
        ctx.fillText("click outside to close · drag header", ax + aw / 2, ay + 42);
        ctx.textAlign = "start";
        // tabs
        const tabs = ["⚔TWRS", "💰ECON", "👹ENMY", "🧑PLYR", "🤖MOM", "⚙SYS"];
        const tabW = aw / tabs.length;
        for (let i = 0; i < tabs.length; i++) {
          ctx.fillStyle = i === game.adminTab ? "#ffd86b" : "rgba(255,216,107,0.2)";
          ctx.beginPath(); ctx.roundRect(ax + i * tabW + 2, ay + 48, tabW - 4, 24, 4); ctx.fill();
          ctx.fillStyle = i === game.adminTab ? "#0d1f3d" : "#ddd";
          ctx.font = "bold 11px 'Cinzel', serif"; ctx.textAlign = "center";
          ctx.fillText(tabs[i], ax + i * tabW + tabW / 2, ay + 64);
          ctx.textAlign = "start";
        }

        // define tab content
        interface Item { label: string; key: string; type: "slider" | "check"; min?: number; max?: number; step?: number }
        const tabsContent: Record<number, Item[]> = {
          0: [
            { label: "Tower ATK", key: "towerAtkMult", type: "slider", min: 0.1, max: 3, step: 0.1 },
            { label: "Tower Range", key: "towerRangeMult", type: "slider", min: 0.1, max: 3, step: 0.1 },
          ],
          1: [
            { label: "Gold Multiplier", key: "goldMult", type: "slider", min: 0.1, max: 5, step: 0.1 },
            { label: "Wall Cost", key: "_wallCost", type: "slider", min: 5, max: 100, step: 5 },
            { label: "Garrison Cost", key: "_garrisonCost", type: "slider", min: 10, max: 100, step: 5 },
          ],
          2: [
            { label: "Enemy HP", key: "enemyHpMult", type: "slider", min: 0.1, max: 3, step: 0.1 },
            { label: "Spawn Rate", key: "spawnRateMult", type: "slider", min: 0.2, max: 3, step: 0.2 },
            { label: "Wave Base", key: "_waveBase", type: "slider", min: 2, max: 20, step: 1 },
          ],
          3: [
            { label: "Player DMG", key: "dmgMult", type: "slider", min: 0.1, max: 3, step: 0.1 },
            { label: "Castle HP", key: "castleHpMult", type: "slider", min: 0.1, max: 3, step: 0.1 },
            { label: "Max Soldiers", key: "_maxSoldiers", type: "slider", min: 2, max: 20, step: 1 },
          ],
          4: [
            { label: "Mother Enabled", key: "motherEnabled", type: "check" },
            { label: "Tip Frequency", key: "motherTipFreq", type: "slider", min: 0.2, max: 3, step: 0.2 },
            { label: "Auto Post on Wave", key: "autoPostOnWave", type: "check" },
            { label: "Show Soldier UI", key: "showSoldierUI", type: "check" },
            { label: "Night Campfires", key: "nightCampfires", type: "check" },
          ],
          5: [
            { label: "3D Walls", key: "wall3d", type: "check" },
            { label: "Drag Speed", key: "_dragSpeed", type: "slider", min: 0.5, max: 3, step: 0.5 },
          ],
        };
        const items = tabsContent[game.adminTab] || [];
        const rowH = 48;
        const startY = ay + 80;
        const scrollH = ah - 110;
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const ry = startY + i * rowH;
          if (ry + rowH > ay + ah) break;
          ctx.fillStyle = "#eee"; ctx.font = "bold 12px 'Cinzel', serif";
          ctx.fillText(item.label, ax + 12, ry + 16);
          if (item.type === "check") {
            const val = (game as any)[item.key];
            const cbx = ax + aw - 36;
            ctx.strokeStyle = "#ffd86b"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.roundRect(cbx, ry, 20, 20, 4); ctx.stroke();
            if (val) {
              ctx.fillStyle = "#ffd86b";
              ctx.font = "14px serif"; ctx.textAlign = "center";
              ctx.fillText("✓", cbx + 10, ry + 16);
        ctx.textAlign = "start";
      }

      // Income display (top center)
      const incomeRate = 1 + game.pads.filter(p => p.state === "tower").length * 0.5 + game.castle.level * 0.3;
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath(); ctx.roundRect(W() / 2 - 100, 46, 200, 16, 4); ctx.fill();
      ctx.fillStyle = "#ffd86b"; ctx.font = "bold 8px 'Cinzel', serif"; ctx.textAlign = "center";
      ctx.fillText(`💰 ${game.gold}g  📈 +${incomeRate.toFixed(1)}g/s  🌊 Wave ${game.wave}`, W() / 2, 58);
      ctx.textAlign = "start";

      // Enemy count breakdown (below income)
      const typeCounts: Record<string, number> = {};
      for (const e of game.enemies) { if (e.alive) typeCounts[e.type] = (typeCounts[e.type] || 0) + 1; }
      if (Object.keys(typeCounts).length > 0) {
        const typeY = 66;
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath(); ctx.roundRect(W() / 2 - 80, typeY, 160, 16, 4); ctx.fill();
        ctx.font = "7px 'Cinzel', serif"; ctx.fillStyle = "#ccc"; ctx.textAlign = "center";
        let tx = W() / 2 - 70, line = "";
        const labels: Record<string, string> = { imp: "👿", brute: "💪", boss: "💀", ghost: "👻", dragon: "🐉", blackDragon: "🐲" };
        for (const [t, c] of Object.entries(typeCounts)) {
          line += `${labels[t] || t}${c} `;
        }
        ctx.fillText(line, W() / 2, typeY + 11);
        ctx.textAlign = "start";
      }
          } else if (item.type === "slider") {
            const val = (game as any)[item.key] ?? 1;
            const valMin = item.min!;
            const valMax = item.max!;
            const pct = Math.max(0, Math.min(1, (val - valMin) / (valMax - valMin)));
            const sx1 = ax + 12, sw = aw - 80;
            ctx.fillStyle = "rgba(255,255,255,0.12)";
            ctx.beginPath(); ctx.roundRect(sx1, ry + 22, sw, 12, 6); ctx.fill();
            ctx.fillStyle = `rgba(255,216,107,${0.4 + pct * 0.4})`;
            ctx.beginPath(); ctx.roundRect(sx1, ry + 22, sw * pct, 12, 6); ctx.fill();
            ctx.fillStyle = "#ffd86b";
            ctx.beginPath(); ctx.arc(sx1 + sw * pct, ry + 28, 7, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = "#0d1f3d"; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(sx1 + sw * pct, ry + 28, 7, 0, Math.PI * 2); ctx.stroke();
            ctx.fillStyle = "#fff"; ctx.textAlign = "right";
            ctx.font = "bold 11px 'Cinzel', serif";
            ctx.fillText(String(val), ax + aw - 14, ry + 16);
            ctx.textAlign = "start";
          }
        }
      }

      ctx.restore();
    }

    function loop() {
      update(); draw(); frame++;
      raf = requestAnimationFrame(loop);
    }

    const onCanvasMouseDown = (e: MouseEvent) => {
      if (game.gameOver) { init(); return; }
      const rect = canvas.getBoundingClientRect();
      const smx = e.clientX - rect.left, smy = e.clientY - rect.top; // screen coords
      const wx = smx + game.camX, wy = smy + game.camY; // world coords

      // tower type change click (world coords)
      if (!game.showAdmin) {
        for (const p of game.pads) {
          if (p.state === "tower" && dist({ x: wx, y: wy }, p) < 28) {
            const types: TowerType[] = ["arrow", "cannon", "magic", "sniper"];
            const idx = types.indexOf(p.towerType);
            p.towerType = types[(idx + 1) % types.length];
            p.applyTowerType();
            notify(`🔧 ${p.towerType.toUpperCase()}`, "#cfe9ff");
            addBurst(p.x, p.y, "#cfe9ff", 6);
            return;
          }
        }
      }

      if (!game.showAdmin) return;
      const ax = game.adminAX || W() / 2 - 180, ay = game.adminAY || H() / 2 - 160;
      const aw = 360, ah = 380;

      // click outside → close (screen coords)
      if (smx < ax || smx > ax + aw || smy < ay || smy > ay + ah) {
        game.showAdmin = false;
        return;
      }

      // drag from header (screen coords)
      if (smy > ay && smy < ay + 46) {
        game.adminDrag = true;
        game.adminDragOffX = smx - ax;
        game.adminDragOffY = smy - ay;
        return;
      }

      // tab click (screen coords)
      if (smy > ay + 48 && smy < ay + 72) {
        const tabs = ["⚔TWRS", "💰ECON", "👹ENMY", "🧑PLYR", "🤖MOM", "⚙SYS"];
        const tabW = aw / tabs.length;
        game.adminTab = Math.floor((smx - ax) / tabW);
        return;
      }

      // slider/check interaction
      const itemData: { label: string; key: string; type: string; min?: number; max?: number; step?: number }[][] = [
        [{ label: "Tower ATK", key: "towerAtkMult", type: "slider", min: 0.1, max: 3, step: 0.1 },
         { label: "Tower Range", key: "towerRangeMult", type: "slider", min: 0.1, max: 3, step: 0.1 }],
        [{ label: "Gold Multiplier", key: "goldMult", type: "slider", min: 0.1, max: 5, step: 0.1 },
         { label: "Wall Cost", key: "_wallCost", type: "slider", min: 5, max: 100, step: 5 },
         { label: "Garrison Cost", key: "_garrisonCost", type: "slider", min: 10, max: 100, step: 5 }],
        [{ label: "Enemy HP", key: "enemyHpMult", type: "slider", min: 0.1, max: 3, step: 0.1 },
         { label: "Spawn Rate", key: "spawnRateMult", type: "slider", min: 0.2, max: 3, step: 0.2 },
         { label: "Wave Base", key: "_waveBase", type: "slider", min: 2, max: 20, step: 1 }],
        [{ label: "Player DMG", key: "dmgMult", type: "slider", min: 0.1, max: 3, step: 0.1 },
         { label: "Castle HP", key: "castleHpMult", type: "slider", min: 0.1, max: 3, step: 0.1 },
         { label: "Max Soldiers", key: "_maxSoldiers", type: "slider", min: 2, max: 20, step: 1 }],
        [{ label: "Mother Enabled", key: "motherEnabled", type: "check" },
         { label: "Tip Frequency", key: "motherTipFreq", type: "slider", min: 0.2, max: 3, step: 0.2 },
         { label: "Auto Post on Wave", key: "autoPostOnWave", type: "check" },
         { label: "Show Soldier UI", key: "showSoldierUI", type: "check" },
         { label: "Night Campfires", key: "nightCampfires", type: "check" }],
        [{ label: "3D Walls", key: "wall3d", type: "check" },
         { label: "Drag Speed", key: "_dragSpeed", type: "slider", min: 0.5, max: 3, step: 0.5 }],
      ];
      const items = itemData[game.adminTab] || [];
      const startY = ay + 80;
      const rowH = 48;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const ry = startY + i * rowH;
        if (item.type === "check") {
          if (smx > ax + aw - 40 && smx < ax + aw - 12 && smy > ry && smy < ry + 24) {
            (game as any)[item.key] = !(game as any)[item.key];
            notify(`${item.label}: ${(game as any)[item.key] ? "ON" : "OFF"}`);
            return;
          }
        } else if (item.type === "slider") {
          const sx1 = ax + 12, sw = aw - 80;
          if (smx > sx1 && smx < sx1 + sw && smy > ry + 22 && smy < ry + 34) {
            game._sliderDragKey = item.key;
            game._sliderDragMin = item.min!;
            game._sliderDragMax = item.max!;
            game._sliderDragStep = item.step!;
            game._sliderDragX = smx;
            updateSliderValue(smx, sx1, sw, item);
            return;
          }
        }
      }
    };

    const onCanvasMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const smx = e.clientX - rect.left;
      game.mouseX = smx; game.mouseY = e.clientY - rect.top;
      if (game.adminDrag) {
        game.adminAX = smx - game.adminDragOffX;
        game.adminAY = e.clientY - rect.top - game.adminDragOffY;
        return;
      }
      if (game._sliderDragKey) {
        const ax = game.adminAX || W() / 2 - 180, ay = game.adminAY || H() / 2 - 160;
        const aw = 360;
        const sx = ax + 12, sw = aw - 80;
        const items: any[] = [];
        const allItems = [
          [{ key: "towerAtkMult", min: 0.1, max: 3, step: 0.1 }, { key: "towerRangeMult", min: 0.1, max: 3, step: 0.1 }],
          [{ key: "goldMult", min: 0.1, max: 5, step: 0.1 }, { key: "_wallCost", min: 5, max: 100, step: 5 }, { key: "_garrisonCost", min: 10, max: 100, step: 5 }],
          [{ key: "enemyHpMult", min: 0.1, max: 3, step: 0.1 }, { key: "spawnRateMult", min: 0.2, max: 3, step: 0.2 }, { key: "_waveBase", min: 2, max: 20, step: 1 }],
          [{ key: "dmgMult", min: 0.1, max: 3, step: 0.1 }, { key: "castleHpMult", min: 0.1, max: 3, step: 0.1 }, { key: "_maxSoldiers", min: 2, max: 20, step: 1 }],
          [{ key: "motherEnabled", type: "check" }, { key: "motherTipFreq", min: 0.2, max: 3, step: 0.2 }, { key: "autoPostOnWave", type: "check" }, { key: "showSoldierUI", type: "check" }, { key: "nightCampfires", type: "check" }],
          [{ key: "wall3d", type: "check" }, { key: "_dragSpeed", min: 0.5, max: 3, step: 0.5 }],
        ];
        for (const tab of allItems) {
          for (const item of tab) {
            if (item.key === game._sliderDragKey) {
              updateSliderValue(smx, sx, sw, item);
              return;
            }
          }
        }
      }
    };

    const onCanvasMouseUp = () => {
      game.adminDrag = false;
      game._sliderDragKey = null;
    };

    function updateSliderValue(mx: number, sx: number, sw: number, item: any) {
      const pct = Math.max(0, Math.min(1, (mx - sx) / sw));
      const val = item.min + pct * (item.max - item.min);
      const stepped = Math.round(val / item.step) * item.step;
      (game as any)[item.key] = Math.max(item.min, Math.min(item.max, stepped));
    }

    canvas.addEventListener("mousedown", onCanvasMouseDown);
    canvas.addEventListener("mousemove", onCanvasMouseMove);
    canvas.addEventListener("mouseup", onCanvasMouseUp);

    init(); loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("mousedown", onCanvasMouseDown);
      canvas.removeEventListener("mousemove", onCanvasMouseMove);
      canvas.removeEventListener("mouseup", onCanvasMouseUp);
    };
  }, []);

  return (
    <div className="kg-root">
      <div className="kg-stage">
        <canvas ref={canvasRef} className="kg-canvas" />

        <div className="kg-hud-top">
          <div className="kg-badge kg-wave">
            <span className="kg-badge-label">WAVE</span>
            <span ref={waveRef} className="kg-badge-value">1</span>
          </div>
          <div className="kg-base-hp">
            <div className="kg-base-hp-label">⚔ KINGDOM ⚔</div>
            <div className="kg-base-hp-bar"><div ref={hpRef} className="kg-base-hp-fill" /></div>
            <div className="kg-army"><span ref={armyRef}>0/5</span> ARMY</div>
          </div>
          <div className="kg-badge kg-gold">
            <span className="kg-coin-icon">◉</span>
            <span ref={goldRef} className="kg-badge-value">0</span>
          </div>
        </div>

        <div ref={hintRef} className="kg-hint">WASD/arrows move · Space dash · [P] post order · Stand on castle to upgrade</div>
      </div>
    </div>
  );
}
