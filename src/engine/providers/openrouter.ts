import OpenAI from 'openai';
import { LLMProvider } from '../types';

export class OpenRouterProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://pr-triage.dev',
        'X-Title': 'PR Triage',
      },
    });
    this.model = model;
  }

  async evaluate(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 4096,
      temperature: 0.1,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('Empty response from OpenRouter');
    return content;
  }
}
