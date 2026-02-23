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

let users = {}; // { socketId: username }

io.on('connection', (socket) => {
    console.log('🟢 Новый пользователь подключился:', socket.id);

    // ========== ВХОД В ЧАТ ==========
    socket.on('join', (username) => {
        console.log('👤 Попытка входа:', username);
        
        if (!username || username.trim() === '') {
            socket.emit('join_error', 'Имя не может быть пустым');
            return;
        }
        
        // Проверяем, не занято ли имя
        if (Object.values(users).includes(username)) {
            socket.emit('join_error', 'Это имя уже занято');
            return;
        }
        
        // Сохраняем пользователя
        socket.username = username;
        users[socket.id] = username;
        
        console.log('✅ Пользователь вошел:', username);
        console.log('👥 Все пользователи:', Object.values(users));
        
        // Отправляем подтверждение входа
        socket.emit('join_success');
        
        // Отправляем список пользователей ВСЕМ
        io.emit('users', Object.values(users));
        
        // Сообщаем всем о новом пользователе
        io.emit('message', {
            username: '🤖 Система',
            text: `${username} присоединился к чату`
        });
    });

    // ========== ПОЛУЧИТЬ СПИСОК ПОЛЬЗОВАТЕЛЕЙ ==========
    socket.on('get-users', () => {
        socket.emit('users', Object.values(users));
    });

    // ========== ОТПРАВКА СООБЩЕНИЙ ==========
    socket.on('message', (text) => {
        if (socket.username && text && text.trim()) {
            console.log(`📨 ${socket.username}: ${text}`);
            io.emit('message', {
                username: socket.username,
                text: text
            });
        }
    });

    // ========== ЗВОНКИ ==========
    socket.on('call-user', (data) => {
        console.log(`📞 Звонок от ${socket.username} к ${data.to}`);
        
        // Находим сокет получателя
        const targetSocketId = Object.keys(users).find(id => users[id] === data.to);
        
        if (targetSocketId) {
            // Отправляем звонок конкретному пользователю
            io.to(targetSocketId).emit('incoming-call', {
                from: socket.username,
                offer: data.offer,
                fromId: socket.id
            });
            console.log(`✅ Звонок отправлен пользователю ${data.to}`);
        } else {
            console.log(`❌ Пользователь ${data.to} не найден`);
            socket.emit('call-error', 'Пользователь не найден или офлайн');
        }
    });

    socket.on('accept-call', (data) => {
        console.log(`✅ Звонок принят от ${socket.username} для ${data.to}`);
        
        const targetSocketId = Object.keys(users).find(id => users[id] === data.to);
        
        if (targetSocketId) {
            io.to(targetSocketId).emit('call-accepted', {
                from: socket.username,
                answer: data.answer
            });
        }
    });

    socket.on('reject-call', (data) => {
        console.log(`❌ Звонок отклонен от ${socket.username} для ${data.to}`);
        
        const targetSocketId = Object.keys(users).find(id => users[id] === data.to);
        
        if (targetSocketId) {
            io.to(targetSocketId).emit('call-rejected', {
                from: socket.username
            });
        }
    });

    socket.on('call-busy', (data) => {
        console.log(`⏳ Пользователь ${socket.username} занят`);
        
        const targetSocketId = Object.keys(users).find(id => users[id] === data.to);
        
        if (targetSocketId) {
            io.to(targetSocketId).emit('call-busy', {
                from: socket.username
            });
        }
    });

    socket.on('ice-candidate', (data) => {
        console.log(`❄️ ICE кандидат от ${socket.username} для ${data.to}`);
        
        const targetSocketId = Object.keys(users).find(id => users[id] === data.to);
        
        if (targetSocketId) {
            io.to(targetSocketId).emit('ice-candidate', {
                from: socket.username,
                candidate: data.candidate
            });
        }
    });

    socket.on('end-call', (data) => {
        console.log(`📴 Звонок завершен от ${socket.username}`);
        
        const targetSocketId = Object.keys(users).find(id => users[id] === data.to);
        
        if (targetSocketId) {
            io.to(targetSocketId).emit('call-ended', {
                from: socket.username
            });
        }
    });

    // ========== ОТКЛЮЧЕНИЕ ==========
    socket.on('disconnect', () => {
        if (socket.username) {
            console.log('🔴 Пользователь отключился:', socket.username);
            
            // Удаляем пользователя
            delete users[socket.id];
            
            // Обновляем список для всех
            io.emit('users', Object.values(users));
            
            // Сообщаем о выходе
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
