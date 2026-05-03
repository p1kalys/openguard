/**
 * Type definitions for OpenAI chat completions and related functionality
 */

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export type FinishReason = 'stop' | 'length' | 'content_filter' | 'tool_calls' | null;

export interface BaseMessage {
  role: MessageRole;
  content: string;
}

export interface SystemMessage extends BaseMessage {
  role: 'system';
}

export interface UserMessage extends BaseMessage {
  role: 'user';
}

export interface AssistantMessage extends BaseMessage {
  role: 'assistant';
}

export interface ToolMessage extends BaseMessage {
  role: 'tool';
  toolCallId: string;
}

export type Message = SystemMessage | UserMessage | AssistantMessage | ToolMessage;

export interface ChatCompletionRequest {
  messages: Message[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stream?: boolean;
}

export type ChatCompletionRequestParams = Omit<ChatCompletionRequest, 'messages' | 'model'>;

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage?: ChatCompletionUsage;
}

export interface ChatCompletionChoice {
  index: number;
  message: AssistantMessage;
  finishReason: FinishReason;
}

export interface ChatCompletionUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatCompletionError {
  message: string;
  type: string;
  code?: string;
  param?: string;
}

// Utility types
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};