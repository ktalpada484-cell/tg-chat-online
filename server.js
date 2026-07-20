const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PRIVATE_ROOM = "our_hidden_space_2011";
const rooms = { [PRIVATE_ROOM]: [] }; 

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    if (rooms[PRIVATE_ROOM].length < 2) {
        rooms[PRIVATE_ROOM].push(socket.id);
        socket.join(PRIVATE_ROOM);
        socket.currentRoom = PRIVATE_ROOM;
        
        if (rooms[PRIVATE_ROOM].length === 2) {
            io.to(PRIVATE_ROOM).emit('status-change', { online: true, text: '🟢 Partner is Online' });
        } else {
            socket.emit('status-change', { online: false, text: '🔴 Waiting for partner...' });
        }
    } else {
        socket.emit('room-full', 'This private chat is full!');
    }

    // Text Message
    socket.on('chat-message', (data) => {
        if (socket.currentRoom) {
            socket.to(socket.currentRoom).emit('message', data);
        }
    });

    // WebRTC Signaling Logic (Voice Call ke liye)
    socket.on('call-user', (data) => {
        socket.to(PRIVATE_ROOM).emit('incoming-call', { from: socket.id, offer: data.offer });
    });

    socket.on('answer-call', (data) => {
        socket.to(PRIVATE_ROOM).emit('call-answered', { answer: data.answer });
    });

    socket.on('ice-candidate', (data) => {
        socket.to(PRIVATE_ROOM).emit('ice-candidate', data.candidate);
    });

    socket.on('end-call', () => {
        socket.to(PRIVATE_ROOM).emit('call-ended');
    });

    // Disconnect
    socket.on('disconnect', () => {
        if (rooms[PRIVATE_ROOM]) {
            rooms[PRIVATE_ROOM] = rooms[PRIVATE_ROOM].filter(id => id !== socket.id);
            socket.to(PRIVATE_ROOM).emit('status-change', { online: false, text: '🔴 Partner went Offline' });
            socket.to(PRIVATE_ROOM).emit('call-ended');
        }
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
