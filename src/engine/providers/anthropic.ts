import Anthropic from '@anthropic-ai/sdk';
import { LLMProvider } from '../types';

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async evaluate(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      temperature: 0.1,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const block = response.content[0];
    if (block.type === 'text') return block.text;
    throw new Error('Unexpected response format from Anthropic');
  }
}
