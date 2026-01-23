import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { getCategory, getColors, getConfig } from "../../lib/config.js";
import { getTicketAlert, getTicketByChannel, setTicketAlert } from "../../lib/database.js";
import { errorEmbed, successEmbed } from "../../utils/embed.js";

export const data = new SlashCommandBuilder()
    .setName("alertar")
    .setDescription("Alerta o usuário que o ticket será fechado se não houver resposta")
    .addIntegerOption(
        option =>
            option
                .setName("tempo")
                .setDescription("Tempo em minutos para o fechamento (padrão: 30)")
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(1440), // Máximo 24 horas
    )
    .addStringOption(option =>
        option.setName("motivo").setDescription("Motivo do alerta (opcional)").setRequired(false),
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

    // Verificar se o usuário tem o cargo de staff da categoria
    const category = getCategory(ticket.category_id);
    const config = getConfig();
    const alertConfig = config.alerts || {};

    // Verificar permissão (staffRoles da categoria ou adminRoles do alerts)
    const member = interaction.member;
    const hasPermission =
        member.permissions.has(PermissionFlagsBits.Administrator) ||
        category?.staffRoles?.some(roleId => member.roles.cache.has(roleId)) ||
        alertConfig.adminRoles?.some(roleId => member.roles.cache.has(roleId));

    if (!hasPermission) {
        await interaction.reply({
            embeds: [errorEmbed("❌ Erro", "Você não tem permissão para usar este comando!")],
            ephemeral: true,
        });
        return;
    }

    // Verificar se já existe um alerta ativo
    const existingAlert = await getTicketAlert(ticket.id);
    if (existingAlert && existingAlert.status === "pending") {
        const expiresAt = new Date(existingAlert.expires_at);
        const timeLeft = Math.ceil((expiresAt - new Date()) / 60000);

        await interaction.reply({
            embeds: [
                errorEmbed(
                    "⚠️ Alerta Ativo",
                    `Já existe um alerta ativo para este ticket.\nTempo restante: **${timeLeft} minuto(s)**`,
                ),
            ],
            ephemeral: true,
        });
        return;
    }

    const tempoMinutos = interaction.options.getInteger("tempo") || alertConfig.defaultTime || 30;
    const motivo = interaction.options.getString("motivo") || "Aguardando resposta do usuário";
    const colors = getColors();

    console.log(`🔔 Comando /alertar executado: Ticket ID ${ticket.id}, Tempo: ${tempoMinutos}min`);

    // Calcular tempo de expiração em UTC
    const expiresAt = new Date(Date.now() + tempoMinutos * 60000);

    // Salvar alerta no banco (já em UTC)
    await setTicketAlert(ticket.id, interaction.user.id, tempoMinutos, motivo);

    // Buscar o usuário do ticket
    const ticketUser = await client.users.fetch(ticket.user_id).catch(() => null);

    // Criar embed de alerta
    const alertEmbed = new EmbedBuilder()
        .setColor(colors.error)
        .setTitle("⚠️ Alerta de Inatividade")
        .setDescription(
            alertConfig.alertMessage ||
                `**{user}**, este ticket será **fechado automaticamente** em **{tempo}** se não houver resposta.\n\nPor favor, responda para manter o ticket aberto.`,
        )
        .addFields(
            { name: "⏰ Tempo para Fechamento", value: `${tempoMinutos} minuto(s)`, inline: true },
            { name: "📝 Motivo", value: motivo, inline: true },
            { name: "👮 Alertado por", value: interaction.user.toString(), inline: true },
        )
        .setFooter({ text: `Expira em: ${expiresAt.toLocaleString("pt-BR")}` })
        .setTimestamp();

    // Substituir variáveis na descrição
    let description = alertEmbed.data.description;
    description = description
        .replace("{user}", ticketUser?.toString() || "Usuário")
        .replace("{tempo}", `${tempoMinutos} minuto(s)`);
    alertEmbed.setDescription(description);

    await interaction.reply({
        content: ticketUser?.toString() || "",
        embeds: [alertEmbed],
    });

    // Confirmar para o staff
    await interaction.followUp({
        embeds: [
            successEmbed(
                "✅ Alerta Enviado",
                `O ticket será fechado automaticamente em **${tempoMinutos} minuto(s)** se o usuário não responder.`,
            ),
        ],
        ephemeral: true,
    });
}
