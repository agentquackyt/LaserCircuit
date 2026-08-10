
/** Constructor function usable as a type token for a component class. */
type ComponentClass<T extends Component = Component> = new (...args: any[]) => T;

abstract class Component {}

class Entity {
    readonly id: string = crypto.randomUUID();
    private readonly _components = new Map<string, Component>();

    addComponent<T extends Component>(component: T): this {
        this._components.set(component.constructor.name, component);
        return this;
    }

    removeComponent<T extends Component>(type: ComponentClass<T>): this {
        this._components.delete(type.name);
        return this;
    }

    getComponent<T extends Component>(type: ComponentClass<T>): T | undefined {
        return this._components.get(type.name) as T | undefined;
    }

    hasComponent<T extends Component>(type: ComponentClass<T>): boolean {
        return this._components.has(type.name);
    }

    hasAll(...types: ComponentClass[]): boolean {
        return types.every(t => this._components.has(t.name));
    }
}

export { Entity, Component, type ComponentClass };
