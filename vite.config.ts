import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const GUIDE_JSON_PATH = path.resolve(rootDir, "public/data/guide.json");

function isValidSections(data: unknown): data is Array<Record<string, unknown>> {
  return (
    Array.isArray(data) &&
    data.every(
      (s) =>
        s &&
        typeof s === "object" &&
        typeof (s as Record<string, unknown>).id === "string" &&
        typeof (s as Record<string, unknown>).titleEn === "string" &&
        typeof (s as Record<string, unknown>).titleJa === "string" &&
        typeof (s as Record<string, unknown>).body === "string",
    )
  );
}

// Dev-only: lets editor.html save edits straight to public/data/guide.json.
// This middleware is never present in the production build/preview server.
function guideEditorPlugin(): Plugin {
  return {
    name: "guide-editor",
    configureServer(server) {
      server.middlewares.use("/api/guide", (req, res, next) => {
        if (req.method !== "POST") return next();

        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          try {
            const data: unknown = JSON.parse(body);
            if (!isValidSections(data)) {
              throw new Error("Expected an array of { id, titleEn, titleJa, body } (all strings).");
            }
            const ids = new Set<string>();
            for (const s of data) {
              if (ids.has(s.id as string)) throw new Error(`Duplicate id: ${s.id}`);
              ids.add(s.id as string);
            }
            fs.writeFileSync(GUIDE_JSON_PATH, JSON.stringify(data, null, 2) + "\n");
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true }));
          } catch (err) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, error: (err as Error).message }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [guideEditorPlugin()],
});
