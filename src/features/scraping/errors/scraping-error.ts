export class ScrapingError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly recoverable: boolean = true,
    public readonly retryable: boolean = true,
    public readonly metadata?: Record<string, any>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class BotDetectionError extends ScrapingError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, 'BOT_DETECTED', true, true, metadata);
  }
}

export class NetworkError extends ScrapingError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, 'NETWORK_ERROR', true, true, metadata);
  }
}

export class TimeoutError extends ScrapingError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, 'TIMEOUT', true, true, metadata);
  }
}

export class BrowserError extends ScrapingError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, 'BROWSER_ERROR', true, false, metadata);
  }
}

export class ResourceLimitError extends ScrapingError {
  constructor(message: string, metadata?: Record<string, any>) {
    super(message, 'RESOURCE_LIMIT', false, false, metadata);
  }
}

export const ErrorClassifier = {
  classify(error: Error): ScrapingError {
    const message = error.message.toLowerCase();

    if (
      message.includes('bot') ||
      message.includes('captcha') ||
      message.includes('403') ||
      message.includes('access denied')
    ) {
      return new BotDetectionError(error.message);
    }

    if (
      message.includes('network') ||
      message.includes('connect') ||
      message.includes('socket')
    ) {
      return new NetworkError(error.message);
    }

    if (message.includes('timeout') || message.includes('timed out')) {
      return new TimeoutError(error.message);
    }

    if (
      message.includes('browser') ||
      message.includes('page') ||
      message.includes('context')
    ) {
      return new BrowserError(error.message);
    }

    if (
      message.includes('memory') ||
      message.includes('cpu') ||
      message.includes('limit')
    ) {
      return new ResourceLimitError(error.message);
    }

    return new ScrapingError(error.message, 'UNKNOWN', true, true);
  },
};
