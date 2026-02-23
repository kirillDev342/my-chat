const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Отдаем статические файлы
app.use(express.static(path.join(__dirname, '/')));

// Хранилище пользователей
let users = {};

io.on('connection', (socket) => {
    console.log('Новый пользователь:', socket.id);

    // Вход в чат
    socket.on('join', (username) => {
        socket.username = username;
        users[socket.id] = username;
        
        // Отправляем сообщение о входе
        io.emit('message', {
            username: '🤖 Система',
            text: `${username} присоединился к чату`
        });
        
        // Отправляем список пользователей
        io.emit('users', Object.values(users));
    });

    // Обработка сообщений
    socket.on('message', (text) => {
        io.emit('message', {
            username: socket.username,
            text: text
        });
    });

    // Отключение
    socket.on('disconnect', () => {
        if (socket.username) {
            // Удаляем пользователя
            delete users[socket.id];
            
            // Сообщаем всем
            io.emit('message', {
                username: '🤖 Система',
                text: `${socket.username} покинул чат`
            });
            
            // Обновляем список
            io.emit('users', Object.values(users));
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
});
