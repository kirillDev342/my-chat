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

app.use(express.static(path.join(__dirname, '/')));

let users = {};

io.on('connection', (socket) => {
    console.log('🟢 Новый пользователь подключился:', socket.id);

    socket.on('join', (username) => {
        console.log('👤 Попытка входа:', username);
        
        if (!username || username.trim() === '') {
            socket.emit('join_error', 'Имя не может быть пустым');
            return;
        }
        
        if (Object.values(users).includes(username)) {
            socket.emit('join_error', 'Это имя уже занято');
            return;
        }
        
        socket.username = username;
        users[socket.id] = username;
        
        console.log('✅ Пользователь вошел:', username);
        console.log('👥 Текущие пользователи:', Object.values(users));
        
        socket.emit('join_success');
        
        // Сообщаем всем о новом пользователе
        io.emit('message', {
            username: '🤖 Система',
            text: `${username} присоединился к чату`
        });
    });

    socket.on('message', (text) => {
        if (socket.username && text && text.trim()) {
            console.log(`📨 ${socket.username}: ${text}`);
            io.emit('message', {
                username: socket.username,
                text: text
            });
        }
    });

    socket.on('disconnect', () => {
        if (socket.username) {
            console.log('🔴 Пользователь отключился:', socket.username);
            delete users[socket.id];
            
            io.emit('message', {
                username: '🤖 Система',
                text: `${socket.username} покинул чат`
            });
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
});
