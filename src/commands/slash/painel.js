import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    PermissionFlagsBits,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
} from "discord.js";
import { getCategory, getColors, getConfig, getMessage, getPanel } from "../../lib/config.js";

export const data = new SlashCommandBuilder()
    .setName("painel")
    .setDescription("Envia o painel de tickets")
    .addStringOption(option =>
        option
            .setName("painel_id")
            .setDescription("ID do painel (opcional, usa o primeiro se não especificado)")
            .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction, client) {
    await interaction.deferReply({ flags: 64 }); // 64 = Ephemeral

    const config = getConfig();
    const panelId = interaction.options.getString("painel_id");

    // Obter painel
    let panel;
    if (panelId) {
        panel = getPanel(panelId);
    } else {
        panel = config.panels?.[0];
    }

    if (!panel) {
        await interaction.editReply({
            content: "❌ Nenhum painel configurado!",
        });
        return;
    }

    // Obter categorias do painel
    const categories = [];
    for (const catId of panel.categories || []) {
        const cat = getCategory(catId);
        if (cat) categories.push(cat);
    }

    if (categories.length === 0) {
        await interaction.editReply({
            content: "❌ Nenhuma categoria válida encontrada para este painel!",
        });
        return;
    }

    const colors = getColors();

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
            label: cat.name.replace(/^[\p{Emoji}]/u, "").trim(),
            description: (cat.description || "").substring(0, 100),
            value: cat.id,
            emoji: cat.emoji || undefined,
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId("ticket_category_select")
            .setPlaceholder("Selecione uma categoria...")
            .addOptions(options);

        components.push(new ActionRowBuilder().addComponents(selectMenu));
    } else {
        // Botões (padrão)
        const rows = [];
        let currentRow = new ActionRowBuilder();

        for (let i = 0; i < categories.length; i++) {
            const cat = categories[i];

            const button = new ButtonBuilder()
                .setCustomId(`ticket_create_${cat.id}`)
                .setLabel(
                    cat.name
                        .replace(/^[\p{Emoji}]/u, "")
                        .trim()
                        .substring(0, 80)
                )
                .setStyle(ButtonStyle.Primary);

            if (cat.emoji) {
                button.setEmoji(cat.emoji);
            }

            currentRow.addComponents(button);

            // Discord limita 5 botões por linha
            if ((i + 1) % 5 === 0 || i === categories.length - 1) {
                rows.push(currentRow);
                currentRow = new ActionRowBuilder();
            }
        }

        components = rows.filter(row => row.components.length > 0);
    }

    // Enviar no canal atual
    await interaction.channel.send({
        embeds: [embed],
        components: components,
    });

    await interaction.editReply({
        content: getMessage("success", "panelSent"),
    });
}
