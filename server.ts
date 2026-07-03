import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import http from "http";
import https from "https";

async function httpGetWithRedirects(
  urlStr: string,
  customHeaders: Record<string, string> = {},
  redirectCount = 0
): Promise<{
  statusCode: number;
  statusMessage: string;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
}> {
  if (redirectCount > 5) {
    throw new Error("Too many redirects");
  }

  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(urlStr);
      const client = urlObj.protocol === "https:" ? https : http;
      
      const options = {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
          "Accept": "*/*",
          ...customHeaders
        }
      };

      const req = client.request(urlStr, options, (res) => {
        if (res.statusCode && [301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, urlStr).href;
          resolve(httpGetWithRedirects(redirectUrl, customHeaders, redirectCount + 1));
          return;
        }

        const chunks: Buffer[] = [];
        res.on("data", (chunk) => {
          chunks.push(chunk);
        });
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode || 200,
            statusMessage: res.statusMessage || "OK",
            headers: res.headers,
            body: Buffer.concat(chunks)
          });
        });
      });

      req.on("error", (err) => {
        reject(err);
      });

      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

interface StreamState {
  url: string;
  title: string;
  status: "playing" | "paused" | "stopped";
  updatedAt: number;
}

let streamState: StreamState = {
  url: "http://84.17.50.102/fox/index.m3u8", // Default live stream
  title: "FIFA WORLD CUP 2026 Live",
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

      // Fetch the target stream asset using our robust redirect-following HTTP module client
      const response = await httpGetWithRedirects(parsedTargetUrl.href);

      if (response.statusCode >= 400) {
        return res.status(response.statusCode).send(`Failed to fetch: ${response.statusMessage}`);
      }

      const contentType = (response.headers["content-type"] as string) || "";
      
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
        (contentType.includes("application/octet-stream") && targetUrl.endsWith(".m3u8"));

      if (isM3U8) {
        const text = response.body.toString("utf8");
        const lines = text.split(/\r?\n/);
        
        const rewrittenLines = lines.map(line => {
          const trimmed = line.trim();
          if (!trimmed) return line;

          // 1. Rewrite tag lines that contain URIs (e.g., encryption keys or audio tracks)
          if (trimmed.startsWith("#")) {
            return trimmed.replace(/(URI=")([^"]+)(")/g, (match, p1, p2, p3) => {
              const absoluteUrl = resolveUrl(p2, parentUrl, parsedTargetUrl.search);
              return `${p1}/api/proxy?url=${encodeURIComponent(absoluteUrl)}${p3}`;
            });
          }

          // 2. Rewrite normal segment/sub-playlist URLs
          const absoluteUrl = resolveUrl(trimmed, parentUrl, parsedTargetUrl.search);
          return `/api/proxy?url=${encodeURIComponent(absoluteUrl)}`;
        });

        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        return res.send(rewrittenLines.join("\n"));
      } else {
        // It's a binary segment (.ts, .aac, .mp4, encryption key, etc.)
        res.setHeader("Content-Type", contentType || "video/MP2T");
        return res.send(response.body);
      }
    } catch (error: any) {
      console.error("Proxy failure for url:", targetUrl, error);
      return res.status(500).send(`Stream Proxy failed: ${error.message}`);
    }
  });

  // Helper helper to resolve relative URLs with query param preservation
  function resolveUrl(urlStr: string, baseUrlStr: string, originalSearch: string = ""): string {
    try {
      const resolved = new URL(urlStr, baseUrlStr);
      // Forward the original query string if the child resource doesn't have its own
      if (originalSearch && !resolved.search) {
        resolved.search = originalSearch;
      }
      return resolved.href;
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
