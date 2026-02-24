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

// Простое хранилище в памяти
let users = {};
let messages = [];

io.on('connection', (socket) => {
    console.log('🟢 Новый пользователь:', socket.id);

    // Регистрация
    socket.on('register', (data) => {
        console.log('Регистрация:', data);
        socket.emit('register_success');
    });

    // Вход
    socket.on('login', (data) => {
        console.log('Вход:', data);
        socket.username = data.username;
        users[socket.id] = data.username;
        
        socket.emit('login_success', {
            id: socket.id,
            username: data.username,
            avatarColor: '#4a9c4a'
        });
        
        // Отправляем список пользователей
        io.emit('users-list', Object.values(users).map(u => ({
            id: u,
            username: u,
            avatarColor: '#4a9c4a'
        })));
    });

    // Получить пользователей
    socket.on('get-users', () => {
        const usersList = Object.values(users).map(u => ({
            id: u,
            username: u,
            avatarColor: '#4a9c4a'
        }));
        socket.emit('users-list', usersList);
    });

    // Отправка сообщения
    socket.on('send-message', (data) => {
        console.log('Сообщение:', data);
        
        const message = {
            id: Date.now(),
            from: socket.id,
            fromUsername: socket.username,
            to: data.to,
            text: data.text,
            timestamp: new Date().toISOString()
        };
        
        // Отправляем всем
        io.emit('new-message', message);
    });

    // Получить историю
    socket.on('get-messages', (friendId) => {
        socket.emit('messages-list', []);
    });

    socket.on('disconnect', () => {
        delete users[socket.id];
        console.log('🔴 Отключился:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
});
