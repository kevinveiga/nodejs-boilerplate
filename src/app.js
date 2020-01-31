import axios from 'axios';
import express from 'express';
import http from 'http';
import socketIo from 'socket.io';

import { pathPublic, port } from './config.js';

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// CONFIG
app.use(express.static(pathPublic));

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Credentials', true);

    next();
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// VARIABLE
let interval = null;

// FUNCTION
const getApi = async (socket) => {
    try {
        const result = await axios.get('https://api.infomoney.com.br/ativos/ticker?type=json&_=1143');

        socket.emit('msg', JSON.stringify(result.data));
    } catch (error) {
        console.error(`Error: ${error.code}`);
    }
};

io.on('connection', (socket) => {
    console.log('log new user connected');

    if (interval) {
        clearInterval(interval);
    }

    interval = setInterval(() => {
        console.log('interval');
        getApi(socket);
    }, 3000);

    socket.on('msg', (msg) => {
        console.log('msg: ' + msg);
        io.emit('msg', 'Olá no caso do msg');
    });

    socket.on('msgCallback', (msg, other, fn) => {
        console.log('msgCallback: ' + msg);
        fn(msg + ' says ' + other);
    });

    socket.on('disconnect', () => {
        clearInterval(interval);

        console.log('User disconnect');
    });
});

// Namespace "chat"
const chat = io.of('/chat').on('connection', (socket) => {
    socket.emit('a message', {
        that: 'only',
        '/chat': 'will get'
    });
    chat.emit('a message', {
        everyone: 'in',
        '/chat': 'will get'
    });
});

// Namespace "news"
const news = io.of('/news').on('connection', (socket) => {
    socket.emit('item', { news: 'item' });
});

const onConnect = (socket) => {
    console.log('User Connected');

    // sending to the client
    socket.emit('msg', 'can you hear me?', 1, 2, 'abc');

    // sending to all clients except sender
    socket.broadcast.emit('broadcast', 'hello friends!');

    // sending to all clients in 'game' room except sender
    socket.to('game').emit('nice game', "let's play a game");

    // sending to all clients in 'game1' and/or in 'game2' room, except sender
    socket
        .to('game1')
        .to('game2')
        .emit('nice game', "let's play a game (too)");

    // sending to all clients in 'game' room, including sender
    io.in('game').emit('big-announcement', 'the game will start soon');

    // sending to all clients in namespace 'myNamespace', including sender
    io.of('myNamespace').emit('bigger-announcement', 'the tournament will start soon');

    // sending to a specific room in a specific namespace, including sender
    io.of('myNamespace')
        .to('room')
        .emit('event', 'message');

    // sending to individual socketid (private message)
    // io.to(`${socketId}`).emit('hey', 'I just met you');

    // WARNING: `socket.to(socket.id).emit()` will NOT work, as it will send to everyone in the room
    // named `socket.id` but the sender. Please use the classic `socket.emit()` instead.

    // sending with acknowledgement
    socket.emit('question', 'do you think so?', function(answer) {});

    // sending without compression
    socket.compress(false).emit('uncompressed', "that's rough");

    // sending a message that might be dropped if the client is not ready to receive messages
    socket.volatile.emit('maybe', 'do you really need it?');

    // specifying whether the data to send has binary data
    socket.binary(false).emit('what', 'I have no binaries!');

    // sending to all clients on this node (when using multiple nodes)
    io.local.emit('hi', 'my lovely babies');

    // sending to all connected clients
    io.emit('an event sent to all connected clients');
};

io.on('connect', onConnect);

// Don't use to event name
// error
// connect
// disconnect
// disconnecting
// newListener
// removeListener
// ping
// pong

server.listen(port, () => {
    console.log(`listening on *:${port}`);
});
