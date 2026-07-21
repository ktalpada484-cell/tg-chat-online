const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    maxHttpBufferSize: 1e7,
    cors: { origin: "*" }
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static(__dirname));

const ADMIN_USER = "sumit@1123";
const ADMIN_PASS = "sumit1123";

// Data file path
const DATA_FILE = path.join(__dirname, 'history.json');

// Load data or initialize empty arrays
let dbData = { chatHistory: [], callLogs: [], locationLogs: [] };

function loadData() {
    if (fs.existsSync(DATA_FILE)) {
        try {
            const rawData = fs.readFileSync(DATA_FILE);
            dbData = JSON.parse(rawData);
            cleanupOldData(); // Check and remove data older than 30 days
        } catch (e) {
            dbData = { chatHistory: [], callLogs: [], locationLogs: [] };
        }
    }
}

function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(dbData, null, 2));
    } catch (e) {
        console.error("Error saving data:", e);
    }
}

// 30 Days Auto-Delete Logic
function cleanupOldData() {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    dbData.chatHistory = dbData.chatHistory.filter(item => new Date(item.rawTimestamp || item.timestamp).getTime() > thirtyDaysAgo);
    dbData.callLogs = dbData.callLogs.filter(item => new Date(item.rawTimestamp || item.timestamp).getTime() > thirtyDaysAgo);
    dbData.locationLogs = dbData.locationLogs.filter(item => new Date(item.rawTimestamp || item.timestamp).getTime() > thirtyDaysAgo);
    
    saveData();
}

// Load existing data on startup
loadData();

let activeUsers = 0;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/history.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'history.html'));
});

app.post('/api/history', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USER && password === ADMIN_PASS) {
        loadData(); // Fresh data load karo
        return res.json({ 
            success: true, 
            chats: dbData.chatHistory, 
            calls: dbData.callLogs, 
            locations: dbData.locationLogs 
        });
    } else {
        return res.status(401).json({ success: false, message: "Galat Username ya Password!" });
    }
});

io.on('connection', (socket) => {
    activeUsers++;

    if (activeUsers > 2) {
        socket.emit('room-full', 'Room is full. Max 2 users allowed.');
        socket.disconnect();
        activeUsers--;
        return;
    }

    socket.broadcast.emit('status-change', { online: true, text: '🟢 Partner is Online' });
    socket.emit('status-change', { online: activeUsers > 1, text: activeUsers > 1 ? '🟢 Partner is Online' : '🔴 Partner is Offline' });

    socket.on('save-location', (data) => {
        dbData.locationLogs.push({
            event: `Location: Lat ${data.lat}, Lng ${data.lng}`,
            mapLink: `https://www.google.com/maps?q=${data.lat},${data.lng}`,
            timestamp: new Date().toLocaleTimeString(),
            rawTimestamp: new Date().toISOString()
        });
        saveData();
    });

    socket.on('chat-message', (data) => {
        const msgData = {
            type: data.type || 'text',
            content: data.content,
            timestamp: new Date().toLocaleTimeString(),
            rawTimestamp: new Date().toISOString()
        };
        dbData.chatHistory.push(msgData);
        saveData();
        socket.broadcast.emit('message', msgData);
    });

    socket.on('call-user', (data) => {
        const log = { event: 'Outgoing Call Initiated', timestamp: new Date().toLocaleTimeString(), rawTimestamp: new Date().toISOString() };
        dbData.callLogs.push(log);
        saveData();
        socket.broadcast.emit('incoming-call', data);
    });

    socket.on('answer-call', (data) => {
        const log = { event: 'Call Connected', timestamp: new Date().toLocaleTimeString(), rawTimestamp: new Date().toISOString() };
        dbData.callLogs.push(log);
        saveData();
        socket.broadcast.emit('call-answered', data);
    });

    socket.on('ice-candidate', (candidate) => {
        socket.broadcast.emit('ice-candidate', candidate);
    });

    socket.on('end-call', () => {
        const log = { event: 'Call Ended', timestamp: new Date().toLocaleTimeString(), rawTimestamp: new Date().toISOString() };
        dbData.callLogs.push(log);
        saveData();
        socket.broadcast.emit('call-ended');
    });

    socket.on('disconnect', () => {
        activeUsers = Math.max(0, activeUsers - 1);
        socket.broadcast.emit('status-change', { online: false, text: '🔴 Partner is Offline' });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
