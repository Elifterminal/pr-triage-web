import { LLMProvider, PRInputData, ProviderType, DEFAULT_MODELS, TriageResult } from './types';
import { AnthropicProvider } from './providers/anthropic';
import { OpenAIProvider } from './providers/openai';
import { OpenRouterProvider } from './providers/openrouter';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompts';
import { parseAndScoreLLMResponse } from './scoring';

export interface TriageOptions {
  apiKey: string;
  provider: ProviderType;
  model?: string;
  maxDiffChars?: number;
}

function createProvider(options: TriageOptions): LLMProvider {
  const model = options.model || DEFAULT_MODELS[options.provider];

  switch (options.provider) {
    case 'ANTHROPIC':
      return new AnthropicProvider(options.apiKey, model);
    case 'OPENAI':
      return new OpenAIProvider(options.apiKey, model);
    case 'OPENROUTER':
      return new OpenRouterProvider(options.apiKey, model);
    default:
      throw new Error(`Unsupported provider: ${options.provider}`);
  }
}

export async function runTriage(
  input: PRInputData,
  options: TriageOptions
): Promise<TriageResult> {
  const maxDiffChars = options.maxDiffChars || 12000;
  const provider = createProvider(options);
  const userPrompt = buildUserPrompt(input, maxDiffChars);

  const raw = await provider.evaluate(SYSTEM_PROMPT, userPrompt);

  try {
    return parseAndScoreLLMResponse(raw);
  } catch (error) {
    // If LLM response can't be parsed, return a degraded result
    return {
      compositeScore: 50,
      confidenceLevel: 'INSUFFICIENT',
      priority: 'MEDIUM',
      action: 'NEEDS_HUMAN_JUDGMENT',
      recommendation: 'NEEDS_HUMAN_JUDGMENT',
      prCategory: 'CODE_CHANGE',
      executiveSummary:
        'PR Triage was unable to produce a structured assessment. ' +
        'This may be due to an unusual PR format or a temporary provider issue. ' +
        'Manual review is recommended.',
      dimensions: [],
      riskFlags: [],
      conflictingSignals: [],
      missingContext: ['LLM response could not be parsed'],
      availableContext: [],
      whatToVerify: ['All aspects of this PR require manual review'],
      strengths: [],
      concerns: ['Automated assessment failed'],
    };
  }
}
