import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { getMessage } from "../../lib/config.js";
import { getTicketByChannel } from "../../lib/database.js";
import { errorEmbed, successEmbed } from "../../utils/embed.js";
import { getLogger } from "../../utils/logger.js";

export const data = new SlashCommandBuilder()
    .setName("renomear")
    .setDescription("Renomeia o ticket atual")
    .addStringOption(option =>
        option
            .setName("nome")
            .setDescription("Novo nome para o ticket")
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(100)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction, client) {
    const ticket = await getTicketByChannel(interaction.channel.id);

    if (!ticket) {
        await interaction.reply({
            embeds: [errorEmbed("❌ Erro", "Este canal não é um ticket!")],
            ephemeral: true,
        });
        return;
    }

    const newName = interaction.options
        .getString("nome")
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .substring(0, 100);

    try {
        await interaction.channel.setName(newName);

        // Log
        const logger = getLogger(client);
        await logger.log("ticketRename", {
            channel: interaction.channel,
            newName,
            user: interaction.user,
            ticketId: ticket.id,
        });

        await interaction.reply({
            embeds: [successEmbed("✅ Sucesso", getMessage("success", "ticketRenamed", { name: newName }))],
        });
    } catch (error) {
        console.error("Erro ao renomear ticket:", error);
        await interaction.reply({
            embeds: [errorEmbed("❌ Erro", "Não foi possível renomear o ticket.")],
            ephemeral: true,
        });
    }
}
