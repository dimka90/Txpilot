import type { Plugin } from '@elizaos/core';
import {
  type Action,
  type ActionResult,
  type Content,
  type GenerateTextParams,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  ModelType,
  type Provider,
  type ProviderResult,
  Service,
  type State,
  logger,
} from '@elizaos/core';
import { z } from 'zod';

/**
 * Define the configuration schema for the plugin with the following properties:
 *
 * @param {string} EXAMPLE_PLUGIN_VARIABLE - The name of the plugin (min length of 1, optional)
 * @returns {object} - The configured schema object
 */
const configSchema = z.object({
  EXAMPLE_PLUGIN_VARIABLE: z
    .string()
    .min(1, 'Example plugin variable is not provided')
    .optional()
    .transform((val) => {
      if (!val) {
        console.warn('Warning: Example plugin variable is not provided');
      }
      return val;
    }),
});

/**
 * Example HelloWorld action
 * This demonstrates the simplest possible action structure
 */
const helloWorldAction: Action = {
  name: 'HELLO_WORLD',
  similes: ['GREET', 'SAY_HELLO'],
  description: 'Responds with a simple hello world message',

  validate: async (_runtime: IAgentRuntime, _message: Memory, _state: State): Promise<boolean> => {
    // Always valid
    return true;
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    _options: any,
    callback: HandlerCallback
  ): Promise<ActionResult> => {
    try {
      logger.info('Handling HELLO_WORLD action');

      // Simple response content
      const responseContent: Content = {
        text: 'hello world!',
        actions: ['HELLO_WORLD'],
        source: message.content.source,
      };

      // Call back with the hello world message
      await callback(responseContent);

      return {
        text: 'Sent hello world greeting',
        values: {
          success: true,
          greeted: true,
        },
        data: {
          actionName: 'HELLO_WORLD',
          messageId: message.id,
          timestamp: Date.now(),
        },
        success: true,
      };
    } catch (error) {
      logger.error({ error }, 'Error in HELLO_WORLD action:');

      return {
        text: 'Failed to send hello world greeting',
        values: {
          success: false,
          error: 'GREETING_FAILED',
        },
        data: {
          actionName: 'HELLO_WORLD',
          error: error instanceof Error ? error.message : String(error),
        },
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: {
          text: 'Can you say hello?',
        },
      },
      {
        name: '{{name2}}',
        content: {
          text: 'hello world!',
          actions: ['HELLO_WORLD'],
        },
      },
    ],
  ],
};

/**
 * Helper function to fetch prices from CoinGecko
 */
