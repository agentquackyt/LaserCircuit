import { EntitySystem } from "../ecs/System";
import type { Entity } from "../ecs/Entity";
import { ScoreComponent } from "./components";

export class HighscoreSystem extends EntitySystem {
    private highscores: Array<{ value: number; when: number }> = [];
    private storageKey = "game_highscores";

    constructor() {
        super();
        this.load();
    }

    onEntityAdded(entity: Entity): void {
        const score = entity.getComponent(ScoreComponent);
        if (!score) return;
        const entry = { value: score.value, when: Date.now() };
        this.highscores.push(entry);
        this.highscores.sort((a, b) => b.value - a.value);
        this.highscores = this.highscores.slice(0, 10);
        this.save();
        console.info("Highscore recorded:", entry);
    }

    onEntityRemoved(_entity: Entity): void {
        // not used
    }

    getHighscores() {
        return this.highscores.slice();
    }

    private load() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return;
            this.highscores = JSON.parse(raw);
        } catch (_e) {
            this.highscores = [];
        }
    }

    private save() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.highscores));
        } catch (_e) {
            // ignore
        }
    }
}

export default HighscoreSystem;
