const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static(path.join(__dirname, '/')));

// ========== SQLite БАЗА ДАННЫХ ==========
const db = new Database('chat.db');

// Создаем таблицы
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        avatarColor TEXT,
        online INTEGER DEFAULT 0,
        lastSeen DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fromUser INTEGER,
        toUser INTEGER,
        text TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`);

console.log('✅ База данных готова!');

// ========== ФУНКЦИИ ДЛЯ РАБОТЫ С БД ==========
function createUser(username, password) {
    const colors = ['#4a9c4a', '#4a7c9c', '#9c4a4a', '#9c7c4a', '#7c4a9c'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    const stmt = db.prepare('INSERT INTO users (username, password, avatarColor) VALUES (?, ?, ?)');
    return stmt.run(username, password, randomColor);
}

function checkPassword(username, password) {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?');
    return stmt.get(username, password);
}

function getUserById(id) {
    const stmt = db.prepare('SELECT id, username, avatarColor, online FROM users WHERE id = ?');
    return stmt.get(id);
}

function getAllUsers(excludeUserId) {
    const stmt = db.prepare('SELECT id, username, avatarColor, online FROM users WHERE id != ?');
    return stmt.all(excludeUserId);
}

function updateUserOnline(userId, online) {
    const stmt = db.prepare('UPDATE users SET online = ?, lastSeen = CURRENT_TIMESTAMP WHERE id = ?');
    return stmt.run(online ? 1 : 0, userId);
}

function saveMessage(fromUser, toUser, text) {
    const stmt = db.prepare('INSERT INTO messages (fromUser, toUser, text) VALUES (?, ?, ?)');
    return stmt.run(fromUser, toUser, text);
}

function getMessages(user1, user2) {
    const stmt = db.prepare(`
        SELECT * FROM messages 
        WHERE (fromUser = ? AND toUser = ?) OR (fromUser = ? AND toUser = ?)
        ORDER BY timestamp ASC
    `);
    return stmt.all(user1, user2, user2, user1);
}

// ========== ХРАНИЛИЩЕ ОНЛАЙН ПОЛЬЗОВАТЕЛЕЙ ==========
let onlineUsers = {};

// ========== СОКЕТ СОЕДИНЕНИЯ ==========
io.on('connection', (socket) => {
    console.log('🟢 Новый пользователь:', socket.id);

    // ========== АВТОМАТИЧЕСКИЙ ВХОД ==========
    socket.on('auto-login', (userId) => {
        try {
            const user = getUserById(userId);
            
            if (user) {
                socket.userId = user.id;
                socket.username = user.username;
                
                onlineUsers[user.id] = socket.id;
                updateUserOnline(user.id, true);
                
                socket.emit('auto-login-success', {
                    id: user.id,
                    username: user.username,
                    avatarColor: user.avatarColor
                });
                
                // Уведомляем всех о новом онлайн пользователе
                io.emit('user-online', user.id);
            }
        } catch (err) {
            console.log('Ошибка автовхода:', err);
        }
    });

    // ========== РЕГИСТРАЦИЯ ==========
    socket.on('register', (data) => {
        try {
            const { username, password } = data;
            
            const existing = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
            if (existing) {
                socket.emit('register_error', 'Пользователь уже существует');
                return;
            }
            
            createUser(username, password);
            socket.emit('register_success');
            console.log(`✅ Зарегистрирован: ${username}`);
            
        } catch (err) {
            socket.emit('register_error', 'Ошибка регистрации');
        }
    });

    // ========== ВХОД ==========
    socket.on('login', (data) => {
        try {
            const { username, password } = data;
            
            const user = checkPassword(username, password);
            
            if (!user) {
                socket.emit('login_error', 'Неверный логин или пароль');
                return;
            }
            
            socket.userId = user.id;
            socket.username = user.username;
            
            onlineUsers[user.id] = socket.id;
            updateUserOnline(user.id, true);
            
            socket.emit('login_success', {
                id: user.id,
                username: user.username,
                avatarColor: user.avatarColor
            });
            
            console.log(`✅ Вошел: ${username}`);
            
            // Уведомляем всех о новом онлайн пользователе
            io.emit('user-online', user.id);
            
        } catch (err) {
            socket.emit('login_error', 'Ошибка входа');
        }
    });

    // ========== ПОЛУЧИТЬ ПОЛЬЗОВАТЕЛЕЙ ==========
    socket.on('get-users', () => {
        try {
            const users = getAllUsers(socket.userId).map(u => ({
                ...u,
                online: onlineUsers[u.id] ? true : false
            }));
            socket.emit('users-list', users);
        } catch (err) {
            console.log('Ошибка получения пользователей:', err);
        }
    });

    // ========== ОТПРАВКА СООБЩЕНИЯ ==========
    socket.on('send-message', (data) => {
        try {
            const { to, text } = data;
            
            saveMessage(socket.userId, to, text);
            
            const message = {
                id: Date.now(),
                from: socket.userId,
                fromUsername: socket.username,
                to: to,
                text: text,
                timestamp: new Date().toISOString()
            };
            
            if (onlineUsers[to]) {
                io.to(onlineUsers[to]).emit('new-message', message);
            }
            
            socket.emit('new-message', message);
            
        } catch (err) {
            console.log('Ошибка отправки:', err);
        }
    });

    // ========== ПОЛУЧИТЬ ИСТОРИЮ ==========
    socket.on('get-messages', (friendId) => {
        try {
            const messages = getMessages(socket.userId, friendId);
            socket.emit('messages-list', messages);
        } catch (err) {
            console.log('Ошибка получения истории:', err);
        }
    });

    // ========== ОТКЛЮЧЕНИЕ ==========
    socket.on('disconnect', () => {
        if (socket.userId) {
            delete onlineUsers[socket.userId];
            updateUserOnline(socket.userId, false);
            
            console.log(`🔴 Отключился: ${socket.username}`);
            
            // Уведомляем всех о выходе
            io.emit('user-offline', socket.userId);
        }
    });
});

// ========== ПИНГ ДЛЯ БОРЬБЫ СО СНОМ ==========
app.get('/ping', (req, res) => {
    res.send('pong');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
});
