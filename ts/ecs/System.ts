import type { World } from "./Engine";
import type { Entity } from "./Entity";

abstract class System {
    /** Injected by World.addTickSystem / addEntitySystem. */
    world!: World;
}

/** Runs every game frame — use for movement, market ticks, and animation. */
abstract class TickSystem extends System {
    abstract update(dt: number): void;
}

/**
 * Runs when an entity is added to or removed from the world.
 * Useful for maintaining derived indexes or reacting to spawning/despawning.
 */
abstract class EntitySystem extends System {
    abstract onEntityAdded(entity: Entity): void;
    abstract onEntityRemoved(entity: Entity): void;
}

/**
 * Triggered by discrete game events rather than the game loop.
 * Call handle() directly — e.g. on a trade action, diplomacy event, or UI input.
 * Assign .world manually before calling handle() if this system is not registered
 * with the world via addTickSystem/addEntitySystem.
 */
abstract class EventSystem<TEvent = unknown> extends System {
    abstract handle(event: TEvent, entity?: Entity): void;
}

/** Handles serialisation — fired explicitly by the save/load manager. */
abstract class SavegameIOSystem extends EventSystem<"save" | "load"> {}

export { System, TickSystem, EntitySystem, EventSystem, SavegameIOSystem };
