import { Component } from "../ecs/Entity";

/** Generic event component used to represent UI/canvas/input events. */
export class EventComponent extends Component {
    constructor(public type: string, public payload: any = {}) { super(); }
}

/** Marker component for UI events (buttons, DOM controls). */
export class UIEventComponent extends Component {
    constructor(public elementId?: string) { super(); }
}

/** Marker component for canvas events. */
export class CanvasEventComponent extends Component {
    constructor(public canvasX?: number, public canvasY?: number) { super(); }
}

/** Score component emitted when an entity grants points. */
export class ScoreComponent extends Component {
    constructor(public value: number, public player?: string) { super(); }
}

export { };
