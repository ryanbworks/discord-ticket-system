import { ActivityType } from "discord.js";
import { getConfig } from "../lib/config.js";

export const name = "clientReady";
export const once = true;

export async function execute(client) {
    console.log("┌──────────────────────────────────────────┐");
    console.log(`│  ✓ Conectado: ${client.user.tag}`);
    console.log(`│  ✓ Servidores: ${client.guilds.cache.size}`);
    console.log(`│  ✓ Usuários: ${client.users.cache.size}`);
    console.log("└──────────────────────────────────────────┘");

    // Configurar status do bot
    const config = getConfig();
    const activity = config.bot?.activity;

    if (activity) {
        const activityTypes = {
            PLAYING: ActivityType.Playing,
            STREAMING: ActivityType.Streaming,
            LISTENING: ActivityType.Listening,
            WATCHING: ActivityType.Watching,
            COMPETING: ActivityType.Competing,
        };

        client.user.setActivity(activity.text, {
            type: activityTypes[activity.type] || ActivityType.Watching,
        });
    }

    // Definir status
    const status = config.bot?.status || "online";
    client.user.setStatus(status);

    console.log("\n✓ FOZ RP Suporte — Sistema operacional");
}
