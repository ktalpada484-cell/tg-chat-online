const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());

// FIXED: Ab ye root folder se index.html aur history.html serve karega
app.use(express.static(__dirname));

let chatHistory = [];
let callLogs = [];
let activeUsers = 0;

// Credentials
const ADMIN_USER = "sumit@1123";
const ADMIN_PASS = "sumit1123";

// Route for homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Secure API Route for History
app.post('/api/history', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USER && password === ADMIN_PASS) {
        return res.json({ success: true, chats: chatHistory, calls: callLogs });
    } else {
        return res.status(401).json({ success: false, message: "Galat Username ya Password!" });
    }
});

// Socket.io Connection Logic
io.on('connection', (socket) => {
    activeUsers++;

    if (activeUsers > 2) {
        socket.emit('room-full', 'Room is full. Max 2 users allowed.');
        socket.disconnect();
        activeUsers--;
        return;
    }

    socket.broadcast.emit('status-change', { online: true, text: '🟢 Partner is Online' });

    socket.on('chat-message', (data) => {
        const msgData = { text: data.text, timestamp: new Date().toLocaleString() };
        chatHistory.push(msgData);
        socket.broadcast.emit('message', msgData);
    });

    socket.on('call-user', (data) => {
        callLogs.push({ event: 'Outgoing Call Initiated', timestamp: new Date().toLocaleString() });
        socket.broadcast.emit('incoming-call', data);
    });

    socket.on('answer-call', (data) => {
        callLogs.push({ event: 'Call Connected', timestamp: new Date().toLocaleString() });
        socket.broadcast.emit('call-answered', data);
    });

    socket.on('ice-candidate', (candidate) => {
        socket.broadcast.emit('ice-candidate', candidate);
    });

    socket.on('end-call', () => {
        callLogs.push({ event: 'Call Ended', timestamp: new Date().toLocaleString() });
        socket.broadcast.emit('call-ended');
    });

    socket.on('disconnect', () => {
        activeUsers--;
        socket.broadcast.emit('status-change', { online: false, text: '🔴 Partner is Offline' });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
