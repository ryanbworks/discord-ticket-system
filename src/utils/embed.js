import { EmbedBuilder } from "discord.js";
import { getColors, getConfig } from "../lib/config.js";

/**
 * Cria uma embed padrão com as cores do config
 * @param {string} type - Tipo da embed (primary, success, warning, error, info)
 * @returns {EmbedBuilder} Embed configurada
 */
export function createEmbed(type = "primary") {
    const colors = getColors();
    const config = getConfig();
    const color = colors[type] || colors.primary;

    const embed = new EmbedBuilder().setColor(color).setTimestamp();

    if (config.appearance?.footer) {
        embed.setFooter({ text: config.appearance.footer });
    }

    return embed;
}

/**
 * Cria uma embed de sucesso
 * @param {string} title - Título
 * @param {string} description - Descrição
 * @returns {EmbedBuilder}
 */
export function successEmbed(title, description) {
    return createEmbed("success").setTitle(title).setDescription(description);
}

/**
 * Cria uma embed de erro
 * @param {string} title - Título
 * @param {string} description - Descrição
 * @returns {EmbedBuilder}
 */
export function errorEmbed(title, description) {
    return createEmbed("error").setTitle(title).setDescription(description);
}

/**
 * Cria uma embed de aviso
 * @param {string} title - Título
 * @param {string} description - Descrição
 * @returns {EmbedBuilder}
 */
export function warningEmbed(title, description) {
    return createEmbed("warning").setTitle(title).setDescription(description);
}

/**
 * Cria uma embed de informação
 * @param {string} title - Título
 * @param {string} description - Descrição
 * @returns {EmbedBuilder}
 */
export function infoEmbed(title, description) {
    return createEmbed("info").setTitle(title).setDescription(description);
}

/**
 * Formata tempo em milissegundos para formato legível
 * @param {number} ms - Tempo em milissegundos
 * @returns {string} Tempo formatado
 */
export function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} dia${days > 1 ? "s" : ""}`;
    if (hours > 0) return `${hours} hora${hours > 1 ? "s" : ""}`;
    if (minutes > 0) return `${minutes} minuto${minutes > 1 ? "s" : ""}`;
    return `${seconds} segundo${seconds > 1 ? "s" : ""}`;
}

/**
 * Formata uma data para string
 * @param {Date} date - Data
 * @returns {string} Data formatada
 */
export function formatDate(date) {
    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(date);
}

/**
 * Trunca uma string se for muito longa
 * @param {string} str - String
 * @param {number} maxLength - Tamanho máximo
 * @returns {string} String truncada
 */
export function truncate(str, maxLength = 100) {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 3) + "...";
}

export default {
    createEmbed,
    successEmbed,
    errorEmbed,
    warningEmbed,
    infoEmbed,
    formatTime,
    formatDate,
    truncate,
};
