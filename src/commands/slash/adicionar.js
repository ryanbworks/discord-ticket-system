import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { getMessage } from "../../lib/config.js";
import { getTicketByChannel } from "../../lib/database.js";
import { getTicketManager } from "../../lib/tickets/manager.js";
import { errorEmbed, successEmbed } from "../../utils/embed.js";

export const data = new SlashCommandBuilder()
    .setName("adicionar")
    .setDescription("Adiciona um usuário ao ticket")
    .addUserOption(option =>
        option.setName("usuario").setDescription("Usuário para adicionar ao ticket").setRequired(true)
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

    if (user.bot) {
        await interaction.reply({
            embeds: [errorEmbed("❌ Erro", "Você não pode adicionar bots ao ticket!")],
            ephemeral: true,
        });
        return;
    }

    const manager = getTicketManager(client);
    const result = await manager.addUser(interaction.channel, user, interaction.user);

    if (result.success) {
        await interaction.reply({
            embeds: [successEmbed("✅ Sucesso", getMessage("success", "userAdded", { user: user.toString() }))],
        });
    } else {
        await interaction.reply({
            embeds: [errorEmbed("❌ Erro", result.error)],
            ephemeral: true,
        });
    }
}
