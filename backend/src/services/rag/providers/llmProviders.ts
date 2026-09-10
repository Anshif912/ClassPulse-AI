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
        text: context && context.trim()
          ? `Based on class lecture notes:\n${context.trim().slice(0, 350)}...`
          : `I can explain this concept based on foundational principles. What specific detail would you like to explore?`,
        model: this.model,
        provider: this.name,
      };
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${config.gemini.apiKey}`;
      const systemInstruction =
        options?.systemPrompt ||
        'You are ClassPulse AI, an intelligent classroom companion. Answer the student question strictly using the provided classroom context. If the answer is not in the context, explain the general scientific concept clearly and warmly in the student language (English, Tamil, Tanglish, or Hindi).';

      const userPrompt = `Context:\n${context}\n\nStudent Question: ${query}\n\nLanguage: ${options?.language || 'auto'}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemInstruction}\n\n${userPrompt}` }] }],
          generationConfig: {
            temperature: options?.temperature ?? 0.2,
            maxOutputTokens: options?.maxTokens ?? 1024,
          },
        }),
      });

      if (!res.ok) {
        const errData: any = await res.json().catch(() => ({}));
        throw new Error(`Gemini API HTTP ${res.status}: ${errData?.error?.message || 'Request failed'}`);
      }

      const data: any = await res.json();
      const candidate = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!candidate || candidate.trim().length === 0) {
        throw new Error('Gemini API returned empty text');
      }

      return {
        text: candidate.trim(),
        model: this.model,
        provider: this.name,
      };
    } catch (err: any) {
      console.warn('[GEMINI_LLM_ERROR]', err.message);
      throw err;
    }
  }
}

/**
 * Local Qwen3 4B LLM Provider (via Ollama)
 * Conservative VRAM footprint (~2.5-3.0 GB VRAM on RTX 4060) with strong multilingual and grounded reasoning capabilities.
 */
export class QwenLLMProvider implements ILLMProvider {
  public readonly name = 'qwen';
  public readonly model: string;
  private endpoint: string;
  public lastStatus: 'online' | 'offline_fallback' | 'error' = 'online';

  constructor(endpoint?: string, model?: string) {
    const rawUrl = endpoint || config.rag?.localLlmUrl || 'http://127.0.0.1:11434';
    // Normalize to chat endpoint if base or generate endpoint provided
    if (rawUrl.endsWith('/api/generate')) {
      this.endpoint = rawUrl.replace('/api/generate', '/api/chat');
    } else if (!rawUrl.includes('/api/')) {
      this.endpoint = `${rawUrl.replace(/\/+$/, '')}/api/chat`;
    } else {
      this.endpoint = rawUrl;
    }
    this.model = model || config.rag?.localLlmModel || 'qwen2.5:3b';
  }

  public async generateAnswer(
    query: string,
    context: string,
    options?: LLMGenerateOptions
  ): Promise<LLMResponse> {
    const systemPrompt =
      options?.systemPrompt ||
      'You are ClassPulse AI, an intelligent, empathetic classroom tutor. Provide clear, direct, and concise explanations in 2-4 sentences or clear bullet points with practical examples. Respond in the student language (English, Tamil, Hindi, or Tanglish) as requested.';

    const userPrompt = context && context.trim()
      ? `Classroom Context:\n${context.trim()}\n\nStudent Question: ${query}\n\nLanguage: ${options?.language || 'auto'}`
      : `Student Question: ${query}\n\nLanguage: ${options?.language || 'auto'}`;

    try {
      const timeoutMs = options?.timeoutMs || 45000;
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          stream: false,
          options: {
            temperature: options?.temperature ?? 0.3,
            num_predict: options?.maxTokens ?? 512,
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        this.lastStatus = 'error';
        throw new Error(`Ollama Qwen LLM HTTP ${res.status}: ${errText}`);
      }

      const data: any = await res.json();
      const rawContent = data?.message?.content || data?.response || '';
      let responseText = '';
      if (rawContent.includes('</think>')) {
        responseText = rawContent.split('</think>')[1].trim();
      } else {
        responseText = (rawContent || '').trim().replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>/gi, '').trim();
      }

      if (responseText.length > 0) {
        this.lastStatus = 'online';
        return {
          text: responseText,
          model: this.model,
          provider: this.name,
        };
      }

      // If content was truncated inside thinking, fallback to clean synthesized context
      this.lastStatus = 'online';
      return {
        text: context && context.trim()
          ? `Answer based on lecture notes:\n${context.slice(0, 350)}...`
          : `I can help explain this concept. What specific aspect would you like to explore?`,
        model: this.model,
        provider: this.name,
      };
    } catch (err: any) {
      this.lastStatus = 'error';
      console.warn(`[QWEN_LLM_OFFLINE_FALLBACK] ${err.message}. Attempting Gemini / synthesized fallback.`);
      if (config.gemini.apiKey) {
        try {
          const gemini = new GeminiLLMProvider();
          return await gemini.generateAnswer(query, context, options);
        } catch {}
      }
      return {
        text: context && context.trim()
          ? `Answer based on lecture notes:\n${context.slice(0, 350)}...`
          : `I can help explain this concept. What specific aspect would you like to explore?`,
        model: this.model,
        provider: this.name,
      };
    }
  }
}
