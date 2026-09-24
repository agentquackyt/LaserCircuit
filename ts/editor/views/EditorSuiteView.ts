import { ButtonBuilder, ButtonFlavour, ContainerBuilder, View } from "../../utils/View";
import type { CommunityLevelRepository } from "../CommunityLevelRepository";
import { validateUserLevel, type UserLevelDraft } from "../CommunityLevelTypes";
import { EditorGameView, type EditorTool, type PieceOrientation } from "./EditorGameView";
import { LIGHT_COLOR_HEX, LIGHT_COLORS, type Direction, type LightColor } from "../../utils/LaserLogic";

const TOOLS: Array<{ name: EditorTool; label: string; shortcut: string }> = [
    { name: "select", label: "Select", shortcut: "1" },
    { name: "erase", label: "Erase", shortcut: "2" },
    { name: "obstacle", label: "Obstacle", shortcut: "3" },
    { name: "emitter", label: "Emitter", shortcut: "4" },
    { name: "target", label: "Target", shortcut: "5" },
    { name: "mirror", label: "Mirror", shortcut: "6" },
    { name: "splitter", label: "Splitter", shortcut: "7" }
];

export class EditorSuiteView extends View {
    private level: UserLevelDraft;
    private readonly repository: CommunityLevelRepository;
    private readonly status: HTMLElement;
    private readonly validation: HTMLElement;
    private readonly board: EditorGameView;
    private saveTimer?: ReturnType<typeof setTimeout>;
    private activeColor: LightColor = "red";
    private orientationSelect?: HTMLSelectElement;

    constructor(level: UserLevelDraft, repository: CommunityLevelRepository) {
        const root = new ContainerBuilder().setClass("community-editor-suite", "column").build();
        super(root);
        this.level = level;
        this.repository = repository;

        const header = new ContainerBuilder().setClass("community-editor-header", "row");
        this.status = document.createElement("span");
        this.status.className = "community-editor-status";
        this.status.textContent = "Unsaved changes";
        header.appendChild(this.status);
        const publishButton = new ButtonBuilder()
            .setText(this.level.published ? "Unpublish" : "Publish")
            .setBold(this.level.published ? ButtonFlavour.TERTIARY : ButtonFlavour.PRIMARY)
            .setOnClick(() => {
                this.level.published = !this.level.published;
                publishButton.textContent = this.level.published ? "Unpublish" : "Publish";
                publishButton.className = this.level.published ? "btn-bold btn-tertiary" : "btn-bold btn-primary";
                this.queueSave();
            })
            .build();
        header.appendChild(publishButton);
        header.appendChild(new ButtonBuilder().setText("Save").setBold(ButtonFlavour.PRIMARY).setOnClick(() => this.save()).build());
            const uploadInput = document.createElement("input");
            uploadInput.type = "file";
            uploadInput.accept = ".json,application/json";
            uploadInput.className = "hidden";
            uploadInput.addEventListener("change", () => {
                const file = uploadInput.files?.[0];
                uploadInput.value = "";
                if (file) void this.upload(file);
            });
            root.appendChild(uploadInput);
            header.appendChild(new ButtonBuilder().setText("Upload").setBold(ButtonFlavour.SECONDARY).setOnClick(() => uploadInput.click()).build());
        header.appendChild(new ButtonBuilder().setText("Download").setBold(ButtonFlavour.SECONDARY).setOnClick(() => this.download()).build());
        header.appendChild(new ButtonBuilder().setText("Clear").setBold(ButtonFlavour.ERROR).setOnClick(() => {
            if (window.confirm("Clear all pieces, targets, and emitters?")) this.board.clear();
        }).build());
        header.appendChild(new ButtonBuilder().setText("Back").setBold(ButtonFlavour.BASIC).setOnClick(() => this.invokeTrigger("back")).build());
        root.appendChild(header.build());

        const workspace = new ContainerBuilder().setClass("community-editor-workspace", "row");
        const sidebar = new ContainerBuilder().setClass("community-editor-sidebar", "column");
        sidebar.appendChild(this.buildMetadata().build());
        sidebar.appendChild(this.buildPalette().build());
        sidebar.appendChild(this.buildOptions().build());
        sidebar.appendChild(this.buildRules().build());
        workspace.appendChild(sidebar.build());

        this.board = new EditorGameView(level);
        this.board.addTrigger("changed", (changedLevel: UserLevelDraft) => {
            this.level = changedLevel;
            this.refreshValidation();
            this.queueSave();
        });
        workspace.appendChild(this.board.getElement());
        root.appendChild(workspace.build());

        this.validation = document.createElement("p");
        this.validation.className = "community-editor-validation";
        root.appendChild(this.validation);
        this.refreshValidation();
        window.addEventListener("keydown", (event) => this.handleShortcut(event));
    }

