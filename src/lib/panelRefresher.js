import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } from "discord.js";
import { getCategory, getColors, getConfig } from "./config.js";

let refreshInterval = null;
let lastRefreshHour = -1;

/**
 * Inicia o sistema de refresh automático do painel
 * @param {Client} client - Cliente Discord
 */
export function startPanelRefresher(client) {
    const config = getConfig();

    if (!config.panels || config.panels.length === 0) {
        console.log("⏸️  Nenhum painel configurado para refresh automático.");
        return;
    }

    console.log("🔄 Sistema de refresh de painel iniciado.");

    // Verificar a cada 1 minuto se está no horário de refresh
    refreshInterval = setInterval(() => {
        checkAndRefreshPanels(client);
    }, 60000); // 60 segundos

    // Verificar imediatamente ao iniciar
    checkAndRefreshPanels(client);
}

/**
 * Para o sistema de refresh de painéis
 */
export function stopPanelRefresher() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
        lastRefreshHour = -1;
        console.log("⏹️  Sistema de refresh de painel parado.");
    }
}

/**
 * Verifica se está no horário de refresh e refresca os painéis
 * @param {Client} client - Cliente Discord
 */
async function checkAndRefreshPanels(client) {
    try {
        const config = getConfig();
        const businessHours = config.businessHours;

        if (!businessHours || !businessHours.enabled) {
            return;
        }

        const timezone = businessHours.timezone || "America/Sao_Paulo";
        const now = new Date();
        const localTime = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
        const currentHour = localTime.getHours();
        const currentMinute = localTime.getMinutes();
        const currentDay = localTime.getDay();

        // Procurar horário do dia atual
        const todaySchedule = businessHours.schedule?.find(s => s.day === currentDay);

        if (!todaySchedule || !todaySchedule.periods) {
            return;
        }

        // Verificar se estamos no início de algum período (hora exata com margem de 1 minuto)
        const shouldRefresh = todaySchedule.periods.some(period => {
            const isStartTime = period.startHour === currentHour && period.startMinute === currentMinute;
            return isStartTime;
        });

        // Evitar múltiplos refreshes na mesma hora
        if (shouldRefresh && lastRefreshHour !== currentHour) {
            lastRefreshHour = currentHour;
            console.log(`🔄 Iniciando refresh dos painéis às ${currentHour}:${String(currentMinute).padStart(2, "0")}`);

            // Refresh todos os painéis configurados
            for (const panel of config.panels || []) {
                await refreshPanel(client, panel);
            }
        }
    } catch (error) {
        console.error("Erro ao verificar refresh de painéis:", error);
    }
}

/**
 * Refresca um painel específico
 * @param {Client} client - Cliente Discord
 * @param {Object} panelConfig - Configuração do painel
 */
async function refreshPanel(client, panelConfig) {
    try {
        // Verificar se o painel tem autoRefresh habilitado
        if (panelConfig.autoRefresh === false) {
            return;
        }

        if (!panelConfig.channelId) {
            console.warn(`⚠️  Painel ${panelConfig.id} não tem channelId configurado.`);
            return;
        }

        // Verificar se o client está pronto
        if (!client.isReady()) {
            console.warn(`⚠️  Client não está pronto para refresh do painel ${panelConfig.id}.`);
            return;
        }

        const channel = await discordApiCall(() => client.channels.fetch(panelConfig.channelId)).catch(() => null);

        if (!channel) {
            console.warn(`⚠️  Canal ${panelConfig.channelId} não encontrado para o painel ${panelConfig.id}.`);
            return;
        }

        // Buscar mensagens recentes do canal (últimas 10)
        const messages = await discordApiCall(() => channel.messages.fetch({ limit: 10 }));

        // Procurar por mensagens do bot com embeds (painéis)
        const botMessages = messages.filter(msg => msg.author.id === client.user.id && msg.embeds.length > 0);

        // Deletar mensagens antigas do painel
        for (const [, msg] of botMessages) {
            try {
                await discordApiCall(() => msg.delete());
                console.log(`🗑️  Mensagem antiga do painel deletada.`);
            } catch (error) {
                console.error(`Erro ao deletar mensagem antiga:`, error.message);
            }
        }

        // Criar novo painel
        await sendNewPanel(client, channel, panelConfig);

        console.log(`✅ Painel ${panelConfig.id} refreshado com sucesso.`);
    } catch (error) {
        console.error(`Erro ao refreshar painel ${panelConfig.id}:`, error);
    }
}

/**
 * Envia um novo painel no canal
 * @param {Client} client - Cliente Discord
 * @param {Channel} channel - Canal onde enviar
 * @param {Object} panel - Configuração do painel
 */
async function sendNewPanel(client, channel, panel) {
    const config = getConfig();
    const colors = getColors();

    // Obter categorias do painel
    const categories = [];
    for (const catId of panel.categories || []) {
        const cat = getCategory(catId);
        if (cat) categories.push(cat);
    }

    if (categories.length === 0) {
        console.warn(`⚠️  Nenhuma categoria válida encontrada para o painel ${panel.id}.`);
        return;
    }

    // Processar descrição com variáveis
    let description = panel.description || "Clique no botão abaixo para abrir um ticket.";

    // Substituir variável {horario}
    if (panel.horario) {
        description = description.replace(/{horario}/g, panel.horario);
    }

    // Criar embed
    const embed = new EmbedBuilder()
        .setTitle(panel.title || "🎫 Sistema de Tickets")
        .setDescription(description)
        .setColor(panel.color || colors.error)
        .setTimestamp();

    if (panel.image) {
        embed.setImage(panel.image);
    }

    if (panel.thumbnail) {
        embed.setThumbnail(panel.thumbnail);
    }

    const footer = config.appearance?.footer;
    if (footer) {
        embed.setFooter({ text: footer });
    }

    // Criar componentes
    let components = [];

    if (panel.type === "selectMenu") {
        // Select Menu
        const options = categories.map(cat => ({
            label: cat.name,
            value: cat.id,
            description: cat.description?.substring(0, 100) || "Abrir ticket",
            emoji: cat.emoji || "🎫",
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId("ticket_select")
            .setPlaceholder("Escolha uma categoria...")
            .addOptions(options);

        components.push(new ActionRowBuilder().addComponents(selectMenu));
    } else {
        // Buttons
        const buttons = categories.map(cat =>
            new ButtonBuilder()
                .setCustomId(`ticket_${cat.id}`)
                .setLabel(cat.name)
                .setEmoji(cat.emoji || "🎫")
                .setStyle(ButtonStyle.Primary),
        );

        // Discord permite máximo 5 botões por row
        for (let i = 0; i < buttons.length; i += 5) {
            const row = new ActionRowBuilder().addComponents(buttons.slice(i, i + 5));
            components.push(row);
        }
    }

    // Enviar painel
    await channel.send({
        embeds: [embed],
        components: components,
    });
}

export default {
    startPanelRefresher,
    stopPanelRefresher,
};
