import { Entity, type ComponentClass } from "./Entity";
import type { TickSystem, EntitySystem } from "./System";

class World {
    readonly id: string = crypto.randomUUID();
    private readonly _entities = new Map<string, Entity>();
    private readonly _tickSystems: TickSystem[] = [];
    private readonly _entitySystems: EntitySystem[] = [];

    addEntity(entity: Entity): this {
        this._entities.set(entity.id, entity);
        for (const sys of this._entitySystems) sys.onEntityAdded(entity);
        return this;
    }

    removeEntity(entity: Entity): this {
        if (this._entities.delete(entity.id)) {
            for (const sys of this._entitySystems) sys.onEntityRemoved(entity);
        }
        return this;
    }

    getEntityById(id: string): Entity | undefined {
        return this._entities.get(id);
    }

    /** Returns all entities that possess every listed component type. */
    query(...types: ComponentClass[]): Entity[] {
        return [...this._entities.values()].filter(e => e.hasAll(...types));
    }

    addTickSystem(system: TickSystem): this {
        system.world = this;
        this._tickSystems.push(system);
        return this;
    }

    addEntitySystem(system: EntitySystem): this {
        system.world = this;
        this._entitySystems.push(system);
        return this;
    }

    /** Called each frame by the Engine. */
    tick(dt: number): void {
        for (const sys of this._tickSystems) sys.update(dt);
    }
}

class Engine {
    private static _instance: Engine | null = null;
    private readonly _world: World = new World();
    private _lastTime: number = 0;
    private _rafHandle: number = 0;
    private _running: boolean = false;

    private constructor() {}

    static getInstance(): Engine {
        if (!Engine._instance) Engine._instance = new Engine();
        return Engine._instance;
    }

    get world(): World {
        return this._world;
    }

    start(): void {
        if (this._running) return;
        this._running = true;
        this._lastTime = performance.now();
        this._rafHandle = requestAnimationFrame(this._loop.bind(this));
    }

    stop(): void {
        this._running = false;
        cancelAnimationFrame(this._rafHandle);
    }

    private _loop(timestamp: number): void {
        const dt = (timestamp - this._lastTime) / 1000; // seconds
        this._lastTime = timestamp;
        this._world.tick(dt);
        if (this._running) {
            this._rafHandle = requestAnimationFrame(this._loop.bind(this));
        }
    }
}

export { Engine, World };