    private buildMetadata(): ContainerBuilder {
        const section = new ContainerBuilder().setClass("community-editor-section", "column");
        const title = document.createElement("h2");
        title.textContent = "Metadata";
        section.appendChild(title);
        const name = this.input("Title", this.level.title, (value) => {
            this.level.title = value;
            this.level.document.title = value;
            this.changed();
        });
        const description = this.input("Description", String(this.level.document.metadata?.description ?? "Direct light beams into targets."), (value) => {
            this.level.document.metadata = { ...this.level.document.metadata, description: value };
            this.changed();
        });
        const width = this.numberInput("Grid Width", this.level.document.grid?.width ?? 9, (value) => this.resizeGrid(value, this.level.document.grid?.height ?? 9));
        const height = this.numberInput("Grid Height", this.level.document.grid?.height ?? 9, (value) => this.resizeGrid(this.level.document.grid?.width ?? 9, value));
        section.appendChild(name);
        section.appendChild(description);
        const dimensions = new ContainerBuilder().setClass("community-editor-dimensions", "row");
        dimensions.appendChild(width);
        dimensions.appendChild(height);
        section.appendChild(dimensions.build());
        return section;
    }

    private buildPalette(): ContainerBuilder {
        const section = new ContainerBuilder().setClass("community-editor-section", "column");
        const title = document.createElement("h2");
        title.textContent = "Tool Palette";
        section.appendChild(title);
        const palette = new ContainerBuilder().setClass("community-editor-palette");
        for (const tool of TOOLS) {
            palette.appendChild(
                new ButtonBuilder()
                    .setText(`${tool.shortcut} ${tool.label}`)
                    .setClass("community-editor-tool")
                    .addDataAttribute("tool", tool.name)
                    .addDataAttribute("toolActive", tool.name)
                    .setBold(
                        tool.name === "select"
                            ? ButtonFlavour.PRIMARY
                            : ButtonFlavour.BASIC
                    )
                    .setOnClick(() => {
                        this.invokeToolTrigger(tool.name);
                        this.board.setTool(tool.name);
                        if (tool.name === "splitter" && this.orientationSelect) this.orientationSelect.value = "horizontal";
                        if (tool.name === "mirror" && this.orientationSelect) this.orientationSelect.value = "/";
                    }).build());
        }
        section.appendChild(palette.build());
        return section;
    }

    private invokeToolTrigger(tool: EditorTool): void {
        document.querySelectorAll(".community-editor-tool").forEach((button) => {
            button.classList.remove("btn-primary");
            button.classList.add("btn-basic");
        });
        const clickedButton = document.querySelector(`[data-tool="${tool}"]`);
        if (clickedButton) {
            clickedButton.classList.remove("btn-basic");
            clickedButton.classList.add("btn-primary");
        }
    }

    private buildOptions(): ContainerBuilder {
        const section = new ContainerBuilder().setClass("community-editor-section", "column");
        const colorIndicator = new ContainerBuilder()
            .setClass("community-editor-color-indicator", "flex", "row", "w-full", "container-bold")
            .addCSSVariable("--variant-background", LIGHT_COLOR_HEX[this.activeColor])
            .build();
        const labelWrapper = document.createElement("label");
        labelWrapper.textContent = "Active Color";
        labelWrapper.appendChild(colorIndicator);
        section.appendChild(labelWrapper);

        const colors = new ContainerBuilder().setClass("community-editor-colors");
        for (const color of LIGHT_COLORS) {
            const button = new ButtonBuilder()
                .setText("")
                .setClass("community-editor-color")
                .setBold()
                .addCSSVariable("--variant-background", LIGHT_COLOR_HEX[color])
                .addDataAttribute("color", color)
                .setOnClick(() => {
                    this.activeColor = color;
                    this.board.setColor(color);
                    document.querySelector(".community-editor-color-indicator")?.setAttribute("style", `--variant-background: ${LIGHT_COLOR_HEX[color]};`);
                }).build();
            button.style.backgroundColor = LIGHT_COLOR_HEX[color];
            button.title = color;
            colors.appendChild(button);
        }
        section.appendChild(colors.build());
        return section;
    }

    private buildRules(): ContainerBuilder {
        const section = new ContainerBuilder().setClass("community-editor-section", "column");
        const title = document.createElement("h2");
        title.textContent = "Rules";
        section.appendChild(title);
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = this.level.document.rules?.canPlaceOwnBlocks ?? true;
        checkbox.addEventListener("change", () => {
            this.level.document.rules = { ...this.level.document.rules, canPlaceOwnBlocks: checkbox.checked };
            this.changed();
        });
        section.appendChild(this.labeled("Can place own blocks", checkbox));
        return section;
    }

