import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { parse } from "yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configPath = join(__dirname, "../../config.yml");

let config = null;

/**
 * Carrega e parseia o arquivo config.yml
 * @returns {Object} Configuração do bot
 */
export function loadConfig() {
    if (!existsSync(configPath)) {
        console.error("❌ Arquivo config.yml não encontrado!");
        console.error("   Por favor, copie o config.example.yml e configure-o.");
        process.exit(1);
    }

    try {
        const fileContent = readFileSync(configPath, "utf8");
        config = parse(fileContent);
        validateConfig(config);
        console.log("✅ Configuração carregada com sucesso!");
        return config;
    } catch (error) {
        console.error("❌ Erro ao carregar config.yml:", error.message);
        process.exit(1);
    }
}

/**
 * Retorna a configuração atual
 * @returns {Object} Configuração do bot
 */
export function getConfig() {
    if (!config) {
        return loadConfig();
    }
    return config;
}

/**
 * Recarrega a configuração do arquivo
 * @returns {Object} Configuração atualizada
 */
export function reloadConfig() {
    config = null;
    return loadConfig();
}

/**
 * Valida a estrutura da configuração
 * @param {Object} cfg - Configuração a ser validada
 */
function validateConfig(cfg) {
    const errors = [];

    // Validar seções obrigatórias
    if (!cfg.bot) errors.push('Seção "bot" não encontrada');
    if (!cfg.appearance) errors.push('Seção "appearance" não encontrada');
    if (!cfg.categories || !Array.isArray(cfg.categories)) {
        errors.push('Seção "categories" não encontrada ou inválida');
    }
    if (!cfg.panels || !Array.isArray(cfg.panels)) {
        errors.push('Seção "panels" não encontrada ou inválida');
    }

    // Validar categorias
    if (cfg.categories) {
        cfg.categories.forEach((cat, index) => {
            if (!cat.id) errors.push(`Categoria ${index + 1}: "id" é obrigatório`);
            if (!cat.name) errors.push(`Categoria ${index + 1}: "name" é obrigatório`);
            if (!cat.discordCategory) {
                errors.push(`Categoria "${cat.id || index + 1}": "discordCategory" é obrigatório`);
            }
            if (!cat.staffRoles || !Array.isArray(cat.staffRoles) || cat.staffRoles.length === 0) {
                errors.push(`Categoria "${cat.id || index + 1}": "staffRoles" deve ter pelo menos um cargo`);
            }
        });
    }

    // Validar painéis
    if (cfg.panels) {
        cfg.panels.forEach((panel, index) => {
            if (!panel.channelId) {
                errors.push(`Painel ${index + 1}: "channelId" é obrigatório`);
            }
            if (!panel.categories || !Array.isArray(panel.categories) || panel.categories.length === 0) {
                errors.push(`Painel ${index + 1}: "categories" deve ter pelo menos uma categoria`);
            }
        });
    }

    // Se houver erros, avisar mas não impedir o início
    if (errors.length > 0) {
        console.warn("⚠️  Avisos de configuração:");
        errors.forEach(err => console.warn(`   - ${err}`));
        console.warn("   Por favor, configure os IDs no config.yml antes de usar o bot.\n");
    }
}

/**
 * Obtém uma categoria pelo ID
 * @param {string} categoryId - ID da categoria
 * @returns {Object|null} Categoria ou null
 */
export function getCategory(categoryId) {
    const cfg = getConfig();
    return cfg.categories?.find(cat => cat.id === categoryId) || null;
}

/**
 * Obtém todas as categorias
 * @returns {Array} Lista de categorias
 */
export function getAllCategories() {
    const cfg = getConfig();
    return cfg.categories || [];
}

/**
 * Obtém um painel pelo ID
 * @param {string} panelId - ID do painel
 * @returns {Object|null} Painel ou null
 */
export function getPanel(panelId) {
    const cfg = getConfig();
    return cfg.panels?.find(panel => panel.id === panelId) || null;
}

/**
 * Obtém as cores de aparência
 * @returns {Object} Cores configuradas
 */
export function getColors() {
    const cfg = getConfig();
    return (
        cfg.appearance?.colors || {
            primary: "#5865F2",
            success: "#57F287",
            warning: "#FEE75C",
            error: "#ED4245",
            info: "#5865F2",
        }
    );
}

/**
 * Obtém uma mensagem configurada
 * @param {string} type - Tipo da mensagem (errors, success, buttons, misc)
 * @param {string} key - Chave da mensagem
 * @param {Object} replacements - Variáveis para substituir
 * @returns {string} Mensagem formatada
 */
