import { cancelAlertOnResponse, getTicketAlert, getTicketByChannel, updateLastMessage } from "../lib/database.js";

export const name = "messageCreate";
export const once = false;

export async function execute(message, client) {
    // Ignorar mensagens de bots
    if (message.author.bot) return;

    // Ignorar DMs
    if (!message.guild) return;

    // Verificar se é um canal de ticket
    const ticket = await getTicketByChannel(message.channel.id);
    if (!ticket) return;

    // Atualizar último momento de atividade do ticket
    await updateLastMessage(message.channel.id);

    // Se a mensagem for do usuário que criou o ticket, cancelar alertas pendentes
    if (message.author.id === ticket.user_id) {
        const alert = await getTicketAlert(ticket.id);

        if (alert && alert.status === "pending") {
            await cancelAlertOnResponse(ticket.id);

            // Notificar que o alerta foi cancelado
            await message.channel
                .send({
                    content: `✅ **Alerta cancelado!** ${message.author}, seu ticket permanecerá aberto.`,
                })
                .then(msg => {
                    // Apagar a mensagem após 10 segundos
                    setTimeout(() => msg.delete().catch(() => {}), 10000);
                })
                .catch(() => {});
        }
    }
}
