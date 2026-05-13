import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { createWorkspaceTools } from "./tools.js";
import type { ApiMode } from "./types.js";

const MAX_TOOL_ITERATIONS = 6;

interface StreamInput {
  apiKey: string;
  baseURL?: string;
  apiMode: ApiMode;
  model: string;
  contextPacket: string;
  workspaceRoot: string;
  allowedWriteExtensions?: string[];
  enableTools?: boolean;
  signal?: AbortSignal;
  onDelta(delta: string): void;
  onToolCall?(name: string, args: string): void;
  onToolResult?(name: string, result: string): void;
}

export async function streamOpenAIReview(input: StreamInput) {
  const client = new OpenAI({ apiKey: input.apiKey, baseURL: input.baseURL });

  if (input.apiMode === "chat") {
    await runChatCompletion(input, client);
    return;
  }

  if (input.enableTools) {
    throw new Error("Tool use is only available in chat mode.");
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

async function runChatCompletion(input: StreamInput, client: OpenAI) {
  if (!input.enableTools) {
    await streamFinalChatAnswer(client, input, [{ role: "user", content: input.contextPacket }]);
    return;
  }

  const messages: ChatCompletionMessageParam[] = [{ role: "user", content: input.contextPacket }];
  const tools = createWorkspaceTools(input.workspaceRoot, { allowedWriteExtensions: input.allowedWriteExtensions });

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i += 1) {
    const response = await client.chat.completions.create(
      {
        model: input.model,
        stream: false,
        messages,
        tools: tools.definitions,
        tool_choice: "auto"
      },
      { signal: input.signal }
    );

    const message = response.choices[0]?.message;
    if (!message) return;
    messages.push(message);

    if (!message.tool_calls?.length) {
      input.onDelta(message.content || "");
      return;
    }

    for (const toolCall of message.tool_calls) {
      if (toolCall.type !== "function") {
        continue;
      }
      const name = toolCall.function.name;
      const args = toolCall.function.arguments || "{}";
      input.onToolCall?.(name, args);
      const result = truncateToolResult(String(await tools.execute(name, args)));
      input.onToolResult?.(name, result);
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: result
      });
    }
  }

  await streamFinalChatAnswer(client, input, [
    ...messages,
    {
      role: "system",
      content:
        "The workspace tool-call limit has been reached. Stop calling tools and answer from the evidence already gathered. If the evidence is insufficient, say exactly what is missing."
    }
  ]);
}

async function streamFinalChatAnswer(client: OpenAI, input: StreamInput, messages: ChatCompletionMessageParam[]) {
  const stream = await client.chat.completions.create(
    {
      model: input.model,
      stream: true,
      messages
    },
    { signal: input.signal }
  );

  for await (const event of stream) {
    const delta = event.choices[0]?.delta?.content;
    if (delta) {
      input.onDelta(delta);
    }
  }
}

function truncateToolResult(value: string) {
  if (value.length <= 20_000) {
    return value;
  }
  return `${value.slice(0, 20_000)}\n\n[Tool result truncated at 20000 characters.]`;
}
