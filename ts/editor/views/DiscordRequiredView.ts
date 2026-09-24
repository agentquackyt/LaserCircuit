import { supabase } from "../../database/supabase";
import { ButtonBuilder, ButtonFlavour, ContainerBuilder, View } from "../../utils/View";

export class DiscordRequiredView extends View {
    constructor(path: string) {
        const view = new ContainerBuilder()
            .setFlex("column", 1)
            .addStyle({
                justifyContent: "center",
                alignItems: "center",
                maxWidth: "500px",
                alignSelf: "center",
                gap: ".5rem",
                height: "100%",
                margin: "auto",
                padding: ".5rem"
            })



        const header = document.createElement("h2");
        header.textContent = "Discord Login Required";
        header.style.fontWeight = "bold";

        view.appendChild(header);

        const message = document.createElement("p");
        message.textContent = "You need to log in with Discord to access the community level editor. This is required to ensure that all levels are associated with a valid user account.";
        message.style.textAlign = "center";
        message.style.fontSize = "1.3rem";
        view.appendChild(message);

        const message2 = document.createElement("p");
        message2.textContent = "If you don't want to log in with Discord, you can still play the game and play levels by other players.";
        message2.style.textAlign = "center";
        message2.style.fontSize = "1.3rem";
        message2.style.marginBottom = "1.5rem";
        view.appendChild(message2);

        const redirectUrl = new URL(window.location.origin);
        if (path) {
            redirectUrl.searchParams.set('from', path);
        }
        console.log('Sending redirectTo:', redirectUrl.toString());

        const brandDiscordBtn = new ButtonBuilder()
            .setClass("btn-discord", "large", "w-full")
            .setBold() // adds .btn-bold without flavor, using --variant-background from .btn-discord
            .setText("Continue with Discord")
            .setOnClick(async () => {
                const { data, error } = await supabase.auth.signInWithOAuth({
                    provider: 'discord',
                    options: {
                        redirectTo: redirectUrl.toString(), // Returns the user back to your SPA
                        scopes: 'identify email',   // 'identify' is default; add more if needed
                    },
                });
            })
            .build();

        const backToHomeBtn = new ButtonBuilder()
            .setClass("large", "w-full")
            .setBold(ButtonFlavour.BASIC)
            .setText("Back to Home")
            .setOnClick(() => {
                window.location.href = "/";
            })
            .build();

        view.appendChild(brandDiscordBtn);
        view.appendChild(backToHomeBtn);
        super(view.build());
    }

}