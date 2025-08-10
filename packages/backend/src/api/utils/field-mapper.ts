/**
 * Converts camelCase fields to snake_case for database operations
 */
export function mapCamelToSnake(data: any): any {
  const mapped: any = {};
  
  const fieldMap: Record<string, string> = {
    userId: 'user_id',
    systemPrompt: 'system_prompt',
    maxTokens: 'max_tokens',
    welcomeMessage: 'welcome_message',
    suggestedQuestions: 'suggested_questions',
    embedSettings: 'embed_settings',
    shareToken: 'share_token',
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  };

  for (const [key, value] of Object.entries(data)) {
    const snakeKey = fieldMap[key] || key;
    mapped[snakeKey] = value;
  }

  return mapped;
}

/**
 * Converts snake_case fields to camelCase for API responses
 */
export function mapSnakeToCamel(data: any): any {
  const mapped: any = {};
  
  const fieldMap: Record<string, string> = {
    user_id: 'userId',
    system_prompt: 'systemPrompt',
    max_tokens: 'maxTokens',
    welcome_message: 'welcomeMessage',
    suggested_questions: 'suggestedQuestions',
    embed_settings: 'embedSettings',
    share_token: 'shareToken',
    created_at: 'createdAt',
    updated_at: 'updatedAt'
  };

  for (const [key, value] of Object.entries(data)) {
    const camelKey = fieldMap[key] || key;
    mapped[camelKey] = value;
  }

  return mapped;
}
