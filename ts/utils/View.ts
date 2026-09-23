export class View {
    private element: HTMLElement;
    private triggers: { [key: string]: (data: any) => void } = {};

    constructor(element: HTMLElement) {
        this.element = element;
    }

    show() {
        this.element.classList.remove("hidden");
    }

    hide() {
        this.element.classList.add("hidden");
    }

    addTrigger(trigger: string, callback: (data: any) => void) {
        this.triggers[trigger] = callback;
    }

    attachTo(parent: HTMLElement) {
        parent.appendChild(this.element);
    }

    detach() {
        if (this.element.parentElement) {
            this.element.parentElement.removeChild(this.element);
        }
    }

    protected invokeTrigger(trigger: string, data?: any) {
        if (this.triggers[trigger]) {
            this.triggers[trigger](data);
        }
    }
}

export enum ButtonFlavour {
    PRIMARY,
    SECONDARY,
    TERTIARY,
    BASIC,
    ERROR
}

export class ButtonBuilder {
    private button: HTMLButtonElement;

    constructor() {
        this.button = document.createElement("button");
    }

    setText(text: string): ButtonBuilder {
        this.button.textContent = text;
        return this;
    }

    setClass(...additionalClasses: string[]): ButtonBuilder {
        for (const cls of additionalClasses) {
            this.button.classList.add(cls);
        }
        return this;
    }

    addDataAttribute(key: string, value: string): ButtonBuilder {
        this.button.dataset[key] = value;
        return this;
    }

    setBold(flavour?: ButtonFlavour): ButtonBuilder {
        this.button.classList.add("btn-bold");
        if(flavour !== undefined) {
            switch(flavour) {
                case ButtonFlavour.PRIMARY:
                    this.button.classList.add("btn-primary");
                    break;
                case ButtonFlavour.SECONDARY:
                    this.button.classList.add("btn-secondary");
                    break;
                case ButtonFlavour.TERTIARY:
                    this.button.classList.add("btn-tertiary");
                    break;
                case ButtonFlavour.BASIC:
                    this.button.classList.add("btn-basic");
                    break;
                case ButtonFlavour.ERROR:
                    this.button.classList.add("btn-danger");
                    break;
            }
        }
        return this;
    }

    setOnClick(callback: () => void): ButtonBuilder {
        this.button.addEventListener("click", callback);
        return this;
    }

    build(): HTMLButtonElement {
        return this.button;
    }
}

export class ContainerBuilder {
    private container: HTMLDivElement;

    constructor() {
        this.container = document.createElement("div");
    }

    setFlex(direction: "row" | "column", gap: number): ContainerBuilder {
        this.container.classList.add("flex", direction, `gap-${gap}`);
        return this;
    }

    setClass(className: string, ...additionalClasses: string[]): ContainerBuilder {
        this.container.className = className;
        for (const cls of additionalClasses) {
            this.container.classList.add(cls);
        }
        return this;
    }

    appendChild(child: HTMLElement): ContainerBuilder {
        this.container.appendChild(child);
        return this;
    }

    addStyle(style: Partial<CSSStyleDeclaration>): ContainerBuilder {
        Object.assign(this.container.style, style);
        return this;
    }

    build(): HTMLDivElement {
        return this.container;
    }
}