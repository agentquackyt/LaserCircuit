// LEAGACY : DO NOT USE THIS CLASS, IT IS DEPRECATED AND WILL BE REMOVED IN FUTURE VERSIONS


export class UIpatch {
    private static _instance: UIpatch;
    private game: any | null = null;
    private elements: Map<string, HTMLElement> = new Map();
    
    constructor() {
        this.elements.set("g-title", document.querySelector(".g-title") as HTMLElement);
        this.elements.set("g-description", document.querySelector(".g-description") as HTMLElement);
        this.elements.set("g-btn-start", document.querySelector("#g-btn-start") as HTMLElement);
    }

    public static getInstance(): UIpatch {
        if (!UIpatch._instance) {
            UIpatch._instance = new UIpatch();
        }
        return UIpatch._instance;
    }

    public registerMiniGameEngine(engine: any) {
        this.game = engine;
        console.info("[UI Patcher] " + engine.id + " has been registered") 
        this.setup();
    }


    private setup() {
        if (!this.game) return;

        this.elements.get("g-title")!.innerText = this.game.name;
        this.elements.get("g-description")!.innerText = this.game.description;
    }

    private registerEvents() {
        this.elements.get("g-btn-start")!.addEventListener("click", () => {
            if (!this.game) return;
            console.info("[UI Patcher] Starting " + this.game.id);
            this.game.start();
        });
    }
} 