import { handleTicketButton, handleTicketModal, handleTicketSelectMenu } from "../lib/tickets/interactions.js";
import { errorEmbed } from "../utils/embed.js";

export const name = "interactionCreate";

export async function execute(interaction, client) {
    // Slash Commands
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`Comando ${interaction.commandName} não encontrado.`);
            return;
        }

        try {
            await command.execute(interaction, client);
        } catch (error) {
            console.error(`Erro no comando ${interaction.commandName}:`, error);

            const errorMessage = {
                embeds: [errorEmbed("❌ Erro", "Ocorreu um erro ao executar este comando.")],
                ephemeral: true,
            };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    }

    // Botões
    else if (interaction.isButton()) {
        try {
            await handleTicketButton(interaction, client);
        } catch (error) {
            console.error("Erro ao processar botão:", error);

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    embeds: [errorEmbed("❌ Erro", "Ocorreu um erro ao processar esta ação.")],
                    ephemeral: true,
                });
            }
        }
    }

    // Select Menus
    else if (interaction.isStringSelectMenu()) {
        try {
            await handleTicketSelectMenu(interaction, client);
        } catch (error) {
            console.error("Erro ao processar select menu:", error);

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    embeds: [errorEmbed("❌ Erro", "Ocorreu um erro ao processar esta ação.")],
                    ephemeral: true,
                });
            }
        }
    }

    // Modals
    else if (interaction.isModalSubmit()) {
        try {
            await handleTicketModal(interaction, client);
        } catch (error) {
            console.error("Erro ao processar modal:", error);

            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        embeds: [errorEmbed("❌ Erro", "Ocorreu um erro ao processar este formulário.")],
                        ephemeral: true,
                    });
                } else if (interaction.deferred) {
                    await interaction.editReply({
                        embeds: [errorEmbed("❌ Erro", "Ocorreu um erro ao processar este formulário.")],
                    });
                }
            } catch (replyError) {
                // Ignorar erros ao tentar responder
                console.error("Não foi possível responder à interação:", replyError.message);
            }
        }
    }
}
