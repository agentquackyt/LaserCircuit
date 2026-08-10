import indexHtml from "./index.html";

Bun.serve({
    port: 3000,
    routes: {
        "/": indexHtml,
    },
    async fetch(req, server) {
        const url = new URL(req.url);
        console.log(`[Bun] ${req.method} ${url.pathname}`);
        if (url.pathname.startsWith("/level/")) {
            const levelId = url.pathname.split("/").pop();
            console.log(`[Bun] Fetching level: ${levelId}`);
            if (levelId) {
                const levelPath = `./level/${levelId}`;
                try {
                    const levelData = Bun.file(levelPath).text();
                    return new Response(await levelData, { status: 200, headers: { "Content-Type": "application/json" } });
                } catch (e) {
                    return new Response(JSON.stringify({ error: "Level not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
                }
            }
        }
        return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } });

    },
})