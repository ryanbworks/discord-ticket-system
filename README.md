# 🎫 FOZ RP — Sistema de Suporte (Ticket Bot)

<div align="center">

![Discord.js](https://img.shields.io/badge/discord.js-v14.16.3-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-v18%2B-green.svg)
![MySQL](https://img.shields.io/badge/mysql-8.0%2B-orange.svg)
![License](https://img.shields.io/badge/license-MIT-purple.svg)

**Sistema profissional de tickets para Discord com múltiplas categorias, alertas automáticos, transcrições e avaliações.**

[Funcionalidades](#-funcionalidades) • [Instalação](#-instalação) • [Configuração](#%EF%B8%8F-configuração) • [Comandos](#-comandos) • [Deploy](#-deploy)

</div>

---

## 📋 Sobre o Projeto

Sistema de suporte avançado desenvolvido para o servidor **FOZ RP**, com foco em organização, automação e experiência do usuário. Utiliza Discord.js v14, banco de dados MySQL e sistema de painéis interativos.

### ✨ Destaques

- **🎨 Painéis Personalizáveis** — Interface visual com botões e select menus
- **📂 Múltiplas Categorias** — Suporte geral, denúncias, whitelist, parcerias e mais
- **⏰ Alertas Automáticos** — Fecha tickets inativos automaticamente
- **📝 Transcrições HTML** — Histórico completo de conversas
- **⭐ Sistema de Avaliações** — Feedback dos usuários (1-5 estrelas)
- **🔄 Retry Automático** — Tratamento de erros de rede e API
- **🐳 Docker Ready** — Containerização completa com docker-compose

---

## 🚀 Funcionalidades

### Sistema de Tickets

- ✅ Criação de tickets com modal de perguntas personalizadas
- ✅ Limite de tickets por usuário e por categoria
- ✅ Cooldown configurável entre tickets
- ✅ Claim/Unclaim de tickets por staff
- ✅ Adicionar/remover membros de tickets
- ✅ Renomear canais de tickets
- ✅ Trocar categoria de tickets abertos
- ✅ Fechar tickets com motivo opcional
- ✅ Transcrições automáticas ao fechar

### Alertas de Inatividade

- ⏰ Alerta usuários inativos com prazo configurável
- ⏰ Fechamento automático após expiração
- ⏰ Notificações no canal e logs

### Sistema de Avaliação

- ⭐ Avaliação de 1 a 5 estrelas via DM
- ⭐ Comentários opcionais dos usuários
- ⭐ Canal dedicado para avaliações
- ⭐ Tracking de atendentes responsáveis

### Administração

- 🔧 Estatísticas completas de tickets
- 🔧 Informações detalhadas por ticket
- 🔧 Painel de administração
- 🔧 Logs automáticos de ações

### Automação

- 🤖 Registro automático de slash commands
- 🤖 Refresh automático de painéis
- 🤖 Retry em falhas de conexão
- 🤖 Verificação de horário de atendimento

---

## 📦 Instalação

### Pré-requisitos

- **Node.js** 18.x ou superior
- **MySQL** 8.0 ou superior
- **Git**
- **Conta Discord** com permissões de desenvolvedor

### 1. Clone o Repositório

```bash
git clone https://github.com/ryanbworks/TicketBot-discord.git
cd TicketBot-discord
```

### 2. Instale as Dependências

```bash
npm install
```

### 3. Configure o Banco de Dados

Execute o script SQL para criar as tabelas necessárias:

```sql
-- Tabela de tickets
CREATE TABLE IF NOT EXISTS tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL,
    channel_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    category_id VARCHAR(50) NOT NULL,
    ticket_number INT NOT NULL,
    status ENUM('open', 'closed') DEFAULT 'open',
    claimed_by VARCHAR(20) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP NULL,
    closed_by VARCHAR(20) DEFAULT NULL,
    close_reason TEXT DEFAULT NULL,
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_channel (channel_id),
    INDEX idx_user (user_id),
    INDEX idx_status (status)
);

-- Tabela de respostas do modal
CREATE TABLE IF NOT EXISTS ticket_responses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);

-- Tabela de membros do ticket
CREATE TABLE IF NOT EXISTS ticket_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    added_by VARCHAR(20) NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    UNIQUE KEY unique_ticket_member (ticket_id, user_id)
);

-- Tabela de cooldowns
CREATE TABLE IF NOT EXISTS ticket_cooldowns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    category_id VARCHAR(50) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_category (user_id, category_id),
    INDEX idx_expires (expires_at)
);

-- Tabela de alertas
CREATE TABLE IF NOT EXISTS ticket_alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT NOT NULL,
    alerted_by VARCHAR(20) NOT NULL,
    duration_minutes INT NOT NULL,
    reason TEXT,
    expires_at TIMESTAMP NOT NULL,
    status ENUM('pending', 'executed', 'cancelled') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    INDEX idx_expires (expires_at, status)
);

-- Tabela de avaliações
CREATE TABLE IF NOT EXISTS ticket_ratings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    UNIQUE KEY unique_ticket_rating (ticket_id)
);
```

### 4. Configure as Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# Discord
DISCORD_TOKEN=seu_token_aqui
CLIENT_ID=seu_client_id_aqui
GUILD_ID=id_do_seu_servidor

# Banco de Dados MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_NAME=nome_do_banco

# Ambiente
NODE_ENV=production
```

### 5. Configure o Bot

Edite o arquivo `config.yml` com as configurações do seu servidor:

- IDs de categorias do Discord
- IDs de cargos de staff
- Mensagens personalizadas
- Cores das embeds
- Configurações de alertas e avaliações

---

## ⚙️ Configuração

### Discord Developer Portal

1. Acesse [Discord Developer Portal](https://discord.com/developers/applications)
2. Crie uma nova aplicação
3. Vá em **Bot** e clique em **Add Bot**
4. Copie o **Token** e adicione no `.env`
5. Em **OAuth2 > General**, copie o **Client ID** para o `.env`
6. Habilite as seguintes **Privileged Gateway Intents**:
    - ✅ Server Members Intent
    - ✅ Message Content Intent

### Convidar o Bot

Use este link substituindo `CLIENT_ID` pelo seu:

```
https://discord.com/oauth2/authorize?client_id=CLIENT_ID&permissions=8&scope=bot%20applications.commands
```

### Configuração do config.yml

#### Categorias de Tickets

Cada categoria pode ter:

```yaml
- id: "suporte" # ID interno da categoria
  name: "Suporte Geral" # Nome exibido
  description: "Dúvidas e problemas" # Descrição
  emoji: "🎧" # Emoji do botão
  discordCategory: "ID_CATEGORIA_DISCORD" # ID da categoria no Discord
  staffRoles: # Cargos que podem ver
      - "ID_CARGO_1"
      - "ID_CARGO_2"
  pingRoles: # Cargos notificados
      - "ID_CARGO_1"
  channelName: "suporte-{username}" # Formato do nome do canal
  openingMessage: | # Mensagem inicial
      Olá, {user}!
      Seu ticket foi aberto.
  memberLimit: 1 # Tickets por usuário
  totalLimit: 50 # Total de tickets
  cooldown: 300000 # Cooldown em ms (5 min)
  questions: # Perguntas do modal
      - label: "Assunto"
        placeholder: "Descreva o problema..."
        required: true
        minLength: 5
        maxLength: 100
        style: "short"
```

#### Variáveis Disponíveis

**Para channelName:**

- `{number}` — Número do ticket (0001, 0002...)
- `{username}` — Nome do usuário
- `{userid}` — ID do usuário
- `{category}` — ID da categoria

**Para openingMessage:**

- `{user}` — Menção do usuário
- `{username}` — Nome do usuário
- `{userid}` — ID do usuário
- `{category}` — Nome da categoria

---

## 🎮 Comandos

### Comandos Slash (/)

| Comando                          | Descrição                         | Permissão     |
| -------------------------------- | --------------------------------- | ------------- |
| `/painel`                        | Cria painel de tickets com botões | Administrador |
| `/fechar [motivo]`               | Fecha o ticket atual              | Staff         |
| `/adicionar <usuário>`           | Adiciona membro ao ticket         | Staff         |
| `/remover <usuário>`             | Remove membro do ticket           | Staff         |
| `/renomear <nome>`               | Renomeia o canal do ticket        | Staff         |
| `/alertar [tempo] [motivo]`      | Alerta sobre inatividade          | Staff         |
| `/transcricao`                   | Gera transcrição do ticket        | Staff         |
| `/trocar-categoria`              | Move ticket para outra categoria  | Staff         |
| `/admin-tickets info <canal_id>` | Mostra info de um ticket          | Admin         |
| `/admin-tickets estatisticas`    | Estatísticas gerais               | Admin         |

### Comandos de Manutenção

```bash
# Registrar comandos slash manualmente
npm run deploy

# Iniciar o bot
npm start

# Modo desenvolvimento
npm run dev
```

---

## 🐳 Deploy

### Deploy com Docker

1. **Configure o docker-compose.yml:**

```yaml
version: "3.8"

services:
    bot:
        build: .
        restart: unless-stopped
        env_file:
            - .env
        volumes:
            - ./data:/app/data
            - ./config.yml:/app/config.yml
        depends_on:
            - mysql

    mysql:
        image: mysql:8.0
        restart: unless-stopped
        environment:
            MYSQL_ROOT_PASSWORD: ${DB_PASSWORD}
            MYSQL_DATABASE: ${DB_NAME}
            MYSQL_USER: ${DB_USER}
            MYSQL_PASSWORD: ${DB_PASSWORD}
        volumes:
            - mysql_data:/var/lib/mysql
        ports:
            - "3306:3306"

volumes:
    mysql_data:
```

2. **Construa e inicie:**

```bash
docker-compose up -d
```

3. **Veja os logs:**

```bash
docker-compose logs -f bot
```

### Deploy em VPS (Linux)

```bash
# Instale Node.js e MySQL
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs mysql-server

# Clone e configure
git clone https://github.com/ryanbworks/TicketBot-discord.git
cd TicketBot-discord
npm install
cp .env.example .env
nano .env  # Configure as variáveis

# Configure o banco de dados
sudo mysql -u root -p < database.sql

# Instale PM2 para manter o bot rodando
sudo npm install -g pm2
pm2 start src/index.js --name ticket-bot
pm2 save
pm2 startup
```

---

## 📁 Estrutura do Projeto

```
TICKET BOT/
├── src/
│   ├── commands/
│   │   └── slash/          # Comandos slash (/)
│   │       ├── adicionar.js
│   │       ├── admin-tickets.js
│   │       ├── alertar.js
│   │       ├── fechar.js
│   │       ├── painel.js
│   │       ├── remover.js
│   │       ├── renomear.js
│   │       ├── transcricao.js
│   │       └── trocar-categoria.js
│   ├── events/             # Event handlers
│   │   ├── interactionCreate.js
│   │   ├── messageCreate.js
│   │   └── ready.js
│   ├── lib/
│   │   ├── tickets/        # Sistema de tickets
│   │   │   ├── interactions.js
│   │   │   ├── manager.js
│   │   │   └── transcript.js
│   │   ├── alertChecker.js
│   │   ├── config.js
│   │   ├── database.js
│   │   └── panelRefresher.js
│   ├── utils/
│   │   ├── embed.js
│   │   ├── logger.js
│   │   └── retry.js
│   ├── deploy-commands.js  # Registra comandos
│   └── index.js            # Entry point
├── data/                   # Transcrições e logs
├── config.yml              # Configuração principal
├── docker-compose.yml      # Docker compose
├── Dockerfile              # Imagem Docker
├── package.json            # Dependências
└── .env                    # Variáveis de ambiente
```

---

## 🛠️ Tecnologias

- **[Discord.js](https://discord.js.org/)** v14.16.3 — Biblioteca para Discord
- **[Node.js](https://nodejs.org/)** v18+ — Runtime JavaScript
- **[MySQL2](https://github.com/sidorares/node-mysql2)** — Driver MySQL com promises
- **[js-yaml](https://github.com/nodeca/js-yaml)** — Parser de YAML
- **[Docker](https://www.docker.com/)** — Containerização

---

## 🔧 Troubleshooting

### Bot não conecta

```bash
# Verifique o token
echo $DISCORD_TOKEN

# Verifique os logs
docker-compose logs -f bot
```

### Comandos não aparecem

```bash
# Registre manualmente
npm run deploy

# Aguarde até 1 hora para propagação global
```

### Erro de conexão com MySQL

```bash
# Teste a conexão
mysql -h DB_HOST -u DB_USER -p DB_NAME

# Verifique as credenciais no .env
cat .env | grep DB_
```

### Canal não é deletado após fechar

- Verifique se o bot tem permissão **Manage Channels**
- Verifique os logs para erros de API
- Sistema de retry tenta automaticamente 3 vezes

---

## 📝 Changelog

### v1.0.0 (2025-01-22)

- ✨ Sistema completo de tickets com múltiplas categorias
- ✨ Alertas automáticos de inatividade
- ✨ Sistema de avaliações (1-5 estrelas)
- ✨ Transcrições HTML dos tickets
- ✨ Comando `/trocar-categoria`
- ✨ Retry automático em erros de rede
- ✨ Tratamento de erro 10003 (Unknown Channel)
- ✨ Registro automático de slash commands
- ✨ Suporte a Docker
- 🐛 Corrigido: Alertas agora fecham tickets corretamente
- 🐛 Corrigido: DeprecationWarning do evento 'ready'

---

## 📄 Licença

Este projeto está sob a licença **MIT**. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

## 👨‍💻 Autor

Desenvolvido por **Ryan** para **FOZ RP**

- GitHub: [@ryanbworks](https://github.com/ryanbworks)
- Discord: FOZ RP

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues e pull requests.

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

---

## ⭐ Agradecimentos

- Comunidade Discord.js
- Servidor FOZ RP
- Todos os contribuidores

---

<div align="center">

**Se este projeto foi útil, considere deixar uma ⭐!**

</div>
