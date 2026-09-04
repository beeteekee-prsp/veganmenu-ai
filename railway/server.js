import express from "express";
import cors from "cors";
import { Readable } from "node:stream";

const app = express();
const PORT = process.env.PORT || 3000;

// ─── CORS ─────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  process.env.ALLOWED_ORIGIN,           // Railway環境変数で指定
  "https://vegan-menu-ai.netlify.app",  // 本番Netlify
  "http://localhost:5173",              // Vite開発サーバー
  "http://localhost:3000",
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // origin未定義（curl等）またはALLOWED_ORIGINSに含まれる場合は許可
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      console.warn("[CORS] Blocked origin:", origin);
      callback(new Error("CORS: origin not allowed"));
    }
  },
  methods: ["POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
}));

app.use(express.json());

// ─── Anthropic JSON Schema ─────────────────────────────────────
const MENU_SCHEMA = {
  type: "object",
  properties: {
    menus: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name:        { type: "string" },
          concept:     { type: "string" },
          ingredients: { type: "array", items: { type: "string" } },
          recipe:      { type: "array", items: { type: "string" } },
          price:       { type: "string" },
          veganPoint:  { type: "string" },
        },
        required: ["name", "concept", "ingredients", "recipe", "price", "veganPoint"],
        additionalProperties: false,
      },
    },
  },
  required: ["menus"],
  additionalProperties: false,
};

// ─── ヘルスチェック ────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "VeganMenu AI API is running" });
});

// ─── POST /api/generate ────────────────────────────────────────
app.post("/api/generate", async (req, res) => {
  const body = req.body;
  if (!body || !body.messages) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  console.log("[generate] Calling Anthropic API...");

  let anthropicRes;
  try {
    anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        ...body,
        stream: true,
        output_config: {
          format: {
            type: "json_schema",
            schema: MENU_SCHEMA,
          },
        },
      }),
    });
  } catch (err) {
    console.error("[generate] Fetch to Anthropic failed:", err.message);
    return res.status(502).json({ error: "Failed to connect to Anthropic API" });
  }

  console.log("[generate] Anthropic response.status:", anthropicRes.status);

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text();
    console.error("[generate] Anthropic error:", errText.slice(0, 300));
    return res.status(anthropicRes.status).send(errText);
  }

  // ─── SSEヘッダーをセット ───────────────────────────────────
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // ─── Web ReadableStream → Node.js Readable → Expressレスポンス
  let chunkCount = 0;
  let totalBytes = 0;

  console.log("[generate] Stream start - piping to client");

  const nodeStream = Readable.fromWeb(anthropicRes.body);

  nodeStream.on("data", (chunk) => {
    chunkCount++;
    totalBytes += chunk.length;
    if (chunkCount % 10 === 0) {
      console.log(`[generate] chunks: ${chunkCount}, totalBytes: ${totalBytes}`);
    }
  });

  nodeStream.on("end", () => {
    console.log(`[generate] Stream ended normally. Total chunks: ${chunkCount}, totalBytes: ${totalBytes}`);
    res.end();
  });

  nodeStream.on("error", (err) => {
    console.error("[generate] Stream error:", err.message);
    res.end();
  });

  // クライアントが接続を切った場合
  req.on("close", () => {
    console.log("[generate] Client disconnected");
    nodeStream.destroy();
  });

  nodeStream.pipe(res);
});

// ─── サーバー起動 ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[server] VeganMenu AI API running on port ${PORT}`);
  console.log(`[server] Allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);
});
