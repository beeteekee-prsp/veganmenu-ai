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

  if (!anthropicRes.ok) {
    const errText = await anthropicRes.text();
    return new Response(errText, {
      status: anthropicRes.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  // AnthropicのSSEをそのままブラウザへ流す
  return new Response(anthropicRes.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
};

export const config = { path: "/api/generate" };
