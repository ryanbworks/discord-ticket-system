/**
 * Executa uma função com retry automático em caso de erros de rede
 * @param {Function} fn - Função assíncrona para executar
 * @param {Object} options - Opções de retry
 * @returns {Promise} - Resultado da função
 */
export async function retryWithBackoff(fn, options = {}) {
    const {
        maxRetries = 3,
        initialDelay = 1000,
        maxDelay = 10000,
        backoffMultiplier = 2,
        retryableErrors = ["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT"],
    } = options;

    let lastError;
    let delay = initialDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // Verificar se é um erro que justifica retry
            const shouldRetry =
                attempt < maxRetries &&
                (retryableErrors.includes(error.code) ||
                    error.message?.includes("timeout") ||
                    error.message?.includes("EAI_AGAIN"));

            if (!shouldRetry) {
                throw error;
            }

            // Log do retry
            console.log(
                `⚠️  Erro de conexão (tentativa ${attempt + 1}/${maxRetries + 1}): ${error.code || error.message}`,
            );
            console.log(`⏳ Aguardando ${delay}ms antes de tentar novamente...`);

            // Aguardar antes do próximo retry
            await new Promise(resolve => setTimeout(resolve, delay));

            // Aumentar o delay para o próximo retry (exponential backoff)
            delay = Math.min(delay * backoffMultiplier, maxDelay);
        }
    }

    // Se chegou aqui, todas as tentativas falharam
    throw lastError;
}

/**
 * Wrapper para operações do Discord.js com retry automático
 * @param {Function} operation - Operação a ser executada
 * @returns {Promise} - Resultado da operação
 */
export async function discordApiCall(operation) {
    return retryWithBackoff(operation, {
        maxRetries: 3,
        initialDelay: 2000,
        maxDelay: 15000,
    });
}
