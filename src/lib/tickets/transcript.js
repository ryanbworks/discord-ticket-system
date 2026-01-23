import { createTranscript as createHTMLTranscript } from "discord-html-transcripts";
import { createEmbed } from "../../utils/embed.js";
import { getColors, getTranscriptConfig } from "../config.js";

/**
 * Cria a transcrição de um ticket
 * @param {TextChannel} channel - Canal do ticket
 * @param {Client} client - Cliente Discord
 * @param {Object} ticket - Dados do ticket do banco
 */
export async function createTranscript(channel, client, ticket) {
    const config = getTranscriptConfig();

    if (!config.enabled) return null;

    try {
        const format = config.format || "html";

        let transcript;

        if (format === "html") {
            transcript = await createHTMLTranscript(channel, {
                limit: -1,
                returnType: "attachment",
                filename: `ticket-${ticket.ticket_number}.html`,
                saveImages: config.includeAttachments !== false,
                poweredBy: false,
                footerText: `Ticket #${ticket.ticket_number} | {number} mensagens`,
            });
        } else if (format === "json") {
            const messages = await channel.messages.fetch({ limit: 100 });
            const data = messages
                .map(m => ({
                    author: {
                        id: m.author.id,
                        username: m.author.username,
                        avatar: m.author.displayAvatarURL(),
                    },
                    content: m.content,
                    embeds: m.embeds.map(e => e.toJSON()),
                    attachments: m.attachments.map(a => a.url),
                    timestamp: m.createdTimestamp,
                }))
                .reverse();

            transcript = {
                attachment: Buffer.from(JSON.stringify(data, null, 2)),
                name: `ticket-${ticket.ticket_number}.json`,
            };
        } else {
            // Texto simples
            const messages = await channel.messages.fetch({ limit: 100 });
            const text = messages
                .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
                .map(m => `[${m.createdAt.toLocaleString("pt-BR")}] ${m.author.username}: ${m.content}`)
                .join("\n");

            transcript = {
                attachment: Buffer.from(text),
                name: `ticket-${ticket.ticket_number}.txt`,
            };
        }

        // Enviar para o canal de transcrições
        if (config.channelId) {
            const transcriptChannel = await client.channels.fetch(config.channelId).catch(() => null);

            if (transcriptChannel) {
                const colors = getColors();
                const creator = await client.users.fetch(ticket.user_id).catch(() => null);

                const embed = createEmbed("info")
                    .setTitle(`📝 Transcrição - Ticket #${ticket.ticket_number}`)
                    .addFields(
                        { name: "👤 Criador", value: creator?.toString() || ticket.user_id, inline: true },
                        { name: "📁 Categoria", value: ticket.category_id, inline: true },
                        {
                            name: "📅 Criado em",
                            value: `<t:${Math.floor(new Date(ticket.created_at).getTime() / 1000)}:F>`,
                            inline: true,
                        }
                    );

                if (ticket.closed_by) {
                    const closedBy = await client.users.fetch(ticket.closed_by).catch(() => null);
                    embed.addFields({
                        name: "🔒 Fechado por",
                        value: closedBy?.toString() || ticket.closed_by,
                        inline: true,
                    });
                }

                if (ticket.close_reason) {
                    embed.addFields({ name: "📝 Motivo", value: ticket.close_reason, inline: false });
                }

                await transcriptChannel.send({
                    embeds: [embed],
                    files: [transcript],
                });
            }
        }

        // Enviar para o usuário via DM
        if (config.sendToUser) {
            try {
                const user = await client.users.fetch(ticket.user_id);

                const embed = createEmbed("info")
                    .setTitle(`📝 Transcrição do seu Ticket #${ticket.ticket_number}`)
                    .setDescription("Seu ticket foi fechado. Segue a transcrição da conversa.");

                await user.send({
                    embeds: [embed],
                    files: [transcript],
                });
            } catch (error) {
                // Usuário pode ter DM desabilitada
                console.log("Não foi possível enviar transcrição via DM");
            }
        }

        return transcript;
    } catch (error) {
        console.error("Erro ao criar transcrição:", error);
        return null;
    }
}

export default { createTranscript };
