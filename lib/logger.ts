import pino from 'pino';

// Configure pino logger
// Simplified configuration for Next.js compatibility
// pino-pretty requires worker threads which don't work well in Next.js runtime
export const logger = pino({
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    // Use browser-compatible configuration for Next.js
    browser: {
        asObject: false,
    },
    base: {
        env: process.env.NODE_ENV,
    },
    // Simple formatting for development
    formatters: {
        level: (label) => {
            return { level: label.toUpperCase() };
        },
    },
});

// Helper to create child loggers with context
export const createLogger = (context: string) => logger.child({ context });

