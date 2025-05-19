"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const path_1 = __importDefault(require("path"));
// import { createClient } from 'redis'; // Redis는 주석 처리됨
// import dotenv from 'dotenv'; // dotenv는 주석 처리됨
const admin_ui_1 = require("@socket.io/admin-ui");
// dotenv.config(); // 환경 설정 파일 로딩
// DB 연결 관련 코드 (필요하면 활성화 가능)
// const client = createClient({
//   socket: {
//     host: process.env.REDIS_HOST,
//     port: Number(process.env.REDIS_PORT),
//   }
// });
// client.on('connect', () => {
//   console.log('Redis client connected');
// });
// client.on('error', (err) => {
//   console.log('Something went wrong ' + err);
// });
// 서버 생성 및 Socket.io 연결
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: { origin: '*' },
});
(0, admin_ui_1.instrument)(io, {
    auth: false,
});
app.use(express_1.default.static(path_1.default.join(__dirname, '..', 'public')));
app.get('/', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '..', 'index.html'));
});
// 상담사 전용 페이지
app.get('/counselor', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '..', 'public/counselor.html'));
});
io.on('connection', (socket) => {
    socket.on('join_room', (roomName) => {
        socket.join(roomName);
        socket.to(roomName).emit('welcome');
    });
    socket.on('offer', (offer, roomName) => {
        socket.to(roomName).emit('offer', offer);
    });
    socket.on('answer', (answer, roomName) => {
        socket.to(roomName).emit('answer', answer);
    });
    socket.on('ice', (ice, roomName) => {
        socket.to(roomName).emit('ice', ice);
    });
});
server.listen(3000, () => {
    console.log('Socket IO server listening on port 3000');
});
