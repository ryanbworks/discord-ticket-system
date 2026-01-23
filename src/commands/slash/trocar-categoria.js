import {
    ActionRowBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
} from "discord.js";
import { getAllCategories, getColors } from "../../lib/config.js";
import { getPool } from "../../lib/database.js";

export const data = new SlashCommandBuilder()
    .setName("trocar-categoria")
    .setDescription("Move o ticket para outra categoria")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction, client) {
    const colors = getColors();

    await interaction.deferReply({ ephemeral: true });

    try {
        const pool = getPool();

        // Verificar se está em um canal de ticket
        const [tickets] = await pool.query("SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'", [
            interaction.channel.id,
        ]);

        if (tickets.length === 0) {
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(colors.error)
                        .setTitle("❌ Ticket Não Encontrado")
                        .setDescription("Este comando só pode ser usado em canais de tickets abertos."),
                ],
            });
            return;
        }

        const ticket = tickets[0];
        const categories = getAllCategories();
        const currentCategory = categories.find(c => c.id === ticket.category_id);

        // Criar select menu com as categorias disponíveis
        const options = categories
            .filter(c => c.id !== ticket.category_id) // Remover categoria atual
            .map(cat => ({
                label: cat.name,
                description: cat.description.substring(0, 100),
                value: cat.id,
                emoji: cat.emoji || "📁",
            }));

        if (options.length === 0) {
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(colors.error)
                        .setTitle("❌ Sem Categorias Disponíveis")
                        .setDescription("Não há outras categorias disponíveis para trocar."),
                ],
            });
            return;
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`change_category_${ticket.id}`)
            .setPlaceholder("Selecione a nova categoria")
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setColor(colors.info)
                    .setTitle("🔄 Trocar Categoria do Ticket")
                    .setDescription(
                        `**Ticket atual:** #${ticket.ticket_number.toString().padStart(4, "0")}\n` +
                            `**Categoria atual:** ${currentCategory?.emoji || "📁"} ${currentCategory?.name || ticket.category_id}\n\n` +
                            `Selecione a nova categoria no menu abaixo:`,
                    ),
            ],
            components: [row],
        });
    } catch (error) {
        console.error("Erro no comando trocar-categoria:", error);
        await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setColor(colors.error)
                    .setTitle("❌ Erro")
                    .setDescription(`Ocorreu um erro ao executar o comando:\n\`\`\`${error.message}\`\`\``),
            ],
        });
    }
}
