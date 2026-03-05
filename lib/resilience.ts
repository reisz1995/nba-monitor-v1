/**
 * Resilience Utility: Exponential Backoff + Full Jitter
 */

export const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export interface RetryOptions {
    retries?: number;
    initialDelay?: number;
    maxDelay?: number;
    retryCondition?: (error: any) => boolean;
}

/**
 * withRetry implements the "Full Jitter" strategy as recommended by AWS Architecture patterns
 * to avoid "thundering herd" issues during service recoveries and traffic spikes.
 * 
 * Formula (Full Jitter): sleep = Math.random() * Math.min(cap, base * 2**attempt)
 */
export const withRetry = async <T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> => {
    const {
        retries = 5,
        initialDelay = 1000,
        maxDelay = 30000,
        retryCondition = (err) => {
            // Default: Retry on typical transient network or service errors
            const status = err.status || (err.response && err.response.status);
            const message = (err.message || "").toLowerCase();

            return (
                status === 429 || // Too Many Requests
                status === 502 || // Bad Gateway
                status === 503 || // Service Unavailable
                status === 504 || // Gateway Timeout
                message.includes("503") ||
                message.includes("high demand") ||
                message.includes("network error") ||
                message.includes("failed to fetch") ||
                message.includes("websocket")
            );
        }
    } = options;

    let lastError: any;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;

            if (attempt === retries || !retryCondition(error)) {
                throw error;
            }

            // Exponential Backoff + Full Jitter
            const backoffLimit = Math.min(maxDelay, initialDelay * Math.pow(2, attempt));
            const jitterDelay = Math.random() * backoffLimit;

            console.warn(
                `[Resilience] Falha na tentativa ${attempt + 1}/${retries + 1}. Tentando novamente em ${Math.round(jitterDelay)}ms... Motivo: ${error.message || 'Erro desconhecido'}`
            );

            await delay(jitterDelay);
        }
    }

    throw lastError;
};
