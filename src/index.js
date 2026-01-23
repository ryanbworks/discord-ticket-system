import { Client, Collection, GatewayIntentBits, Partials, REST, Routes } from "discord.js";
import { config } from "dotenv";
import { readdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { startAlertChecker } from "./lib/alertChecker.js";
import { loadConfig } from "./lib/config.js";
import { initDatabase } from "./lib/database.js";
import { startPanelRefresher } from "./lib/panelRefresher.js";
import { getTicketManager } from "./lib/tickets/manager.js";
import { getLogger } from "./utils/logger.js";

// Configurar .env
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Verificar token
if (!process.env.DISCORD_TOKEN) {
    console.error("❌ DISCORD_TOKEN não configurado no arquivo .env!");
    process.exit(1);
}

console.log("╔════════════════════════════════════════════════════╗");
console.log("║           FOZ RP — Sistema de Suporte              ║");
console.log("║                    v1.0.0                          ║");
console.log("╚════════════════════════════════════════════════════╝\n");

// Variável para armazenar o cliente atual
let currentClient = null;

// Função para criar um novo cliente Discord
function createClient() {
    return new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.DirectMessages,
        ],
        partials: [Partials.Channel, Partials.Message, Partials.User, Partials.GuildMember],
    });
}

// Criar cliente Discord inicial
let client = createClient();

// Collection de comandos
client.commands = new Collection();

// Carregar comandos
async function loadCommands() {
    const commandsPath = join(__dirname, "commands", "slash");
    const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith(".js"));

    for (const file of commandFiles) {
        const filePath = join(commandsPath, file);
        const command = await import(`file://${filePath}`);

        if ("data" in command && "execute" in command) {
            client.commands.set(command.data.name, command);
            console.log(`📝 Comando carregado: /${command.data.name}`);
        }
    }
}

// Registrar comandos slash no Discord
async function deployCommands() {
    try {
        console.log("\n🔄 Registrando comandos slash no Discord...");

        const commands = [];
        const commandsPath = join(__dirname, "commands", "slash");
        const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith(".js"));

        for (const file of commandFiles) {
            const filePath = join(commandsPath, file);
            const command = await import(`file://${filePath}`);

            if ("data" in command && "execute" in command) {
                commands.push(command.data.toJSON());
            }
        }

        const rest = new REST().setToken(process.env.DISCORD_TOKEN);

        await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), {
            body: commands,
        });

        console.log(`✅ ${commands.length} comandos slash registrados com sucesso!\n`);
    } catch (error) {
        console.warn("⚠️  Falha ao registrar comandos slash automaticamente:", error.message);
        console.warn("⚠️  Execute manualmente: npm run deploy");
        console.warn("⚠️  Verifique se CLIENT_ID e DISCORD_TOKEN estão corretos no .env\n");
        // Não lançar erro - permitir que o bot continue funcionando
    }
}

// Carregar eventos
async function loadEvents() {
    const eventsPath = join(__dirname, "events");
    const eventFiles = readdirSync(eventsPath).filter(file => file.endsWith(".js"));

    for (const file of eventFiles) {
        const filePath = join(eventsPath, file);
        const event = await import(`file://${filePath}`);

        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }
        console.log(`📡 Evento carregado: ${event.name}`);
    }
}

// Inicializar
async function init() {
    try {
        console.log("🔄 Carregando configuração...");
        // Carregar configuração
        loadConfig();

        console.log("🔄 Inicializando banco de dados...");
        // Inicializar banco de dados
        await initDatabase();

        // Se já existe um cliente, destruir antes de criar novo
        if (currentClient && currentClient.isReady()) {
            console.log("⚠️  Destruindo cliente anterior...");
            await currentClient.destroy();

            // Resetar instâncias singleton que dependem do cliente
            const { resetTicketManager } = await import("./lib/tickets/manager.js");
            const { resetLogger } = await import("./utils/logger.js");
            resetTicketManager();
            resetLogger();
        }

        // Criar novo cliente
        client = createClient();
        client.commands = new Collection();
        currentClient = client;

        console.log("🔄 Carregando comandos e eventos...\n");

        await loadCommands();
        await loadEvents();

        // Registrar comandos slash automaticamente
        await deployCommands();

        console.log("\n🔄 Conectando ao Discord...\n");

        // Inicializar managers depois do login
        client.once("clientReady", () => {
            console.log(`✅ Bot conectado como ${client.user.tag}`);
            getTicketManager(client);
            getLogger(client);
            startAlertChecker(client);
            startPanelRefresher(client);
        });

        await client.login(process.env.DISCORD_TOKEN);
        return client;
    } catch (error) {
        console.error("❌ Erro ao inicializar bot:", error);
        console.error("Stack trace:", error.stack);
        throw error;
    }
}

// Função para iniciar o bot (para uso pelo painel web)
export async function startBot() {
    return await init();
}

// Handler de erros
process.on("unhandledRejection", error => {
    console.error("❌ Unhandled promise rejection:", error);
    console.error("Stack:", error?.stack);
    process.exit(1);
});

process.on("uncaughtException", error => {
    console.error("❌ Uncaught exception:", error);
    console.error("Stack:", error?.stack);
    process.exit(1);
});

// Iniciar bot
(async () => {
    try {
        await init();
    } catch (error) {
        console.error("❌ Erro fatal ao iniciar bot:", error);
        console.error("Stack trace:", error?.stack);
        process.exit(1);
    }
})();
