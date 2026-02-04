/**
 * Safe JSON stringification that handles circular references
 */
export function safeJsonStringify(obj: any, indent = 2): string {
    const cache = new Set();
    return JSON.stringify(
        obj,
        (key, value) => {
            if (typeof value === 'object' && value !== null) {
                if (cache.has(value)) {
                    return '[Circular]';
                }
                cache.add(value);
            }
            // Handle Promises (Next.js 15 params)
            if (value instanceof Promise) {
                return '[Promise]';
            }
            return value;
        },
        indent
    );
}
