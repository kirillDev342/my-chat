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
    console.log('Новый пользователь подключился:', socket.id);

    socket.on('join', (username) => {
        console.log('Пользователь хочет войти:', username);
        
        if (!username) {
            socket.emit('join_error', 'Имя не может быть пустым');
            return;
        }
        
        socket.username = username;
        users[socket.id] = username;
        
        socket.emit('join_success');
        
        io.emit('message', {
            username: 'Система',
            text: `${username} присоединился к чату`
        });
        
        console.log('Текущие пользователи:', Object.values(users));
    });

    socket.on('message', (text) => {
        if (socket.username) {
            io.emit('message', {
                username: socket.username,
                text: text
            });
        }
    });

    socket.on('disconnect', () => {
        if (socket.username) {
            console.log('Пользователь отключился:', socket.username);
            delete users[socket.id];
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
});
