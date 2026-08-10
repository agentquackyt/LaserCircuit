
const RANDOM_CHARACTERS = "$$0123456789";


async function animateText(element: HTMLElement, text: string, durationInMilliseconds: number = 800, audioElement?: HTMLAudioElement) {
    element.textContent = "";
    const delay = durationInMilliseconds / text.length;
    const delayForRandomCharacters = 45; // Delay for showing random characters
    // start playing sound effect if enabled
    if (audioElement) {
        audioElement.loop = true;
        await audioElement.play().catch(() => {});
    }

    for (let i = 0; i < text.length; i++) {
        if (text[i] === " ") {
            element.textContent = element.textContent + text[i];
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
        }

        const randomCharCount = 2; // Number of random characters to show
        for (let j = 0; j < randomCharCount; j++) {
            const randomChar = RANDOM_CHARACTERS[Math.floor(Math.random() * RANDOM_CHARACTERS.length)];
            element.textContent = element.textContent + randomChar;
            await new Promise(resolve => setTimeout(resolve, delayForRandomCharacters));
            element.textContent = element.textContent.slice(0, -1); // Remove the last random character
        }

        // Add the actual character
        element.textContent = element.textContent + text[i];
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0; // Reset audio to the beginning
    }
    return Promise.resolve();
}

export { animateText };