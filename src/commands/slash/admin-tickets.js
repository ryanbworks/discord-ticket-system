import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { getColors } from "../../lib/config.js";
import { getPool } from "../../lib/database.js";

export const data = new SlashCommandBuilder()
    .setName("admin-tickets")
    .setDescription("Comandos administrativos para gerenciar tickets")
    .addSubcommand(subcommand =>
        subcommand
            .setName("info")
            .setDescription("Informações detalhadas sobre um ticket")
            .addStringOption(option =>
                option.setName("canal_id").setDescription("ID do canal do ticket").setRequired(true),
            ),
    )
    .addSubcommand(subcommand => subcommand.setName("estatisticas").setDescription("Mostra estatísticas dos tickets"))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction, client) {
    const colors = getColors();
    const subcommand = interaction.options.getSubcommand();

    await interaction.deferReply({ ephemeral: true });

    try {
        const pool = getPool();

        if (subcommand === "info") {
            const channelId = interaction.options.getString("canal_id");
            const [tickets] = await pool.query("SELECT * FROM tickets WHERE channel_id = ?", [channelId]);

            if (tickets.length === 0) {
                await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(colors.error)
                            .setTitle("❌ Ticket Não Encontrado")
                            .setDescription(`Nenhum ticket encontrado com o canal ID: \`${channelId}\``),
                    ],
                });
                return;
            }

            const ticket = tickets[0];
            const user = await client.users.fetch(ticket.user_id).catch(() => null);
            const claimedBy = ticket.claimed_by ? await client.users.fetch(ticket.claimed_by).catch(() => null) : null;

            const embed = new EmbedBuilder()
                .setColor(ticket.status === "open" ? colors.success : colors.error)
                .setTitle(`🎫 Ticket #${ticket.ticket_number.toString().padStart(4, "0")}`)
                .addFields(
                    { name: "📌 Status", value: ticket.status === "open" ? "🟢 Aberto" : "🔴 Fechado", inline: true },
                    { name: "👤 Usuário", value: user ? user.toString() : ticket.user_id, inline: true },
                    {
                        name: "📁 Categoria",
                        value: ticket.category_id || "N/A",
                        inline: true,
                    },
                    {
                        name: "🙋 Assumido por",
                        value: claimedBy ? claimedBy.toString() : "Ninguém",
                        inline: true,
                    },
                    {
                        name: "📅 Criado em",
                        value: `<t:${Math.floor(new Date(ticket.created_at).getTime() / 1000)}:F>`,
                        inline: true,
                    },
                    {
                        name: "💬 Última mensagem",
                        value: `<t:${Math.floor(new Date(ticket.last_message_at).getTime() / 1000)}:R>`,
                        inline: true,
                    },
                )
                .setTimestamp();

            if (ticket.closed_at) {
                const closedBy = ticket.closed_by ? await client.users.fetch(ticket.closed_by).catch(() => null) : null;
                embed.addFields(
                    {
                        name: "🔒 Fechado em",
                        value: `<t:${Math.floor(new Date(ticket.closed_at).getTime() / 1000)}:F>`,
                        inline: true,
                    },
                    {
                        name: "👮 Fechado por",
                        value: closedBy ? closedBy.toString() : ticket.closed_by,
                        inline: true,
                    },
                );

                if (ticket.close_reason) {
                    embed.addFields({ name: "📝 Motivo", value: ticket.close_reason, inline: false });
                }
            }

            // Buscar membros do ticket
            const [members] = await pool.query("SELECT * FROM ticket_members WHERE ticket_id = ?", [ticket.id]);
            if (members.length > 0) {
                const memberList = await Promise.all(
                    members.slice(0, 10).map(async m => {
                        const u = await client.users.fetch(m.user_id).catch(() => null);
                        return u ? u.toString() : m.user_id;
                    }),
                );
                embed.addFields({
                    name: `👥 Membros (${members.length})`,
                    value: memberList.join(", "),
                    inline: false,
                });
            }

            await interaction.editReply({ embeds: [embed] });
        } else if (subcommand === "estatisticas") {
            const [stats] = await pool.query(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as abertos,
                    SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as fechados,
                    AVG(CASE WHEN closed_at IS NOT NULL 
                        THEN TIMESTAMPDIFF(MINUTE, created_at, closed_at) 
                        ELSE NULL END) as tempo_medio_minutos
                FROM tickets
            `);

            const [categories] = await pool.query(`
                SELECT category_id, COUNT(*) as count 
                FROM tickets 
                GROUP BY category_id 
                ORDER BY count DESC 
                LIMIT 5
            `);

            const [recentTickets] = await pool.query(`
                SELECT COUNT(*) as count 
                FROM tickets 
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            `);

            const statData = stats[0];
            const tempoMedio = statData.tempo_medio_minutos ? Math.round(statData.tempo_medio_minutos) : 0;

            const embed = new EmbedBuilder()
                .setColor(colors.primary)
                .setTitle("📊 Estatísticas de Tickets")
                .addFields(
                    {
                        name: "📈 Totais",
                        value: `**Total**: ${statData.total}\n**Abertos**: 🟢 ${statData.abertos}\n**Fechados**: 🔴 ${statData.fechados}`,
                        inline: true,
                    },
                    {
                        name: "⏱️ Tempo Médio",
                        value: tempoMedio > 0 ? `${Math.floor(tempoMedio / 60)}h ${tempoMedio % 60}m` : "N/A",
                        inline: true,
                    },
                    {
                        name: "📅 Últimos 7 dias",
                        value: `${recentTickets[0].count} tickets`,
                        inline: true,
                    },
                )
                .setTimestamp();

            if (categories.length > 0) {
                const catList = categories.map(c => `**${c.category_id}**: ${c.count} tickets`).join("\n");
                embed.addFields({ name: "📁 Top Categorias", value: catList, inline: false });
            }

            await interaction.editReply({ embeds: [embed] });
        }
    } catch (error) {
        console.error("Erro no comando admin-tickets:", error);
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
