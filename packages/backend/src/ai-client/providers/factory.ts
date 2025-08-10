import { AIProvider, ProviderInterface } from '../types';
import { OpenAIProvider } from './openai';
import { AnthropicProvider } from './anthropic';
import { OpenRouterProvider } from './openrouter';

export class ProviderFactory {
  static create(
    provider: AIProvider, 
    apiKey: string,
    openRouterConfig?: { siteUrl?: string; siteName?: string }
  ): ProviderInterface {
    switch (provider) {
      case AIProvider.OPENAI:
        return new OpenAIProvider(apiKey);
      case AIProvider.ANTHROPIC:
        return new AnthropicProvider(apiKey);
      case AIProvider.OPENROUTER:
        return new OpenRouterProvider(
          apiKey, 
          openRouterConfig?.siteUrl, 
          openRouterConfig?.siteName
        );
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }
}
