import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config();

let pool = null;

/**
 * Cria o pool de conexões MySQL
 */
function createPool() {
    return mysql.createPool({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || "3306"),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        timezone: "+00:00",
    });
}

/**
 * Inicializa o banco de dados MySQL
 */
export async function initDatabase() {
    const maxRetries = 10;
    let retries = 0;

    while (retries < maxRetries) {
        try {
            pool = createPool();
            const connection = await pool.getConnection();

            console.log("✅ Conectado ao banco de dados MySQL");

            // Criar tabelas
            await connection.query(`
            CREATE TABLE IF NOT EXISTS tickets (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ticket_number INT NOT NULL,
                channel_id VARCHAR(255) UNIQUE NOT NULL,
                guild_id VARCHAR(255) NOT NULL,
                user_id VARCHAR(255) NOT NULL,
                category_id VARCHAR(255) NOT NULL,
                status VARCHAR(50) DEFAULT 'open',
                claimed_by VARCHAR(255) DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                closed_at DATETIME DEFAULT NULL,
                closed_by VARCHAR(255) DEFAULT NULL,
                close_reason TEXT DEFAULT NULL,
                last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_tickets_channel (channel_id),
                INDEX idx_tickets_user (user_id),
                INDEX idx_tickets_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

            await connection.query(`
            CREATE TABLE IF NOT EXISTS ticket_members (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ticket_id INT NOT NULL,
                user_id VARCHAR(255) NOT NULL,
                added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                added_by VARCHAR(255),
                FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
                UNIQUE KEY unique_ticket_user (ticket_id, user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

            await connection.query(`
            CREATE TABLE IF NOT EXISTS ticket_responses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ticket_id INT NOT NULL,
                question TEXT NOT NULL,
                answer TEXT NOT NULL,
                FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

            await connection.query(`
            CREATE TABLE IF NOT EXISTS cooldowns (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                category_id VARCHAR(255) NOT NULL,
                expires_at DATETIME NOT NULL,
                UNIQUE KEY unique_user_category (user_id, category_id),
                INDEX idx_cooldowns_user (user_id, category_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

            await connection.query(`
            CREATE TABLE IF NOT EXISTS guild_config (
                guild_id VARCHAR(255) PRIMARY KEY,
                ticket_count INT DEFAULT 0
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

            await connection.query(`
            CREATE TABLE IF NOT EXISTS ticket_ratings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ticket_id INT NOT NULL,
                user_id VARCHAR(255) NOT NULL,
                rating INT NOT NULL,
                comment TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

            await connection.query(`
            CREATE TABLE IF NOT EXISTS ticket_alerts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ticket_id INT NOT NULL,
                alerted_by VARCHAR(255) NOT NULL,
                reason TEXT,
                duration_minutes INT NOT NULL,
                expires_at DATETIME NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
                INDEX idx_alerts_status (status, expires_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

            await connection.query(`
            CREATE TABLE IF NOT EXISTS panel_users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) UNIQUE NOT NULL,
                password_hash TEXT DEFAULT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

            // Criar usuário admin se não existir
            await connection.query(`
            INSERT IGNORE INTO panel_users (username, password_hash) 
            VALUES ('admin', NULL)
        `);

            connection.release();
            console.log("✅ Banco de dados MySQL inicializado!");
            return pool;
        } catch (error) {
            retries++;
            console.error(`❌ Erro ao conectar ao banco de dados (tentativa ${retries}/${maxRetries}):`, error.message);

            if (retries >= maxRetries) {
                console.error("❌ Não foi possível conectar ao banco de dados após várias tentativas.");
                throw error;
            }

            // Aguardar antes de tentar novamente
            const delay = Math.min(retries * 2000, 10000); // Máximo 10 segundos
            console.log(`⏳ Aguardando ${delay / 1000}s antes de tentar novamente...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

/**
 * Obtém o pool de conexões
 */
export function getPool() {
    if (!pool) {
        throw new Error("Database pool not initialized. Call initDatabase() first.");
    }
    return pool;
}

// ════════════════════════════════════════════════════════════════════════════
// TICKETS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Cria um novo ticket no banco de dados
 */
export async function createTicket(data) {
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // Incrementar contador de tickets
        const [guildConfig] = await connection.query("SELECT ticket_count FROM guild_config WHERE guild_id = ?", [
            data.guildId,
        ]);

        let ticketNumber;
        if (guildConfig.length > 0) {
            ticketNumber = guildConfig[0].ticket_count + 1;
            await connection.query("UPDATE guild_config SET ticket_count = ? WHERE guild_id = ?", [
                ticketNumber,
                data.guildId,
            ]);
        } else {
            ticketNumber = 1;
            await connection.query("INSERT INTO guild_config (guild_id, ticket_count) VALUES (?, ?)", [
                data.guildId,
                ticketNumber,
            ]);
        }

        const [result] = await connection.query(
            `
            INSERT INTO tickets (ticket_number, channel_id, guild_id, user_id, category_id)
            VALUES (?, ?, ?, ?, ?)
        `,
            [ticketNumber, data.channelId, data.guildId, data.userId, data.categoryId],
        );

        const ticketId = result.insertId;

        // Adicionar o criador como membro
        await connection.query(
            `
            INSERT INTO ticket_members (ticket_id, user_id, added_by)
            VALUES (?, ?, ?)
        `,
            [ticketId, data.userId, data.userId],
        );

        await connection.commit();

        return {
            id: ticketId,
            ticketNumber,
            ...data,
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * Obtém um ticket pelo ID do canal
 */
export async function getTicketByChannel(channelId) {
    const pool = getPool();
    const [rows] = await pool.query("SELECT * FROM tickets WHERE channel_id = ?", [channelId]);
    return rows[0];
}

/**
 * Obtém um ticket pelo ID
 */
export async function getTicketById(ticketId) {
    const pool = getPool();
    const [rows] = await pool.query("SELECT * FROM tickets WHERE id = ?", [ticketId]);
    return rows[0];
}

/**
 * Obtém tickets abertos de um usuário em uma categoria
 */
export async function getUserOpenTickets(userId, categoryId) {
    const pool = getPool();
    const [rows] = await pool.query(
        `
        SELECT * FROM tickets 
        WHERE user_id = ? AND category_id = ? AND status = 'open'
    `,
        [userId, categoryId],
    );
    return rows;
}

/**
 * Obtém todos os tickets abertos de uma categoria
 */
export async function getCategoryOpenTickets(categoryId) {
    const pool = getPool();
    const [rows] = await pool.query(
        `
        SELECT * FROM tickets 
        WHERE category_id = ? AND status = 'open'
    `,
        [categoryId],
    );
    return rows;
}

/**
 * Atualiza o status do ticket
 */
export async function updateTicketStatus(channelId, status, closedBy = null, reason = null) {
    const pool = getPool();

    if (status === "closed") {
        const [result] = await pool.query(
            `
            UPDATE tickets 
            SET status = ?, closed_at = NOW(), closed_by = ?, close_reason = ?
            WHERE channel_id = ?
        `,
            [status, closedBy, reason, channelId],
        );
        return result;
    }

    const [result] = await pool.query(
        `
        UPDATE tickets SET status = ? WHERE channel_id = ?
    `,
        [status, channelId],
    );
    return result;
}

/**
 * Define quem assumiu o ticket
 */
export async function claimTicket(channelId, userId) {
    const pool = getPool();
    const [result] = await pool.query(
        `
        UPDATE tickets SET claimed_by = ? WHERE channel_id = ?
    `,
        [userId, channelId],
    );
    return result;
}

/**
 * Remove o responsável do ticket
 */
export async function unclaimTicket(channelId) {
    const pool = getPool();
    const [result] = await pool.query(
        `
        UPDATE tickets SET claimed_by = NULL WHERE channel_id = ?
    `,
        [channelId],
    );
    return result;
}

/**
 * Atualiza timestamp da última mensagem
 */
export async function updateLastMessage(channelId) {
    const pool = getPool();
    const [result] = await pool.query(
        `
        UPDATE tickets SET last_message_at = NOW() WHERE channel_id = ?
    `,
        [channelId],
    );
    return result;
}

/**
 * Obtém tickets inativos para auto-close
 */
export async function getInactiveTickets(inactivityMs) {
    const pool = getPool();
    const threshold = new Date(Date.now() - inactivityMs);

    const [rows] = await pool.query(
        `
        SELECT * FROM tickets 
        WHERE status = 'open' AND last_message_at < ?
    `,
        [threshold],
    );
    return rows;
}

// ════════════════════════════════════════════════════════════════════════════
// MEMBROS DO TICKET
// ════════════════════════════════════════════════════════════════════════════

/**
 * Adiciona um membro ao ticket
 */
export async function addTicketMember(ticketId, userId, addedBy) {
    const pool = getPool();
    try {
        const [result] = await pool.query(
            `
            INSERT INTO ticket_members (ticket_id, user_id, added_by)
            VALUES (?, ?, ?)
        `,
            [ticketId, userId, addedBy],
        );
        return result;
    } catch (error) {
        // Já existe (duplicate key)
        if (error.code === "ER_DUP_ENTRY") {
            return null;
        }
        throw error;
    }
}

/**
 * Remove um membro do ticket
 */
export async function removeTicketMember(ticketId, userId) {
    const pool = getPool();
    const [result] = await pool.query(
        `
        DELETE FROM ticket_members WHERE ticket_id = ? AND user_id = ?
    `,
        [ticketId, userId],
    );
    return result;
}

/**
 * Obtém membros do ticket
 */
export async function getTicketMembers(ticketId) {
    const pool = getPool();
    const [rows] = await pool.query(
        `
        SELECT * FROM ticket_members WHERE ticket_id = ?
    `,
        [ticketId],
    );
    return rows;
}

/**
 * Verifica se usuário é membro do ticket
 */
export async function isTicketMember(ticketId, userId) {
    const pool = getPool();
    const [rows] = await pool.query(
        `
        SELECT 1 FROM ticket_members WHERE ticket_id = ? AND user_id = ?
    `,
        [ticketId, userId],
    );
    return rows.length > 0;
}

// ════════════════════════════════════════════════════════════════════════════
// RESPOSTAS DO MODAL
// ════════════════════════════════════════════════════════════════════════════

/**
 * Salva respostas do modal
 */
export async function saveTicketResponses(ticketId, responses) {
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        for (const item of responses) {
            await connection.query(
                `
                INSERT INTO ticket_responses (ticket_id, question, answer)
                VALUES (?, ?, ?)
            `,
                [ticketId, item.question, item.answer],
            );
        }

        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * Obtém respostas do ticket
 */
export async function getTicketResponses(ticketId) {
    const pool = getPool();
    const [rows] = await pool.query(
        `
        SELECT * FROM ticket_responses WHERE ticket_id = ?
    `,
        [ticketId],
    );
    return rows;
}

// ════════════════════════════════════════════════════════════════════════════
// COOLDOWNS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Verifica cooldown do usuário
 */
export async function checkCooldown(userId, categoryId) {
    const pool = getPool();
    const [rows] = await pool.query(
        `
        SELECT expires_at FROM cooldowns 
        WHERE user_id = ? AND category_id = ? AND expires_at > NOW()
    `,
        [userId, categoryId],
    );

    if (rows.length > 0) {
        return new Date(rows[0].expires_at).getTime() - Date.now();
    }
    return 0;
}

/**
 * Define cooldown do usuário
 */
export async function setCooldown(userId, categoryId, durationMs) {
    const pool = getPool();
    const expiresAt = new Date(Date.now() + durationMs);

    const [result] = await pool.query(
        `
        INSERT INTO cooldowns (user_id, category_id, expires_at)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE expires_at = VALUES(expires_at)
    `,
        [userId, categoryId, expiresAt],
    );
    return result;
}

/**
 * Limpa cooldowns expirados
 */
export async function cleanExpiredCooldowns() {
    const pool = getPool();
    const [result] = await pool.query(
        `
        DELETE FROM cooldowns WHERE expires_at < NOW()
    `,
    );
    return result;
}

// ════════════════════════════════════════════════════════════════════════════
// AVALIAÇÕES
// ════════════════════════════════════════════════════════════════════════════

/**
 * Salva uma avaliação de ticket
 */
export async function saveTicketRating(ticketId, userId, rating, comment = null) {
    const pool = getPool();
    const [result] = await pool.query(
        `
        INSERT INTO ticket_ratings (ticket_id, user_id, rating, comment)
        VALUES (?, ?, ?, ?)
    `,
        [ticketId, userId, rating, comment],
    );
    return result;
}

/**
 * Obtém avaliação de um ticket
 */
export async function getTicketRating(ticketId) {
    const pool = getPool();
    const [rows] = await pool.query("SELECT * FROM ticket_ratings WHERE ticket_id = ?", [ticketId]);
    return rows[0];
}

/**
 * Obtém todas as avaliações
 */
export async function getAllRatings(limit = 100) {
    const pool = getPool();
    const [rows] = await pool.query(
        `
        SELECT r.*, t.ticket_number, t.category_id, t.claimed_by
        FROM ticket_ratings r
        JOIN tickets t ON r.ticket_id = t.id
        ORDER BY r.created_at DESC
        LIMIT ?
    `,
        [limit],
    );
    return rows;
}

/**
 * Obtém média de avaliações
 */
export async function getAverageRating() {
    const pool = getPool();
    const [rows] = await pool.query(
        `
        SELECT AVG(rating) as average, COUNT(*) as total
        FROM ticket_ratings
    `,
    );
    return rows[0];
}

// ════════════════════════════════════════════════════════════════════════════
// ALERTAS DE TICKETS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Define um alerta para um ticket
 */
export async function setTicketAlert(ticketId, alertedBy, durationMinutes, reason = null) {
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const expiresAt = new Date(Date.now() + durationMinutes * 60000);

        // Cancelar alertas anteriores pendentes
        await connection.query(
            `UPDATE ticket_alerts SET status = 'cancelled' WHERE ticket_id = ? AND status = 'pending'`,
            [ticketId],
        );

        const [result] = await connection.query(
            `
            INSERT INTO ticket_alerts (ticket_id, alerted_by, reason, duration_minutes, expires_at)
            VALUES (?, ?, ?, ?, ?)
        `,
            [ticketId, alertedBy, reason, durationMinutes, expiresAt],
        );

        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * Obtém alerta ativo de um ticket
 */
export async function getTicketAlert(ticketId) {
    const pool = getPool();
    const [rows] = await pool.query(
        `SELECT * FROM ticket_alerts WHERE ticket_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1`,
        [ticketId],
    );
    return rows[0];
}

/**
 * Obtém todos os alertas expirados (pendentes)
 */
export async function getExpiredAlerts() {
    const pool = getPool();
    const [rows] = await pool.query(
        `
        SELECT a.*, t.channel_id, t.guild_id, t.user_id, t.ticket_number
        FROM ticket_alerts a
        JOIN tickets t ON a.ticket_id = t.id
        WHERE a.status = 'pending' AND a.expires_at <= NOW()
        AND t.status = 'open'
    `,
    );
    return rows;
}

/**
 * Cancela um alerta
 */
export async function cancelTicketAlert(ticketId) {
    const pool = getPool();
    const [result] = await pool.query(
        `UPDATE ticket_alerts SET status = 'cancelled' WHERE ticket_id = ? AND status = 'pending'`,
        [ticketId],
    );
    return result;
}

/**
 * Marca um alerta como executado
 */
export async function markAlertExecuted(alertId) {
    const pool = getPool();
    const [result] = await pool.query(`UPDATE ticket_alerts SET status = 'executed' WHERE id = ?`, [alertId]);
    return result;
}

/**
 * Cancela alertas de um ticket quando o usuário responde
 */
export async function cancelAlertOnResponse(ticketId) {
    const pool = getPool();
    const [result] = await pool.query(
        `UPDATE ticket_alerts SET status = 'cancelled' WHERE ticket_id = ? AND status = 'pending'`,
        [ticketId],
    );
    return result;
}

export default {
    initDatabase,
    getPool,
    createTicket,
    getTicketByChannel,
    getTicketById,
    getUserOpenTickets,
    getCategoryOpenTickets,
    updateTicketStatus,
    claimTicket,
    unclaimTicket,
    updateLastMessage,
    getInactiveTickets,
    addTicketMember,
    removeTicketMember,
    getTicketMembers,
    isTicketMember,
    saveTicketResponses,
    getTicketResponses,
    checkCooldown,
    setCooldown,
    cleanExpiredCooldowns,
    saveTicketRating,
    getTicketRating,
    getAllRatings,
    getAverageRating,
    setTicketAlert,
    getTicketAlert,
    getExpiredAlerts,
    cancelTicketAlert,
    markAlertExecuted,
    cancelAlertOnResponse,
};
