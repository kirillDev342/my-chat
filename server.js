const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: { origin: "*" }
});

app.use(express.static(path.join(__dirname, '/')));

const rooms = {};

io.on('connection', (socket) => {
    console.log('Новый пользователь:', socket.id);

    socket.on('join', ({ username, room }) => {
        socket.join(room);
        
        if (!rooms[room]) rooms[room] = [];
        rooms[room].push({ id: socket.id, username });
        
        // Сообщение о входе
        io.to(room).emit('message', {
            username: '🤖 Система',
            text: `${username} присоединился к чату!`
        });
        
        // Список пользователей
        const users = rooms[room].map(u => u.username);
        io.to(room).emit('userList', users);
    });

    socket.on('message', (text) => {
        // Находим комнату пользователя
        for (let room in rooms) {
            const user = rooms[room]?.find(u => u.id === socket.id);
            if (user) {
                io.to(room).emit('message', {
                    username: user.username,
                    text: text
                });
                break;
            }
        }
    });

    socket.on('disconnect', () => {
        for (let room in rooms) {
            const index = rooms[room]?.findIndex(u => u.id === socket.id);
            if (index !== -1) {
                const [user] = rooms[room].splice(index, 1);
                
                io.to(room).emit('message', {
                    username: '🤖 Система',
                    text: `${user.username} покинул чат`
                });
                
                const users = rooms[room].map(u => u.username);
                io.to(room).emit('userList', users);
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});