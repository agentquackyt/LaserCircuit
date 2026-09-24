import { DiscordRequiredView } from "../editor/views/DiscordRequiredView";
import { ButtonBuilder, ButtonFlavour, ContainerBuilder } from "./View";

export class CommonUI {

    public static showDiscordRequiredView(targetElement: HTMLElement, path: string) {
        const discordRequiredView = new DiscordRequiredView(path);
        discordRequiredView.attachTo(targetElement);
    }

    public static setTitle(title: string) {
        document.title = title;

        const titleElement = document.querySelector(".g-title") as HTMLElement | null;
        if (titleElement) {
            titleElement.textContent = title;
        }
    }

    public static setSubtitle(subtitle?: string) {
        if (subtitle === undefined) {
            subtitle = "by Jonas Gaden";
        }

        const subtitleElement = document.querySelector(".g-title-subtitle") as HTMLElement | null;
        if (subtitleElement) {
            subtitleElement.textContent = subtitle;
        }
    }

    public static pushNotification(
        message: string,
        type: "info" | "success" | "error" = "info",
        duration?: number
    ): void {
        const dialog = document.createElement("dialog");
        dialog.className = `modal modal-${type}`;

        const title = document.createElement("h2");
        title.textContent = type === "error" ? "Error" : "Notification";

        const content = new ContainerBuilder()
            .setFlex("column", 1)
            .setClass("modal-content")
            .addStyle({
                fontSize: "1.3rem",
                marginBottom: "1rem",
            })
            .build();
        content.textContent = message;
    

        const closeModal = () => {
            if (dialog.open) {
                dialog.close();
            }
            dialog.remove();
        };

        const closeBtn = new ButtonBuilder()
            .setBold(type == "error" ? ButtonFlavour.ERROR : ButtonFlavour.SECONDARY)
            .setText("Understood")
            .setClass("w-full")
            .setOnClick(closeModal)
            .build();

        dialog.addEventListener("cancel", closeModal);

        dialog.appendChild(title);
        dialog.appendChild(content);
        dialog.appendChild(closeBtn);
        document.body.appendChild(dialog);

        dialog.showModal();

        if (duration !== undefined) {
            setTimeout(closeModal, duration);
        }
    }
}