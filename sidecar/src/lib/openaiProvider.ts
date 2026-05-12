import OpenAI from "openai";
import type { ApiMode } from "./types.js";

interface StreamInput {
  apiKey: string;
  baseURL?: string;
  apiMode: ApiMode;
  model: string;
  contextPacket: string;
  signal?: AbortSignal;
  onDelta(delta: string): void;
}

export async function streamOpenAIReview(input: StreamInput) {
  const client = new OpenAI({ apiKey: input.apiKey, baseURL: input.baseURL });

  if (input.apiMode === "chat") {
    const stream = await client.chat.completions.create(
      {
        model: input.model,
        stream: true,
        messages: [{ role: "user", content: input.contextPacket }]
      },
      { signal: input.signal }
    );

    for await (const event of stream) {
      const delta = event.choices[0]?.delta?.content;
      if (delta) {
        input.onDelta(delta);
      }
    }
    return;
  }

  const stream = await client.responses.create(
    {
      model: input.model,
      stream: true,
      input: input.contextPacket
    },
    { signal: input.signal }
  );

  for await (const event of stream) {
    if (event.type === "response.output_text.delta") {
      input.onDelta(event.delta);
    }
  }
}
