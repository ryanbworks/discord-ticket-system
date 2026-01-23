import { SlashCommandBuilder } from "discord.js";
import { getTicketByChannel } from "../../lib/database.js";
import { getTicketManager } from "../../lib/tickets/manager.js";
import { createEmbed, errorEmbed } from "../../utils/embed.js";

export const data = new SlashCommandBuilder()
    .setName("fechar")
    .setDescription("Fecha o ticket atual")
    .addStringOption(option =>
        option.setName("motivo").setDescription("Motivo do fechamento (opcional)").setRequired(false)
    );

export async function execute(interaction, client) {
    const ticket = await getTicketByChannel(interaction.channel.id);

    if (!ticket) {
        await interaction.reply({
            embeds: [errorEmbed("❌ Erro", "Este canal não é um ticket!")],
            ephemeral: true,
        });
        return;
    }

    const reason = interaction.options.getString("motivo");

    // Mostrar embed de confirmação
    const embed = createEmbed("warning")
        .setTitle("🔒 Fechando Ticket")
        .setDescription("O ticket será fechado em alguns segundos...");

    if (reason) {
        embed.addFields({ name: "📝 Motivo", value: reason });
    }

    await interaction.reply({ embeds: [embed] });

    // Aguardar um pouco e fechar
    setTimeout(async () => {
        const manager = getTicketManager(client);
        await manager.close(interaction.channel, interaction.user, reason);
    }, 2000);
}
