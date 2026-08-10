/**
 * All sound identifiers used in the game.
 * Add a matching entry to SOUND_MANIFEST when adding a new key.
 */
export type SoundId =
   // | "ui_click"
   // | "ui_hover"
   // | "ship_depart"
   // | "ship_arrive"
   // | "market_buy"
   // | "market_sell"
    | "Deus_Maris";       // intro cinematic

/** Maps every SoundId to its URL, relative to the document root. */
const SOUND_MANIFEST: Record<SoundId, string> = {
    // ui_click:    "/audio/ui_click.ogg",
    // ui_hover:    "/audio/ui_hover.ogg",
    // ship_depart: "/audio/ship_depart.ogg",
    // ship_arrive: "/audio/ship_arrive.ogg",
    // market_buy:  "/audio/market_buy.ogg",
    // market_sell: "/audio/market_sell.ogg",
    Deus_Maris:  "./assets/sounds/Deus_Maris_Variation.mp3",
};

/**
 * Central audio manager — singleton, independent of ECS.
 * Uses HTMLAudioElement for maximum browser compatibility.
 *
 * Usage:
 *   1. After a user gesture, call `await AudioManager.getInstance().preloadAll()`.
 *   2. Call `AudioManager.getInstance().play("Deus_Maris")` anywhere.
 */
export class AudioManager {
    private static _instance: AudioManager | null = null;

    private readonly _elements = new Map<SoundId, HTMLAudioElement>();
    private _masterVolume = 1.0;

    private constructor() {}

    static getInstance(): AudioManager {
        return (AudioManager._instance ??= new AudioManager());
    }

    /**
     * Create and preload (canplaythrough) every audio element in the manifest.
     * Missing or unsupported files are logged as warnings and skipped.
     * Must be called after a user gesture.
     */
    async preloadAll(): Promise<void> {
        const entries = Object.entries(SOUND_MANIFEST) as [SoundId, string][];
        await Promise.all(entries.map(([id, url]) => this._preloadOne(id, url)));
    }

    private _preloadOne(id: SoundId, url: string): Promise<void> {
        return new Promise((resolve) => {
            const el = new Audio(url);
            el.preload = "auto";
            el.volume = this._masterVolume;

            // Register the element immediately so play() can use it even if
            // the canplaythrough event hasn't fired yet (browser will buffer on demand).
            this._elements.set(id, el);

            const cleanup = (): void => {
                el.removeEventListener("canplaythrough", onReady);
                el.removeEventListener("error", onError);
            };

            const onReady = (): void => { cleanup(); resolve(); };

            const onError = (): void => {
                cleanup();
                // Keep the element in the map — playback may still succeed at runtime.
                console.warn(
                    `[AudioManager] Preload error for "${id}" (${url}):`,
                    el.error?.message ?? "unknown",
                );
                resolve(); // non-fatal
            };

            el.addEventListener("canplaythrough", onReady, { once: true });
            el.addEventListener("error", onError, { once: true });
            el.load();
        });
    }

    /**
     * Play a preloaded sound.  Silently no-ops if the element isn't ready.
     * @param id      Key from SoundId.
     * @param volume  Per-play volume multiplier (0–1). Defaults to 1.
     */
    play(id: SoundId, volume = 1.0): void {
        const el = this._elements.get(id);
        if (!el) return;

        // Reset so the sound can be replayed immediately
        el.currentTime = 0;
        el.volume = Math.max(0, Math.min(1, this._masterVolume * volume));
        el.play().catch((err) => {
            console.warn(`[AudioManager] play("${id}") failed:`, err);
        });
    }

    stop(id: SoundId): void {
        const el = this._elements.get(id);
        if (!el) return;

        el.pause();
        el.currentTime = 0;
    }

    /** @param value 0–1 */
    setMasterVolume(value: number): void {
        this._masterVolume = Math.max(0, Math.min(1, value));
        for (const el of this._elements.values()) {
            el.volume = this._masterVolume;
        }
    }

    get masterVolume(): number {
        return this._masterVolume;
    }

    /** Whether a given sound has been preloaded and is ready to play. */
    isLoaded(id: SoundId): boolean {
        return this._elements.has(id);
    }
}