export function getMessage(type, key, replacements = {}) {
    const cfg = getConfig();
    let message = cfg.messages?.[type]?.[key] || key;

    // Substituir variáveis
    Object.entries(replacements).forEach(([k, v]) => {
        message = message.replace(new RegExp(`\\{${k}\\}`, "g"), v);
    });

    return message;
}

/**
 * Obtém configurações de logging
 * @returns {Object} Configuração de logs
 */
export function getLoggingConfig() {
    const cfg = getConfig();
    return cfg.logging || { enabled: false };
}

/**
 * Obtém configurações de transcrições
 * @returns {Object} Configuração de transcrições
 */
export function getTranscriptConfig() {
    const cfg = getConfig();
    return cfg.transcripts || { enabled: false };
}

/**
 * Obtém configurações de auto-close
 * @returns {Object} Configuração de auto-close
 */
export function getAutoCloseConfig() {
    const cfg = getConfig();
    return cfg.autoClose || { enabled: false };
}

/**
 * Obtém configurações de avaliações
 * @returns {Object} Configuração de avaliações
 */
export function getRatingsConfig() {
    const cfg = getConfig();
    return cfg.ratings || { enabled: false };
}

/**
 * Obtém configurações de horário de atendimento
 * @returns {Object} Configuração de horário
 */
export function getBusinessHoursConfig() {
    const cfg = getConfig();
    return cfg.businessHours || { enabled: false };
}

/**
 * Verifica se está dentro do horário de atendimento
 * @returns {Object} { isOpen: boolean, message: string, allowOutside: boolean }
 */
export function checkBusinessHours() {
    const config = getBusinessHoursConfig();

    if (!config.enabled) {
        return { isOpen: true, message: null, allowOutside: true };
    }

    const timezone = config.timezone || "America/Sao_Paulo";
    const now = new Date();

    // Converter para o fuso horário configurado
    const localTime = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
    const currentDay = localTime.getDay(); // 0 = Domingo, 1 = Segunda, etc
    const currentHour = localTime.getHours();
    const currentMinute = localTime.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    // Procurar horário do dia atual
    const todaySchedule = config.schedule?.find(s => s.day === currentDay);

    if (!todaySchedule) {
        // Não tem horário configurado para hoje
        return {
            isOpen: false,
            message: config.outsideMessage || "Estamos fora do horário de atendimento.",
            allowOutside: config.allowOutside !== false,
        };
    }

    // Suporte para múltiplos períodos por dia
    let periods = [];

    // Verificar se usa o formato novo (com periods) ou antigo (startHour/endHour)
    if (todaySchedule.periods && Array.isArray(todaySchedule.periods)) {
        periods = todaySchedule.periods;
    } else if (todaySchedule.startHour !== undefined && todaySchedule.endHour !== undefined) {
        // Formato antigo - converter para array de períodos
        periods = [
            {
                startHour: todaySchedule.startHour,
                startMinute: todaySchedule.startMinute || 0,
                endHour: todaySchedule.endHour,
                endMinute: todaySchedule.endMinute || 0,
            },
        ];
    }

    // Verificar se está dentro de algum período
    let isOpen = false;
    for (const period of periods) {
        const startTimeInMinutes = period.startHour * 60 + (period.startMinute || 0);
        const endTimeInMinutes = period.endHour * 60 + (period.endMinute || 0);

        if (currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes) {
            isOpen = true;
            break;
        }
    }

    if (!isOpen) {
        let message = config.outsideMessage || "Estamos fora do horário de atendimento.";

        // Formatar horários para exibição
        const horarios = periods
            .map(
                p =>
                    `${String(p.startHour).padStart(2, "0")}:${String(p.startMinute || 0).padStart(2, "0")} às ${String(p.endHour).padStart(2, "0")}:${String(p.endMinute || 0).padStart(2, "0")}`,
            )
            .join(" e ");

        message = message.replace("{timezone}", timezone).replace("{horario}", horarios);

        return {
            isOpen: false,
            message,
            allowOutside: config.allowOutside !== false,
        };
    }

    return { isOpen: true, message: null, allowOutside: true };
}

export default {
    loadConfig,
    getConfig,
    reloadConfig,
    getCategory,
    getAllCategories,
    getPanel,
    getColors,
    getMessage,
    getLoggingConfig,
    getTranscriptConfig,
    getAutoCloseConfig,
    getRatingsConfig,
    getBusinessHoursConfig,
    checkBusinessHours,
};
