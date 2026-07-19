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

// Rooms ka data store karne ke liye
const rooms = {}; 

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Room join karne ka logic
    socket.on('join-room', (roomId) => {
        if (!rooms[roomId]) {
            rooms[roomId] = [];
        }

        // Room mein max 2 log allow hain
        if (rooms[roomId].length < 2) {
            rooms[roomId].push(socket.id);
            socket.join(roomId);
            socket.currentRoom = roomId;
            
            socket.emit('room-status', 'Connected to private chat.');
            socket.to(roomId).emit('message', { user: 'System', text: 'Partner joined the chat.' });
        } else {
            // Agar 2 log pehle se hain
            socket.emit('room-full', 'This room is full! Only 2 people allowed.');
        }
    });

    // Message transmit karne ka logic
    socket.on('chat-message', (data) => {
        if (socket.currentRoom) {
            socket.to(socket.currentRoom).emit('message', data);
        }
    });

    // Disconnect hone par clear-up
    socket.on('disconnect', () => {
        const roomId = socket.currentRoom;
        if (roomId && rooms[roomId]) {
            rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
            if (rooms[roomId].length === 0) {
                delete rooms[roomId];
            } else {
                socket.to(roomId).emit('message', { user: 'System', text: 'Partner left the chat.' });
            }
        }
        console.log('User disconnected:', socket.id);
    });
});

// Render dynamic port supply karta hai, isliye process.env.PORT zaroori hai
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

