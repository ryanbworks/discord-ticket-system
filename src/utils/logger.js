import { getColors, getLoggingConfig } from "../lib/config.js";
import { createEmbed } from "./embed.js";

/**
 * Logger de eventos do sistema de tickets
 */
class TicketLogger {
    constructor(client) {
        this.client = client;
        this.config = getLoggingConfig();
    }

    /**
     * Verifica se um evento deve ser logado
     * @param {string} event - Nome do evento
     * @returns {boolean}
     */
    shouldLog(event) {
        if (!this.config.enabled) return false;
        return this.config.events?.[event] === true;
    }

    /**
     * Obtém o canal de logs
     * @returns {Promise<TextChannel|null>}
     */
    async getLogChannel() {
        if (!this.config.channelId) return null;
        try {
            return await this.client.channels.fetch(this.config.channelId);
        } catch {
            return null;
        }
    }

    /**
     * Envia um log
     * @param {string} event - Tipo do evento
     * @param {Object} data - Dados do log
     */
    async log(event, data) {
        if (!this.shouldLog(event)) return;

        const channel = await this.getLogChannel();
        if (!channel) return;

        const embed = this.createLogEmbed(event, data);
        if (!embed) return;

        try {
            await channel.send({ embeds: [embed] });
        } catch (error) {
            console.error("Erro ao enviar log:", error.message);
        }
    }

    /**
     * Cria a embed de log baseada no evento
     * @param {string} event - Tipo do evento
     * @param {Object} data - Dados do log
     * @returns {EmbedBuilder}
     */
    createLogEmbed(event, data) {
        const colors = getColors();

        const embedConfigs = {
            ticketCreate: {
                title: "🎫 Ticket Criado",
                color: colors.success,
                fields: [
                    { name: "📋 Ticket", value: data.channel?.toString() || "N/A", inline: true },
                    { name: "👤 Usuário", value: data.user?.toString() || "N/A", inline: true },
                    { name: "📁 Categoria", value: data.category?.name || "N/A", inline: true },
                ],
            },
            ticketClose: {
                title: "🔒 Ticket Fechado",
                color: colors.error,
                fields: [
                    { name: "📋 Ticket", value: `#${data.ticketNumber || "N/A"}`, inline: true },
                    { name: "👤 Fechado por", value: data.closedBy?.toString() || "N/A", inline: true },
                    { name: "📝 Motivo", value: data.reason || "Nenhum motivo", inline: false },
                ],
            },
            ticketReopen: {
                title: "🔓 Ticket Reaberto",
                color: colors.warning,
                fields: [
                    { name: "📋 Ticket", value: data.channel?.toString() || "N/A", inline: true },
                    { name: "👤 Reaberto por", value: data.user?.toString() || "N/A", inline: true },
                ],
            },
            ticketClaim: {
                title: "🙋 Ticket Assumido",
                color: colors.info,
                fields: [
                    { name: "📋 Ticket", value: data.channel?.toString() || "N/A", inline: true },
                    { name: "👤 Staff", value: data.staff?.toString() || "N/A", inline: true },
                ],
            },
            ticketUnclaim: {
                title: "📤 Ticket Liberado",
                color: colors.warning,
                fields: [
                    { name: "📋 Ticket", value: data.channel?.toString() || "N/A", inline: true },
                    { name: "👤 Staff", value: data.staff?.toString() || "N/A", inline: true },
                ],
            },
            userAdd: {
                title: "➕ Usuário Adicionado",
                color: colors.success,
                fields: [
                    { name: "📋 Ticket", value: data.channel?.toString() || "N/A", inline: true },
                    { name: "👤 Usuário", value: data.user?.toString() || "N/A", inline: true },
                    { name: "👮 Adicionado por", value: data.addedBy?.toString() || "N/A", inline: true },
                ],
            },
            userRemove: {
                title: "➖ Usuário Removido",
                color: colors.error,
                fields: [
                    { name: "📋 Ticket", value: data.channel?.toString() || "N/A", inline: true },
                    { name: "👤 Usuário", value: data.user?.toString() || "N/A", inline: true },
                    { name: "👮 Removido por", value: data.removedBy?.toString() || "N/A", inline: true },
                ],
            },
            ticketRename: {
                title: "✏️ Ticket Renomeado",
                color: colors.info,
                fields: [
                    { name: "📋 Ticket", value: data.channel?.toString() || "N/A", inline: true },
                    { name: "📝 Novo Nome", value: data.newName || "N/A", inline: true },
                    { name: "👤 Renomeado por", value: data.user?.toString() || "N/A", inline: true },
                ],
            },
            ticketTransfer: {
                title: "🔄 Ticket Transferido",
                color: colors.info,
                fields: [
                    { name: "📋 Ticket", value: data.channel?.toString() || "N/A", inline: true },
                    { name: "📁 Nova Categoria", value: data.newCategory?.name || "N/A", inline: true },
                    { name: "👤 Transferido por", value: data.user?.toString() || "N/A", inline: true },
                ],
            },
        };

        const cfg = embedConfigs[event];
        if (!cfg) return null;

        const embed = createEmbed("primary").setTitle(cfg.title).setColor(cfg.color).addFields(cfg.fields);

        if (data.ticketId) {
            embed.setFooter({ text: `Ticket ID: ${data.ticketId}` });
        }

        return embed;
    }
}

let loggerInstance = null;

/**
 * Obtém a instância do logger
 * @param {Client} client - Cliente Discord
 * @returns {TicketLogger}
 */
export function getLogger(client) {
    if (!loggerInstance && client) {
        loggerInstance = new TicketLogger(client);
    } else if (loggerInstance && client && loggerInstance.client !== client) {
        // Se o cliente mudou (bot foi reiniciado), criar nova instância
        loggerInstance = new TicketLogger(client);
    }
    return loggerInstance;
}

/**
 * Reseta a instância do logger
 * Útil quando o bot é reiniciado
 */
export function resetLogger() {
    loggerInstance = null;
}

export default TicketLogger;
