import { supabase } from "../database/supabase";
import { CommonUI } from "../utils/CommonUI";
import { ButtonBuilder, ButtonFlavour, View } from "../utils/View";
import { LevelSelectView } from "./views/EditorLevelSelectView";

export class CommunityLevelEditor {
    private static instance: CommunityLevelEditor;

    currentLevel: any;
    private _isPlaying: boolean = false;
    private _isEditing: boolean = false;
    private _isNewLevel: boolean = true;
    private _userData: any;

    private _targetScreen: HTMLElement;

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
        let levelSelectView = new LevelSelectView(this._userData);
        levelSelectView.addTrigger("levelSelected", (levelId: string) => {
            this.loadLevel(levelId);
        });
        levelSelectView.attachTo(this._targetScreen);
    }

    private async loadLevel(levelId: string) {
        // Load the level data from Supabase

        if (levelId !== "new") {
            const { data, error } = await supabase
                .from('levels')
                .select('*')
                .eq('id', levelId)
                .single();

            if (error) {
                console.error("Error loading level:", error);
                CommonUI.pushNotification("The level could not be loaded. The level might not exist or you might not have permission to view it.", "error");
                return;
            }


            this.currentLevel = data;
            this._isNewLevel = false;
            this._isEditing = true;
        } else {
            const data = {
                id: null,
                name: "New Level",
                owner_id: this._userData?.id,
                data: {}
            };


            this.currentLevel = data;
            this._isNewLevel = true;
            this._isEditing = true;
        }


        // Load the level into the editor
        console.log("Loaded level:", this.currentLevel);
    }
}

