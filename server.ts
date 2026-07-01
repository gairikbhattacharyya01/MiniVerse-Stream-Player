import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

interface StreamState {
  url: string;
  title: string;
  status: "playing" | "paused" | "stopped";
  updatedAt: number;
}

let streamState: StreamState = {
  url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", // Default test stream
  title: "Mux Big Buck Bunny (Default Test)",
  status: "playing",
  updatedAt: Date.now()
};

let clients: express.Response[] = [];

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON parsing middleware
  app.use(express.json());

  // CORS headers for API endpoints
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Get active stream state
  app.get("/api/stream/state", (req, res) => {
    res.json(streamState);
  });

  // Set active stream state (Admin only, can be secured)
  app.post("/api/stream/set", (req, res) => {
    const { url, title, status } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    streamState = {
      url: url.trim(),
      title: (title || "Untitled Stream").trim(),
      status: status || "playing",
      updatedAt: Date.now()
    };

    // Broadcast update to all SSE clients
    broadcastState();

    res.json({ success: true, state: streamState });
  });

  // Real-time updates via Server-Sent Events (SSE)
  app.get("/api/stream/live", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Content-Encoding", "none");

    // Send the current state immediately on connection
    res.write(`data: ${JSON.stringify(streamState)}\n\n`);

    clients.push(res);

    req.on("close", () => {
      clients = clients.filter(c => c !== res);
    });
  });

  // Proxy endpoint to bypass CORS and Mixed-Content (HTTP to HTTPS) blockers
  app.get("/api/proxy", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).send("Missing target url parameter");
    }

    try {
      const parsedTargetUrl = new URL(targetUrl);
      const parentUrl = parsedTargetUrl.href.substring(0, parsedTargetUrl.href.lastIndexOf("/") + 1);

      // Fetch the target stream asset
      const response = await fetch(parsedTargetUrl.href, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
          "Accept": "*/*",
          "Accept-Language": "en-US,en;q=0.9",
        }
      });

      if (!response.ok) {
        return res.status(response.status).send(`Failed to fetch: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type") || "";
      
      // Set permissive CORS and caching headers for streaming performance
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "*");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");

      // Check if it's an HLS Manifest (.m3u8) or a text format
      const isM3U8 = 
        targetUrl.includes(".m3u8") || 
        contentType.includes("mpegurl") || 
        contentType.includes("application/x-mpegURL") || 
        contentType.includes("vnd.apple.mpegurl") ||
        contentType.includes("application/octet-stream") && targetUrl.endsWith(".m3u8");

      if (isM3U8) {
        const text = await response.text();
        const lines = text.split(/\r?\n/);
        
        const rewrittenLines = lines.map(line => {
          const trimmed = line.trim();
          if (!trimmed) return line;

          // 1. Rewrite tag lines that contain URIs (e.g., encryption keys or audio tracks)
          if (trimmed.startsWith("#")) {
            return trimmed.replace(/(URI=")([^"]+)(")/g, (match, p1, p2, p3) => {
              const absoluteUrl = resolveUrl(p2, parentUrl);
              return `${p1}/api/proxy?url=${encodeURIComponent(absoluteUrl)}${p3}`;
            });
          }

          // 2. Rewrite normal segment/sub-playlist URLs
          const absoluteUrl = resolveUrl(trimmed, parentUrl);
          return `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`;
        });

        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        return res.send(rewrittenLines.join("\n"));
      } else {
        // It's a binary segment (.ts, .aac, .mp4, encryption key, etc.)
        res.setHeader("Content-Type", contentType || "video/MP2T");
        
        // Use native ArrayBuffer chunk-sending to support large data safely
        const arrayBuffer = await response.arrayBuffer();
        return res.send(Buffer.from(arrayBuffer));
      }
    } catch (error: any) {
      console.error("Proxy failure for url:", targetUrl, error);
      return res.status(500).send(`Stream Proxy failed: ${error.message}`);
    }
  });

  // Helper helper to resolve relative URLs
  function resolveUrl(urlStr: string, baseUrlStr: string): string {
    try {
      return new URL(urlStr, baseUrlStr).href;
    } catch {
      return urlStr;
    }
  }

  function broadcastState() {
    clients.forEach(client => {
      try {
        client.write(`data: ${JSON.stringify(streamState)}\n\n`);
      } catch (err) {
        console.error("Failed to write to client, removing client", err);
      }
    });
  }

  // Vite middleware integration for asset serving in Development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite dev middleware active.");
  } else {
    // Serve static files in Production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving production build from dist/");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`MiniVerse Video Player active on http://localhost:${PORT}`);
  });
}

startServer();
