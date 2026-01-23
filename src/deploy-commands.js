import { REST, Routes } from "discord.js";
import { config } from "dotenv";
import { readdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const commands = [];
const commandsPath = join(__dirname, "commands", "slash");

// Carregar comandos
const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
    const command = await import(`file://${filePath}`);

    if ("data" in command && "execute" in command) {
        commands.push(command.data.toJSON());
        console.log(`📝 Comando carregado: ${command.data.name}`);
    }
}

// Deploy
const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`\n🔄 Registrando ${commands.length} comandos...`);

        const data = await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), {
            body: commands,
        });

        console.log(`✅ ${data.length} comandos registrados com sucesso!\n`);
    } catch (error) {
        console.error("❌ Erro ao registrar comandos:", error);
    }
})();
