import { supabase } from "../database/supabase";
import { CommonUI } from "../utils/CommonUI";
import { LevelSelectView } from "./views/EditorLevelSelectView";
import { CommunityLevelRepository } from "./CommunityLevelRepository";
import { createEmptyLevel } from "./CommunityLevelTypes";
import { EditorSuiteView } from "./views/EditorSuiteView";
import type { UserLevelDraft } from "./CommunityLevelTypes";

export class CommunityLevelEditor {
    private static instance: CommunityLevelEditor;

    currentLevel: any;
    private _isPlaying: boolean = false;
    private _isEditing: boolean = false;
    private _isNewLevel: boolean = true;
    private _userData: any;

    private _targetScreen: HTMLElement;
    private _levelSelectView?: LevelSelectView;
    private _editorSuiteView?: EditorSuiteView;
    private readonly _repository = new CommunityLevelRepository();

    private constructor() {
        this._targetScreen = document.querySelector("#editor-screen") as HTMLElement;
    }

    public static getInstance(): CommunityLevelEditor {
        if (!CommunityLevelEditor.instance) {
            CommunityLevelEditor.instance = new CommunityLevelEditor();
        }
        return CommunityLevelEditor.instance;
    }

    public async load() {
        const { data, error } = await supabase.auth.getUser();

        this._userData = data?.user;

        // Load the community level editor
        console.log("Loading community level editor...");
        CommonUI.setSubtitle("Community Level Editor");
        if (error || !this._userData?.id) {
            CommonUI.pushNotification("You must be signed in to manage community levels.", "error");
            return;
        }
        let levels: UserLevelDraft[] = [];
        try {
            levels = await this._repository.listOwnedLevels(this._userData.id);
        } catch (loadError) {
            console.error("Error loading owned community levels:", loadError);
            // CommonUI.pushNotification("Your community levels could not be loaded.", "error");
        }
        this._editorSuiteView?.detach();
        this._levelSelectView?.detach();
        const levelSelectView = new LevelSelectView(this._userData, levels);
        this._levelSelectView = levelSelectView;
        levelSelectView.addTrigger("levelSelected", (levelId: string) => {
            this.loadLevel(levelId);
        });
        levelSelectView.addTrigger("back", () => this.backToMenu());
        levelSelectView.attachTo(this._targetScreen);
    }

    private backToMenu(): void {
        this._levelSelectView?.detach();
        this._editorSuiteView?.detach();
        this._targetScreen.classList.add("hidden");
        document.querySelector("#title-screen")?.classList.remove("hidden");
    }

    private async loadLevel(levelId: string) {
        if (!this._userData?.id) return;
        try {
            const level = levelId === "new"
                ? createEmptyLevel(this._userData.id)
                : await this._repository.getLevel(levelId, this._userData.id);
            this._levelSelectView?.detach();
            this.currentLevel = level;
            this._isNewLevel = level.id === null;
            this._isEditing = true;
            this._editorSuiteView?.detach();
            this._editorSuiteView = new EditorSuiteView(level, this._repository);
            this._editorSuiteView.addTrigger("back", () => this.load());
            this._editorSuiteView.attachTo(this._targetScreen);
        } catch (error) {
            console.error("Error loading community level:", error);
            CommonUI.pushNotification("The level could not be loaded. Check your access and try again.", "error");
        }
    }
}
