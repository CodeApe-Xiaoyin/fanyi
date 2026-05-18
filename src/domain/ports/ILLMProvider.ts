export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  model: string;
  system?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonSchema?: object;
  metadata?: Record<string, unknown>;
}

export interface ChatResponse {
  text: string;
  json?: unknown;
  raw?: unknown;
}

export interface ChatChunk {
  text: string;
}

export interface ILLMProvider {
  readonly id: string;
  readonly capabilities: {
    streaming: boolean;
    jsonMode: boolean;
    maxContextTokens: number;
    supportsSystemPrompt: boolean;
  };

  chat(request: ChatRequest): Promise<ChatResponse>;
  chatStream?(request: ChatRequest): AsyncIterable<ChatChunk>;
}
