// Lib
import axios from 'axios';
import { cacheAdapterEnhancer } from 'axios-extensions';

// Node
import http from 'http';
import path from 'path';

// Server
import express from 'express';

// Socket
import socketIo from 'socket.io';

// Config
import { pathPublic, port } from './config.js';

// VARIABLE
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const apiCache1Day = axios.create({
    adapter: cacheAdapterEnhancer(axios.defaults.adapter, { maxAge: 1000 * 60 * 60 * 24, max: 1000 }),
    baseURL: '/',
    headers: { 'Cache-Control': 'no-cache' }
});

const apiCache30Day = axios.create({
    adapter: cacheAdapterEnhancer(axios.defaults.adapter, { maxAge: 1000 * 60 * 60 * 24 * 30, max: 300000000 }),
    baseURL: '/',
    headers: { 'Cache-Control': 'no-cache' }
});

let interval = null;

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

// GET
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/index.html'));
});

// FUNCTION
const getApi = async (socket) => {
    try {
        const result = await axios.get('https://api.infomoney.com.br/ativos/ticker?type=json&_=1143');

        socket.emit('msg', JSON.stringify(result.data));
    } catch (error) {
        console.error(`Error: ${error.code}`);
    }
};

const getInfo = () => {
    console.log(`Running in: ${process.env.NODE_ENV}`);

    const today = new Date();
    const dateTime = `${today.getHours()}:${today.getMinutes()}:${today.getSeconds()} - ${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;

    console.log(`Log: get API in ${dateTime}`);
};

// SOCKET
// Middleware
// io.use((socket, next) => {
//     let token = socket.handshake.query.token;

//     if (isValid(token)) {
//         return next();
//     }

//     return next(new Error('authentication error'));
// });

// Origins
// io.origins((origin, callback) => {
//     if (origin !== 'https://foo.example.com') {
//         return callback('origin not allowed', false);
//     }

//     return callback(null, true);
// });

io.on('connection', (socket) => {
    try {
        console.log('Log: new user connected');

        getInfo();

        getApi(socket);

        if (interval) {
            clearInterval(interval);
        }

        // Intervalo a cada 1 minuto
        interval = setInterval(() => {
            console.clear();

            getInfo();

            getApi(socket);
        }, 60000);

        socket.on('msg', (msg) => {
            console.log(`msg: ${msg}`);

            io.emit('msg', 'Olá no caso do msg');
        });

        socket.on('msgCallback', (msg, other, fn) => {
            console.log(`msgCallback: ${msg}`);
            fn(`${msg} says ${other}`);
        });

        socket.on('disconnect', (reason) => {
            console.info('User disconnect: ', reason);
        });

        socket.on('disconnecting', (reason) => {
            console.info('User disconnecting: ', reason);
        });

        socket.on('error', (error) => {
            console.error('Error: ', error);
        });
    } catch (error) {
        console.error('Error: ', error);
    }
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
    socket.to('game').emit('nice game', 'lets play a game');

    // sending to all clients in 'game1' and/or in 'game2' room, except sender
    socket
        .to('game1')
        .to('game2')
        .emit('nice game', 'lets play a game (too)');

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
    socket.emit('question', 'do you think so?', (answer) => {
        return null;
    });

    // sending without compression
    socket.compress(false).emit('uncompressed', 'thats rough');

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
// connect
// error
// disconnect
// disconnecting
// newListener
// ping
// pong
// removeListener

server.listen(port, () => {
    console.log(`listening on *:${port}`);
});
