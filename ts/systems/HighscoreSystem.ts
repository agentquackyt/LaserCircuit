import type { Entity } from "../ecs/Entity";
import { EntitySystem } from "../ecs/System";
import { EventComponent } from "./components";

export interface LevelScore {
    time: number;
    moves: number;
}

export class HighscoreSystem extends EntitySystem {
    private static STORAGE_KEY = "laser_circuit_scores";

    override onEntityAdded(entity: Entity): void {
        const ev = entity.getComponent(EventComponent);
        if (!ev) return;

        // Listen for level completion events to save scores automatically
        if (ev.type === "level:completed" || ev.type === "game:level-complete") {
            const { levelId, time, moves } = ev.payload || {};
            if (levelId && typeof time === "number" && typeof moves === "number") {
                HighscoreSystem.saveScore(levelId, time, moves);
            }
        }
    }

    override onEntityRemoved(_entity: Entity): void {
        // no-op
    }

    public update(_deltaTime: number): void {
        // Event-driven; no per-frame updates needed
    }

    public static getScores(): Record<string, LevelScore> {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    }

    public static getScore(levelName: string): LevelScore | null {
        const scores = this.getScores();
        return scores[levelName] || null;
    }

    public static isCompleted(levelName: string): boolean {
        return !!this.getScore(levelName);
    }

    public static saveScore(levelName: string, time: number, moves: number): boolean {
        const scores = this.getScores();
        const existing = scores[levelName];

        if (!existing || time < existing.time) {
            scores[levelName] = { time, moves };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(scores));
            return true;
        }
        return false;
    }

    public static formatScore(timeMs: number, moves: number): string {
        const totalSec = Math.floor(timeMs / 1000);
        const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
        const ss = String(totalSec % 60).padStart(2, "0");
        return `${mm}:${ss}s`;
    }

    constructor() {
        super();
    }
}

export default HighscoreSystem;