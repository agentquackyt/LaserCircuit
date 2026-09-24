export abstract class View {
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

    getElement(): HTMLElement {
        return this.element;
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


abstract class Builder<T extends HTMLElement> {
    protected element: T;

    constructor(element: T) {
        this.element = element;
    }

    setClass(...additionalClasses: string[]): this {
        for (const cls of additionalClasses) {
            this.element.classList.add(cls);
        }
        return this;
    }

    addDataAttribute(key: string, value: string): this {
        this.element.dataset[key] = value;
        return this;
    }

    addStyle(style: Partial<CSSStyleDeclaration>): this {
        Object.assign(this.element.style, style);
        return this;
    }

    addCSSVariable(key: string, value: string): this {
        this.element.style.setProperty(key, value);
        return this;
    }

    build(): T {
        return this.element;
    }
}

export class ButtonBuilder extends Builder<HTMLButtonElement> {

    constructor() {
        super(document.createElement("button"));
    }

    setText(text: string): ButtonBuilder {
        this.element.textContent = text;
        return this;
    }

    setBold(flavour?: ButtonFlavour): ButtonBuilder {
        this.element.classList.add("btn-bold");
        if(flavour !== undefined) {
            switch(flavour) {
                case ButtonFlavour.PRIMARY:
                    this.element.classList.add("btn-primary");
                    break;
                case ButtonFlavour.SECONDARY:
                    this.element.classList.add("btn-secondary");
                    break;
                case ButtonFlavour.TERTIARY:
                    this.element.classList.add("btn-tertiary");
                    break;
                case ButtonFlavour.BASIC:
                    this.element.classList.add("btn-basic");
                    break;
                case ButtonFlavour.ERROR:
                    this.element.classList.add("btn-danger");
                    break;
            }
        }
        return this;
    }

    setOnClick(callback: () => void): ButtonBuilder {
        this.element.addEventListener("click", callback);
        return this;
    }
}

export class ContainerBuilder extends Builder<HTMLDivElement> {
    constructor() {
        super(document.createElement("div"));
    }

    setFlex(direction: "row" | "column", gap: number): ContainerBuilder {
        this.element.classList.add("flex", direction, `gap-${gap}`);
        return this;
    }

    appendChild(child: HTMLElement): ContainerBuilder {
        this.element.appendChild(child);
        return this;
    }
}

export enum TextType {
    TEXT,
    HEADER,
    SUBHEADER,
    NOTICE
}

export class TextBuilder extends Builder<HTMLElement> {

    constructor(type: TextType = TextType.TEXT) {
        switch (type) {
            case TextType.TEXT:
                super(document.createElement("p"));
                break;
            case TextType.HEADER:
                super(document.createElement("h2"));
                break;
            case TextType.SUBHEADER:
                super(document.createElement("h3"));
                break;
            case TextType.NOTICE:
                super(document.createElement("span"));
                this.element.classList.add("notice");
                break;
        }
    }

    setText(text: string): TextBuilder {
        this.element.textContent = text;
        return this;
    }
}