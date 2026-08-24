import { EntitySystem } from "../ecs/System";
import { Entity } from "../ecs/Entity";
import { EventComponent } from "./components";

/** Generic level loader system.
 *  Loads ./level/list.json for available levels and ./level/<id>.json for level data.
 *  The type `T` represents the structure of a level file and is intentionally generic.
 */
export class LevelSystem<T = unknown> extends EntitySystem {
    public list: Array<{ id: string; title?: string; [k: string]: any }> = [];
    public currentLevelId?: string;
    public currentLevel?: T;

    private storageKey = "laser.last_level";

    constructor() {
        super();
    }

    async loadList(): Promise<Array<{ id: string; title?: string }>> {
        try {
            const res = await fetch("./level/list.json");
            if (!res.ok) throw new Error("Failed to load level list");
            const json = await res.json();
            this.list = Array.isArray(json) ? json : [];
            return this.list;
        } catch (e) {
            console.warn("LevelSystem: could not load list.json", e);
            this.list = [];
            return this.list;
        }
    }

    async loadLevel(id: string): Promise<T | undefined> {
        try {
            const res = await fetch(`./level/${id}.json`);
            if (!res.ok) throw new Error(`Failed to load level ${id}`);
            const json = await res.json();
            this.currentLevelId = id;
            this.currentLevel = json as T;
            try { localStorage.setItem(this.storageKey, id); } catch (_e) {}
            // Emit a world entity announcing the level was loaded
            if (this.world) {
                const e = new Entity();
                e.addComponent(new EventComponent("level:loaded", { id, data: this.currentLevel }));
                this.world.addEntity(e);
            }
            return this.currentLevel;
        } catch (e) {
            console.warn("LevelSystem: loadLevel failed", e);
            return undefined;
        }
    }

    onEntityAdded(entity: Entity): void {
        const ev = entity.getComponent(EventComponent);
        if (!ev) return;
        if (ev.type === "ui:load-level") {
            const levelId = ev.payload?.levelId;
            if (levelId) this.loadLevel(levelId);
        }
    }

    onEntityRemoved(_entity: Entity): void {
        // no-op
    }

    private getLastLevel(): string | null {
        try { return localStorage.getItem(this.storageKey); } catch (_e) { return null; }
    }
}

export default LevelSystem;