import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { getMessage } from "../../lib/config.js";
import { getTicketByChannel } from "../../lib/database.js";
import { getTicketManager } from "../../lib/tickets/manager.js";
import { errorEmbed, successEmbed } from "../../utils/embed.js";

export const data = new SlashCommandBuilder()
    .setName("remover")
    .setDescription("Remove um usuário do ticket")
    .addUserOption(option =>
        option.setName("usuario").setDescription("Usuário para remover do ticket").setRequired(true)
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

    const user = interaction.options.getUser("usuario");

    const manager = getTicketManager(client);
    const result = await manager.removeUser(interaction.channel, user, interaction.user);

    if (result.success) {
        await interaction.reply({
            embeds: [successEmbed("✅ Sucesso", getMessage("success", "userRemoved", { user: user.toString() }))],
        });
    } else {
        await interaction.reply({
            embeds: [errorEmbed("❌ Erro", result.error)],
            ephemeral: true,
        });
    }
}
