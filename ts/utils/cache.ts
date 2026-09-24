interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

const memoryStore = new Map<string, CacheEntry<any>>();

export class Cache {
    private static readonly TTL_MS = 15 * 60 * 1000; // 15 minutes

    static get<T>(key: string): T | null {
        const fullKey = `sb_cache_${key}`;
        const now = Date.now();

        // 1. Try LocalStorage
        try {
            const raw = localStorage.getItem(fullKey);
            if (raw) {
                const entry: CacheEntry<T> = JSON.parse(raw);
                if (entry.expiresAt > now) {
                    return entry.data;
                }
                localStorage.removeItem(fullKey); // expired
            }
        } catch (_e) {
            // LocalStorage disabled or JSON parse failed; fall back to memory
        }

        // 2. Try In-Memory Store
        const memEntry = memoryStore.get(fullKey);
        if (memEntry) {
            if (memEntry.expiresAt > now) {
                return memEntry.data as T;
            }
            memoryStore.delete(fullKey);
        }

        return null;
    }

    static set<T>(key: string, data: T, customTtlMs = Cache.TTL_MS): void {
        const fullKey = `sb_cache_${key}`;
        const entry: CacheEntry<T> = {
            data,
            expiresAt: Date.now() + customTtlMs,
        };

        // Save to in-memory store
        memoryStore.set(fullKey, entry);

        // Save to LocalStorage
        try {
            localStorage.setItem(fullKey, JSON.stringify(entry));
        } catch (_e) {
            // Storage quota exceeded or disabled
        }
    }

    static clear(key?: string): void {
        if (key) {
            const fullKey = `sb_cache_${key}`;
            memoryStore.delete(fullKey);
            try { localStorage.removeItem(fullKey); } catch (_e) { }
        } else {
            memoryStore.clear();
            try {
                Object.keys(localStorage)
                    .filter((k) => k.startsWith("sb_cache_"))
                    .forEach((k) => localStorage.removeItem(k));
            } catch (_e) { }
        }
    }
}