    private input(label: string, value: string, onChange: (value: string) => void): HTMLLabelElement {
        const input = document.createElement("input");
        input.type = "text";
        input.value = value;
        input.addEventListener("input", () => onChange(input.value));
        return this.labeled(label, input);
    }

    private numberInput(label: string, value: number, onChange: (value: number) => void): HTMLLabelElement {
        const input = document.createElement("input");
        input.type = "number";
        input.min = "3";
        input.max = "15";
        input.value = String(value);
        input.addEventListener("change", () => onChange(Math.max(3, Math.min(15, Number(input.value) || 9))));
        return this.labeled(label, input);
    }

    private labeled(label: string, control: HTMLElement): HTMLLabelElement {
        const wrapper = document.createElement("label");
        wrapper.textContent = label;
        wrapper.appendChild(control);
        return wrapper;
    }

    private resizeGrid(width: number, height: number): void {
        this.level.document.grid = { width, height };
        this.level.document.emitters = (this.level.document.emitters ?? []).filter((item) => item.x < width && item.y < height);
        this.level.document.targets = (this.level.document.targets ?? []).filter((item) => item.x < width && item.y < height);
        this.level.document.pieces = (this.level.document.pieces ?? []).filter((item) => item.x < width && item.y < height);
        this.board.setLevel(this.level);
        this.changed();
    }

    private refreshValidation(): void {
        const issues = validateUserLevel(this.level);
        this.validation.textContent = issues.length === 0 ? "Level is ready to publish." : issues.map((issue) => issue.message).join(" ");
    }

    private changed(): void {
        this.refreshValidation();
        this.queueSave();
    }

    private queueSave(): void {
        this.status.textContent = "Saving soon...";
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => this.save(), 700);
    }

    private async save(): Promise<void> {
        this.status.textContent = "Saving...";
        try {
            this.level = await this.repository.saveLevel(this.level);
            this.board.setLevel(this.level);
            this.status.textContent = "Saved";
        } catch (error) {
            console.error("Error saving community level:", error);
            this.status.textContent = "Save failed";
        }
    }

    private download(): void {
        const blob = new Blob([JSON.stringify(this.level.document, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${this.level.document.id ?? "level"}.json`;
        link.click();
        URL.revokeObjectURL(url);
    }

    private async upload(file: File): Promise<void> {
        try {
            const parsed: unknown = JSON.parse(await file.text());
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("The file must contain a level object.");

            const imported = parsed as Record<string, unknown>;
            const title = typeof imported.title === "string" && imported.title.trim()
                ? imported.title
                : this.level.title;
            const grid = imported.grid && typeof imported.grid === "object"
                ? imported.grid as { width?: unknown; height?: unknown }
                : {};

            this.level.title = title;
            this.level.document = {
                ...(imported as UserLevelDraft["document"]),
                title,
                grid: {
                    width: typeof grid.width === "number" ? grid.width : 8,
                    height: typeof grid.height === "number" ? grid.height : 8
                },
                emitters: Array.isArray(imported.emitters) ? imported.emitters as UserLevelDraft["document"]["emitters"] : [],
                targets: Array.isArray(imported.targets) ? imported.targets as UserLevelDraft["document"]["targets"] : [],
                pieces: Array.isArray(imported.pieces) ? imported.pieces as UserLevelDraft["document"]["pieces"] : [],
                rules: imported.rules && typeof imported.rules === "object" ? imported.rules as UserLevelDraft["document"]["rules"] : {},
                metadata: imported.metadata && typeof imported.metadata === "object" ? imported.metadata as Record<string, unknown> : {}
            };
            this.board.setLevel(this.level);
            this.changed();
        } catch (error) {
            console.error("Error uploading level:", error);
            this.status.textContent = "Upload failed";
        }
    }

    private handleShortcut(event: KeyboardEvent): void {
        const target = event.target as HTMLElement | null;
        if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
        if (event.ctrlKey && event.key.toLowerCase() === "s") {
            event.preventDefault();
            void this.save();
            return;
        }
        const tool = TOOLS[Number(event.key) - 1];
        if (tool) {
            this.invokeToolTrigger(tool.name);
            this.board.setTool(tool.name);
        }
        if (event.key.toLowerCase() === "c") {
            this.activeColor = LIGHT_COLORS[(LIGHT_COLORS.indexOf(this.activeColor) + 1) % LIGHT_COLORS.length] ?? "red";
            this.board.setColor(this.activeColor);
        }
        if (event.key.toLowerCase() === "r" || event.key === " ") {
            event.preventDefault();
            this.board.rotateHovered();
        }
        if (event.key === "Delete" || event.key === "Backspace" || event.key.toLowerCase() === "x") this.board.deleteHovered();
    }
}
