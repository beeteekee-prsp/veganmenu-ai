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
          veganPoint:  { type: "string" }
        },
        required: ["name","concept","ingredients","recipe","price","veganPoint"],
        additionalProperties: false
      }
    }
  },
  required: ["menus"],
  additionalProperties: false
};

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  console.log("[generate] Calling Anthropic API...");

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
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
          schema: MENU_SCHEMA
        }
      }
    }),
  });

  // [LOG 1] Anthropic API response status
  console.log("[generate] Anthropic response.status:", anthropicRes.status);

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text();
    console.log("[generate] Anthropic error body:", errText.slice(0, 300));
    return new Response(errText, {
      status: anthropicRes.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  // [LOG 2] Stream start
  console.log("[generate] Stream start - piping to client");

  let chunkCount = 0;
  let totalBytes = 0;

  // TransformStreamでログを挟みながらパイプ
  const { readable, writable } = new TransformStream({
    transform(chunk, controller) {
      chunkCount++;
      totalBytes += chunk.byteLength;
      // [LOG 3,4] chunk数・総byte数（10件ごと）
      if (chunkCount % 10 === 0) {
        console.log(`[generate] chunks: ${chunkCount}, totalBytes: ${totalBytes}`);
      }
      controller.enqueue(chunk);
    },
    flush() {
      // [LOG 5] ストリーム正常終了
      console.log(`[generate] Stream ended normally. Total chunks: ${chunkCount}, totalBytes: ${totalBytes}`);
    }
  });

  // Anthropicストリーム → TransformStream → クライアント
  anthropicRes.body.pipeTo(writable).catch((err) => {
    // [LOG 6] ストリーム例外
    console.error("[generate] Stream pipe error:", err?.message || err);
  });

  return new Response(readable, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
};

export const config = { path: "/api/generate" };
