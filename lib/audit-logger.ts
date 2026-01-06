import { prisma } from "@/lib/prisma";

interface LogMetadata {
    action?: string;
    resourceType?: string;
    resourceId?: number | string;
    subscriptionId?: number;
    organisationId?: number;
    userId?: string;
    immediate?: boolean;
    reason?: string;
    autoRenew?: boolean;
    [key: string]: any;
}

/**
 * Log an informational event to the database
 */
export async function logInfo(message: string, metadata?: LogMetadata) {
    try {
        await prisma.logEvents.create({
            data: {
                message,
                level: "Information",
                timeStamp: new Date(),
                properties: metadata ? JSON.stringify(sanitizeMetadata(metadata)) : null,
            },
        });
    } catch (error) {
        console.error("Failed to write log:", error);
    }
}

/**
 * Log a warning event to the database
 */
export async function logWarning(message: string, metadata?: LogMetadata) {
    try {
        await prisma.logEvents.create({
            data: {
                message,
                level: "Warning",
                timeStamp: new Date(),
                properties: metadata ? JSON.stringify(sanitizeMetadata(metadata)) : null,
            },
        });
    } catch (error) {
        console.error("Failed to write log:", error);
    }
}

/**
 * Log an error event to the database
 */
export async function logError(message: string, metadata?: LogMetadata, exception?: Error) {
    try {
        await prisma.logEvents.create({
            data: {
                message,
                level: "Error",
                timeStamp: new Date(),
                exception: exception ? exception.stack || exception.message : null,
                properties: metadata ? JSON.stringify(sanitizeMetadata(metadata)) : null,
            },
        });
    } catch (error) {
        console.error("Failed to write log:", error);
    }
}

/**
 * Sanitize metadata to remove sensitive information
 */
function sanitizeMetadata(metadata: LogMetadata): LogMetadata {
    const sanitized = { ...metadata };

    // List of sensitive keys that should never be logged
    const sensitiveKeys = [
        "password",
        "razorpaySecret",
        "razorpayKey",
        "cardNumber",
        "cvv",
        "accessToken",
        "refreshToken",
        "apiKey",
        "secret",
    ];

    // Remove sensitive keys
    for (const key of sensitiveKeys) {
        if (key in sanitized) {
            delete sanitized[key];
        }
    }

    return sanitized;
}
