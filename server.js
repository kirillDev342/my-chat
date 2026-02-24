io.on('connection', (socket) => {
    console.log('🟢 Новый пользователь:', socket.id);

    // ========== АВТОМАТИЧЕСКИЙ ВХОД ==========
    socket.on('auto-login', (userId) => {
        try {
            const stmt = db.prepare('SELECT id, username, avatarColor FROM users WHERE id = ?');
            const user = stmt.get(userId);
            
            if (user) {
                socket.userId = user.id;
                socket.username = user.username;
                
                onlineUsers[user.id] = socket.id;
                
                socket.emit('auto-login-success', {
                    id: user.id,
                    username: user.username,
                    avatarColor: user.avatarColor
                });
            }
        } catch (err) {
            console.log('Ошибка автовхода:', err);
        }
    });

    // ========== РЕГИСТРАЦИЯ ==========
    socket.on('register', (data) => {
        try {
            const { username, password } = data;
            
            // Проверяем, есть ли уже такой пользователь
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
            
            socket.emit('login_success', {
                id: user.id,
                username: user.username,
                avatarColor: user.avatarColor
            });
            
            console.log(`✅ Вошел: ${username}`);
            
        } catch (err) {
            socket.emit('login_error', 'Ошибка входа');
        }
    });

    // ========== ПОЛУЧИТЬ ПОЛЬЗОВАТЕЛЕЙ ==========
    socket.on('get-users', () => {
        try {
            const users = getAllUsers(socket.userId);
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

    // ========== ПИНГ ДЛЯ БОРЬБЫ СО СНОМ ==========
    socket.on('ping', () => {
        socket.emit('pong');
    });

    // ========== ОТКЛЮЧЕНИЕ ==========
    socket.on('disconnect', () => {
        if (socket.userId) {
            delete onlineUsers[socket.userId];
            console.log(`🔴 Отключился: ${socket.username}`);
        }
    });
});

// ========== ПИНГ HTTP ДЛЯ БОРЬБЫ СО СНОМ ==========
app.get('/ping', (req, res) => {
    res.send('pong');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Сервер запущен на порту ${PORT}`);
});
