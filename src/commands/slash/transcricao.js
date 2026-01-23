import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { getTicketByChannel } from "../../lib/database.js";
import { createTranscript } from "../../lib/tickets/transcript.js";
import { errorEmbed, successEmbed } from "../../utils/embed.js";

export const data = new SlashCommandBuilder()
    .setName("transcricao")
    .setDescription("Gera a transcrição do ticket atual")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const ticket = await getTicketByChannel(interaction.channel.id);

    if (!ticket) {
        await interaction.editReply({
            embeds: [errorEmbed("❌ Erro", "Este canal não é um ticket!")],
        });
        return;
    }

    try {
        const transcript = await createTranscript(interaction.channel, client, ticket);

        if (transcript) {
            await interaction.editReply({
                embeds: [successEmbed("✅ Sucesso", "Transcrição gerada!")],
                files: [transcript],
            });
        } else {
            await interaction.editReply({
                embeds: [errorEmbed("❌ Erro", "Não foi possível gerar a transcrição.")],
            });
        }
    } catch (error) {
        console.error("Erro ao gerar transcrição:", error);
        await interaction.editReply({
            embeds: [errorEmbed("❌ Erro", "Erro ao gerar transcrição.")],
        });
    }
}
