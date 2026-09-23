import { ButtonBuilder, ButtonFlavour, ContainerBuilder, View } from "../../utils/View";
import type { UserLevelDraft } from "../CommunityLevelTypes";

export class LevelSelectView extends View {
    constructor(data?: any, levels: UserLevelDraft[] = []) {

        const section_1 = new ContainerBuilder()
            .setFlex("column", 1)
            .addStyle({
                justifyContent: "center",
                alignItems: "center",
                alignSelf: "center",
                gap: ".5rem",
                height: "100%",
                margin: "auto"
            });

        const header = document.createElement("h2");
        console.log("User data:", data);
        const username = data?.user_metadata?.full_name || data?.email?.split("@")[0] || "friend";

        header.textContent = `Welcome back, @${username}!`;
        section_1.appendChild(header);

        const section_2 = new ContainerBuilder().setFlex("column", 1);

        const newLevelBtn = new ButtonBuilder()
            .setText("Create New Level")
            .setBold(ButtonFlavour.BASIC)
            .setOnClick(() => {this.invokeTrigger("levelSelected", "new")})
            .build();

        section_2.appendChild(newLevelBtn);
        for (const level of levels) {
            if (!level.id) continue;
            const levelBtn = new ButtonBuilder()
                .setText(level.title)
                .setBold(ButtonFlavour.PRIMARY)
                .addDataAttribute("levelId", level.id)
                .setOnClick(() => {this.invokeTrigger("levelSelected", level.id)})
                .build();
            section_2.appendChild(levelBtn);
        }

        const view = document.createElement("div");
        view.appendChild(section_1.build());
        view.appendChild(section_2.build());
        view.className = "w-full gap-1 column";
        super(view);
    }
}