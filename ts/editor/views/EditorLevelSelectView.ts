import { ButtonBuilder, ButtonFlavour, ContainerBuilder, View } from "../../utils/View";
import type { UserLevelDraft } from "../CommunityLevelTypes";

export class LevelSelectView extends View {
    constructor(data?: any, levels: UserLevelDraft[] = []) {
        const view = new ContainerBuilder().setClass("editor-level-select", "column");
        const header = new ContainerBuilder().setClass("editor-level-select-header", "column");
        const title = document.createElement("h2");
        const username = data?.user_metadata?.full_name || data?.email?.split("@")[0] || "friend";
        title.textContent = `Welcome back, @${username}!`;
        header.appendChild(title);
        const subtitle = document.createElement("p");
        subtitle.textContent = "Create, refine, and publish your community levels.";
        header.appendChild(subtitle);
        view.appendChild(header.build());

        const newLevelBtn = new ButtonBuilder()
            .setText("Create New Level")
            .setBold(ButtonFlavour.BASIC)
            .setOnClick(() => {this.invokeTrigger("levelSelected", "new")})
            .build();
        const actions = new ContainerBuilder().setClass("editor-level-select-actions", "row");
        actions.appendChild(newLevelBtn);
        const backButton = new ButtonBuilder()
            .setText("Back to Menu")
            .setBold(ButtonFlavour.BASIC)
            .setOnClick(() => {this.invokeTrigger("back")})
            .build();
        actions.appendChild(backButton);
        view.appendChild(actions.build());

        const results = new ContainerBuilder().setClass("editor-level-results");
        for (const level of levels) {
            if (!level.id) continue;
            const updated = level.updatedAt
                ? `Updated ${new Date(level.updatedAt).toLocaleDateString()}`
                : "Not saved yet";
            const status = level.published ? "Published" : "Draft";
            const levelBtn = new ButtonBuilder()
                .setBold(level.published ? ButtonFlavour.SECONDARY : ButtonFlavour.BASIC)
                .setClass("editor-level-card")
                .addDataAttribute("levelId", level.id)
                .setOnClick(() => {this.invokeTrigger("levelSelected", level.id)})
                .build();
            const levelTitle = document.createElement("strong");
            levelTitle.textContent = level.title;
            const metadata = document.createElement("small");
            metadata.textContent = `${status} | ${level.document.grid?.width ?? 0} x ${level.document.grid?.height ?? 0} grid | ${updated}`;
            levelBtn.append(levelTitle, metadata);
            results.appendChild(levelBtn);
        }

        if (levels.length === 0) {
            const empty = document.createElement("p");
            empty.className = "editor-level-empty";
            empty.textContent = "You have not created any levels yet.";
            results.appendChild(empty);
        }
        view.appendChild(results.build());
        super(view.build());
    }
}