async function getCryptoPrices(cryptoIds: string[]): Promise<any> {
  try {
    const ids = cryptoIds.join(',');
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`
    );
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    logger.error('Error fetching crypto prices:', error);
    throw error;
  }
}

const getCryptoPriceAction: Action = {
  name: 'GET_CRYPTO_PRICE',
  similes: ['FETCH_PRICE', 'CHECK_CRYPTO', 'CRYPTO_PRICE'],
  description: 'Fetches current cryptocurrency prices from CoinGecko API',
  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || '';
    const cryptoKeywords = ['bitcoin', 'ethereum', 'crypto', 'price', 'btc', 'eth', 'solana', 'cardano', 'ripple', 'dogecoin'];

    return cryptoKeywords.some((keyword) => text.includes(keyword));
  },

  handler: async (
    _runtime: IAgentRuntime,
    message: Memory,
    _state: State,
    _options: any,
    callback: HandlerCallback
  ): Promise<ActionResult> => {
    try {
      logger.info('Handling GET_CRYPTO_PRICE action');

      const text = message.content.text?.toLowerCase() || '';
      const cryptoMap: Record<string, string> = {
        bitcoin: 'bitcoin',
        btc: 'bitcoin',
        ethereum: 'ethereum',
        eth: 'ethereum',
        solana: 'solana',
        sol: 'solana',
        cardano: 'cardano',
        ada: 'cardano',
        ripple: 'ripple',
        xrp: 'ripple',
        dogecoin: 'dogecoin',
        doge: 'dogecoin',
      };

      // Find which cryptos were mentioned
      const mentionedCrypto = new Set<string>();
      for (const [name, id] of Object.entries(cryptoMap)) {
        if (text.includes(name)) {
          mentionedCrypto.add(id);
        }
      }

      // If no specific crypto mentioned, default to Bitcoin and Ethereum
      const cryptoIds = mentionedCrypto.size > 0 ? Array.from(mentionedCrypto) : ['bitcoin', 'ethereum'];
      logger.info(`Fetching prices for: ${cryptoIds.join(', ')}`);

      const prices = await getCryptoPrices(cryptoIds);
      logger.info('Prices received:', JSON.stringify(prices));

      let responseText = 'Current cryptocurrency prices:\n\n';
      for (const [crypto, data] of Object.entries(prices)) {
        const price = (data as any).usd;
        const change24h = (data as any).usd_24h_change?.toFixed(2);

        responseText += `${crypto.toUpperCase()}: $${price} USD`;
        if (change24h) {
          responseText += ` (${change24h > 0 ? '+' : ''}${change24h}% 24h)`;
        }
        responseText += '\n';
      }

      logger.info('Sending callback with response:', responseText);
      await callback({
        text: responseText,
        actions: ['GET_CRYPTO_PRICE'],
      });
      logger.info('Callback completed successfully');

      return {
        text: 'Fetched cryptocurrency prices successfully',
        values: {
          success: true,
          cryptos: cryptoIds,
          priceData: prices,
        },
        data: {
          actionName: 'GET_CRYPTO_PRICE',
          timestamp: Date.now(),
        },
        success: true,
      };
    } catch (error) {
      logger.error('Error in GET_CRYPTO_PRICE action:', error);

      await callback({
        text: 'Sorry, I could not fetch the cryptocurrency prices at this moment. Please try again later.',
        error: true,
      });

      return {
        text: 'Failed to fetch cryptocurrency prices',
        values: {
          success: false,
          error: 'PRICE_FETCH_FAILED',
        },
        data: {
          actionName: 'GET_CRYPTO_PRICE',
          error: error instanceof Error ? error.message : String(error),
        },
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  },

  examples: [
    [
      {
        name: '{{name1}}',
        content: { text: 'What is the price of Bitcoin?' },
      },
      {
        name: 'CryptoPrice',
        content: {
          text: 'Current cryptocurrency prices:\n\nBITCOIN: $45,230 USD (+5.2% 24h)',
          actions: ['GET_CRYPTO_PRICE'],
        },
      },
    ],
  ],
};

/**
 * Example Hello World Provider
 * This demonstrates the simplest possible provider implementation
 */
const helloWorldProvider: Provider = {
  name: 'HELLO_WORLD_PROVIDER',
  description: 'A simple example provider',

  get: async (
    _runtime: IAgentRuntime,
    _message: Memory,
    _state: State
  ): Promise<ProviderResult> => {
    return {
      text: 'I am a provider',
      values: {},
      data: {},
    };
  },
};

export class StarterService extends Service {
  static serviceType = 'starter';
  capabilityDescription =
    'This is a starter service which is attached to the agent through the starter plugin.';

  constructor(runtime: IAgentRuntime) {
    super(runtime);
  }

  static async start(runtime: IAgentRuntime) {
    logger.info('*** Starting starter service ***');
    const service = new StarterService(runtime);
    return service;
  }

  static async stop(runtime: IAgentRuntime) {
    logger.info('*** Stopping starter service ***');
    // get the service from the runtime
    const service = runtime.getService(StarterService.serviceType);
    if (!service) {
      throw new Error('Starter service not found');
    }
    service.stop();
  }

  async stop() {
    logger.info('*** Stopping starter service instance ***');
  }
}

const plugin: Plugin = {
  name: 'starter',
  description: 'A starter plugin for Eliza',
  // Set lowest priority so real models take precedence
  priority: -1000,
  config: {
    EXAMPLE_PLUGIN_VARIABLE: process.env.EXAMPLE_PLUGIN_VARIABLE,
  },
  async init(config: Record<string, string>) {
    logger.info('*** Initializing starter plugin ***');
    try {
      const validatedConfig = await configSchema.parseAsync(config);

      // Set all environment variables at once
      for (const [key, value] of Object.entries(validatedConfig)) {
        if (value) process.env[key] = value;
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages =
          error.issues?.map((e) => e.message)?.join(', ') || 'Unknown validation error';
        throw new Error(`Invalid plugin configuration: ${errorMessages}`);
      }
      throw new Error(
        `Invalid plugin configuration: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
  models: {
    [ModelType.TEXT_SMALL]: async (
      _runtime,
      _params: GenerateTextParams
    ) => {
      return 'Never gonna give you up, never gonna let you down, never gonna run around and desert you...';
    },
    [ModelType.TEXT_LARGE]: async (
      _runtime,
      _params: GenerateTextParams
    ) => {
      return 'Never gonna make you cry, never gonna say goodbye, never gonna tell a lie and hurt you...';
    },
  },
  routes: [
    {
      name: 'helloworld',
      path: '/helloworld',
      type: 'GET',
      handler: async (_req: any, res: any) => {
        // send a response
        res.json({
          message: 'Hello World!',
        });
      },
    },
  ],
  events: {
    MESSAGE_RECEIVED: [
      async (params) => {
        logger.info('MESSAGE_RECEIVED event received');
        // print the keys
        logger.info({ keys: Object.keys(params) }, 'MESSAGE_RECEIVED param keys');
      },
    ],
    VOICE_MESSAGE_RECEIVED: [
      async (params) => {
        logger.info('VOICE_MESSAGE_RECEIVED event received');
        // print the keys
        logger.info({ keys: Object.keys(params) }, 'VOICE_MESSAGE_RECEIVED param keys');
      },
    ],
    WORLD_CONNECTED: [
      async (params) => {
        logger.info('WORLD_CONNECTED event received');
        // print the keys
        logger.info({ keys: Object.keys(params) }, 'WORLD_CONNECTED param keys');
      },
    ],
    WORLD_JOINED: [
      async (params) => {
        logger.info('WORLD_JOINED event received');
        // print the keys
        logger.info({ keys: Object.keys(params) }, 'WORLD_JOINED param keys');
      },
    ],
  },
  services: [StarterService],
  actions: [helloWorldAction, getCryptoPriceAction],
  providers: [helloWorldProvider],
};

export default plugin;
