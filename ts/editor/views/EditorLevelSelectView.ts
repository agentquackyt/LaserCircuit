import { ButtonBuilder, ButtonFlavour, ContainerBuilder, View } from "../../utils/View";

export class LevelSelectView extends View {
    constructor(data?: any) {

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
        const username = data.user_metadata.full_name || "friend";

        header.textContent = `Welcome back, @${username}!`;
        section_1.appendChild(header);

        const section_2 = new ContainerBuilder().setFlex("column", 1);

        const ownLevel = [{ name: "Level 1", id: "234" }, { name: "Level 2", id: "567" }, { name: "Level 3", id: "890" }];
        const newLevelBtn = new ButtonBuilder()
            .setText("Create New Level")
            .setBold(ButtonFlavour.BASIC)
            .setOnClick(() => {this.invokeTrigger("levelSelected", "new")})
            .build();

        section_2.appendChild(newLevelBtn);
        for (const level of ownLevel) {
            const levelBtn = new ButtonBuilder()
                .setText(level.name)
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