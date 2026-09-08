import { ILLMProvider, LLMGenerateOptions, LLMResponse } from './interfaces';
import { config } from '../../../config';

export class GeminiLLMProvider implements ILLMProvider {
  public readonly name = 'gemini';
  public readonly model = 'gemini-1.5-flash';

  public async generateAnswer(
    query: string,
    context: string,
    options?: LLMGenerateOptions
  ): Promise<LLMResponse> {
    if (!config.gemini.apiKey) {
      return {
        text: `Answer based on class notes: ${context.slice(0, 300)}...`,
        model: this.model,
        provider: this.name,
      };
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${config.gemini.apiKey}`;
      const systemInstruction =
        options?.systemPrompt ||
        'You are ClassPulse AI, an intelligent classroom companion. Answer the student question strictly using the provided classroom context. If the answer is not in the context, say you do not have enough information from the lecture notes.';

      const userPrompt = `Context:\n${context}\n\nStudent Question: ${query}\n\nLanguage: ${options?.language || 'auto'}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemInstruction}\n\n${userPrompt}` }] }],
          generationConfig: {
            temperature: options?.temperature ?? 0.2,
            maxOutputTokens: options?.maxTokens ?? 512,
          },
        }),
      });

      const data: any = await res.json();
      const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      return {
        text: candidate || 'Unable to generate response.',
        model: this.model,
        provider: this.name,
      };
    } catch {
      return {
        text: `Based on class lecture notes: ${context.slice(0, 300)}...`,
        model: this.model,
        provider: this.name,
      };
    }
  }
}

/**
 * Local Qwen3 / Qwen2.5 LLM Provider
 * Perfect fit for RTX 3050 / 4060 (~3-4 GB VRAM) alongside 0.6B embedding & reranker
 */
export class QwenLLMProvider implements ILLMProvider {
  public readonly name = 'qwen3-4b-local';
  public readonly model: string;
  private endpoint: string;
  public lastStatus: 'online' | 'offline_fallback' = 'online';

  constructor(endpoint?: string, model?: string) {
    this.endpoint = endpoint || config.rag?.localLlmUrl || 'http://127.0.0.1:11434/api/generate';
    this.model = model || config.rag?.localLlmModel || 'qwen2.5:3b';
  }

  public async generateAnswer(
    query: string,
    context: string,
    options?: LLMGenerateOptions
  ): Promise<LLMResponse> {
    const prompt = `System: You are ClassPulse AI. Answer student questions using the context below.\nContext: ${context}\nStudent: ${query}\nAssistant:`;

    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(2000),
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: {
            temperature: options?.temperature ?? 0.2,
            num_predict: options?.maxTokens ?? 512,
          },
        }),
      });

      const data: any = await res.json();
      if (data?.response) {
        this.lastStatus = 'online';
        return {
          text: data.response.trim(),
          model: this.model,
          provider: this.name,
        };
      }
    } catch {
      this.lastStatus = 'offline_fallback';
    }

    this.lastStatus = 'offline_fallback';
    return {
      text: `Based on lecture notes: ${context.slice(0, 300)}...`,
      model: this.model,
      provider: this.name,
    };
  }
}
