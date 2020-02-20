// IMPORT
// Lib
import axios from 'axios';
import { cacheAdapterEnhancer } from 'axios-extensions';
import morgan from 'morgan';

// Node
import http from 'http';

// Server
import cors from 'cors';
import express from 'express';

// Socket
import socketIo from 'socket.io';

// Config
import { config } from './config.js';

// VARIABLE
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const corsOptions = {
    origin: (origin, callback) => {
        if (JSON.parse(config.cors) && origin !== config.corsUrl) {
            return callback('Origin not allowed', false);
        }

        return callback(null, true);
    },
    optionsSuccessStatus: 200
};

const apiCache1Day = axios.create({
    adapter: cacheAdapterEnhancer(axios.defaults.adapter, { maxAge: 1000 * 60 * 60 * 24, max: 1000 }),
    baseURL: '/',
    headers: { 'Cache-Control': 'no-cache' }
});

// const apiCache30Day = axios.create({
//     adapter: cacheAdapterEnhancer(axios.defaults.adapter, { maxAge: 1000 * 60 * 60 * 24 * 30, max: 300000000 }),
//     baseURL: '/',
//     headers: { 'Cache-Control': 'no-cache' }
// });

let interval = null;

// CONFIG
// app.use(express.static(config.pathPublic));

app.use(morgan(':method :url :status :response-time ms'));

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', JSON.parse(config.cors) ? config.corsUrl : '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'content-type');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Credentials', true);

    next();
});

// GET
app.get('/', cors(corsOptions), (req, res) => {
    res.json({ msg: 'Micro Serviço - Cotações' });
    // res.sendFile(path.join(__dirname, '../public/index.html'));
});

// FUNCTION
/**
 * @description Busca API da CDI do Banco Central.
 */
const getApiCdi = async () => {
    try {
        const result = await apiCache1Day.get('https://api.bcb.gov.br/dados/serie/bcdata.sgs.4389/dados/ultimos/2?formato=json');

        const variation = parseFloat(result.data[1].valor) - parseFloat(result.data[0].valor);

        return { value: parseFloat(result.data[1].valor).toFixed(2), operator: variation < 0 && '-', variation: `${variation > 0 ? '+' : ''}${variation.toFixed(2)}` };
    } catch (error) {
        console.error(`Error getApiCDI: ${error.code}`);
    }

    return null;
};

/**
 * @description Busca API da Infomoney.
 * (Obs: caso ocorra algum erro, provavelmente chegou no limite de requisições permitidas da Infomoney,
 * pode ser usado os dados da HG Brasil no lugar da Infomoney).
 */
const getApiInfomoney = async () => {
    const valuesToRemove = ['ABEV3', 'GGBR4', 'IFIX', 'ITUB4', 'MGLU3', 'PETR4', 'VALE3'];

    try {
        const result = await axios.get('https://api.infomoney.com.br/ativos/ticker?type=json&_=1143');

        const newResult = result.data.filter((elem) => {
            return valuesToRemove.indexOf(elem.Name) === -1;
        });

        return newResult;
    } catch (error) {
        console.error(`Error getApiInfomoney: ${error.code}`);
    }

    return null;
};

/**
 * @description Busca API da Poupança do Banco Central.
 */
const getApiPoupanca = async () => {
    try {
        const result = await apiCache1Day.get('https://api.bcb.gov.br/dados/serie/bcdata.sgs.195/dados/ultimos/2?formato=json');

        const variation = parseFloat(result.data[1].valor) - parseFloat(result.data[0].valor);

        return { value: parseFloat(result.data[1].valor).toFixed(2), operator: variation < 0 && '-', variation: `${variation > 0 ? '+' : ''}${variation.toFixed(2)}` };
    } catch (error) {
        console.error(`Error getApiPoupanca: ${error.code}`);
    }

    return null;
};

/**
 * @description Busca API da SELIC do Banco Central.
 */
const getApiSelic = async () => {
    try {
        const result = await apiCache1Day.get('https://api.bcb.gov.br/dados/serie/bcdata.sgs.1178/dados/ultimos/2?formato=json');

        const variation = parseFloat(result.data[1].valor) - parseFloat(result.data[0].valor);

        return { value: parseFloat(result.data[1].valor).toFixed(2), operator: variation < 0 && '-', variation: `${variation > 0 ? '+' : ''}${variation.toFixed(2)}` };
    } catch (error) {
        console.error(`Error getApiSELIC: ${error.code}`);
    }

    return null;
};

/**
 * @description Busca todas as API's.
 * @param {object} socket Objeto do socket.io.
 */
const getApis = async (socket) => {
    try {
        const [resultCdi, resultInfomoney, resultPoupanca, resultSelic] = await Promise.all([getApiCdi(), getApiInfomoney(), getApiPoupanca(), getApiSelic()]);

        socket.emit('quotationData', JSON.stringify({ bolsa: resultInfomoney, cdi: resultCdi, poupanca: resultPoupanca, selic: resultSelic }));
    } catch (error) {
        console.error(`Error getApis: ${error.code}`);
    }
};

const getDateTime = () => {
    const today = new Date();
    const dateTime = `${today.getHours()}:${today.getMinutes()}:${today.getSeconds()} - ${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;

    return dateTime;
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
io.origins((origin, callback) => {
    console.log(`Origin: ${origin} - ${getDateTime()}`);
    console.log(`Env corsUrl: ${config.corsUrl} - ${getDateTime()}`);

    if (JSON.parse(config.cors) && origin !== config.corsUrl) {
        return callback('Origin not allowed', false);
    }

    return callback(null, true);
});

io.on('connection', (socket) => {
    try {
        console.log(`Log: new user connected - ${getDateTime()}`);

        getApis(socket);

        if (interval) {
            clearInterval(interval);
        }

        // Intervalo de 1 minuto
        interval = setInterval(() => {
            console.clear();

            console.log(`Log: get API in ${getDateTime()}`);

            getApis(socket);
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

server.listen(config.port, () => {
    console.log(`listening on *:${config.port}`);
});
