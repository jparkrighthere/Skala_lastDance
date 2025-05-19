import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import path from 'path'
// import { createClient } from 'redis'; // Redis는 주석 처리됨
// import dotenv from 'dotenv'; // dotenv는 주석 처리됨
import { instrument } from '@socket.io/admin-ui'

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
const app = express()
const server = http.createServer(app)

const io = new Server(server, {
    cors: { origin: '*' },
})

instrument(io, {
    auth: false,
})

app.use(express.static(path.join(__dirname, '..', 'public')))

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'))
})

io.on('connection', (socket) => {
    socket.on('join_room', (roomName) => {
        socket.join(roomName)
        socket.to(roomName).emit('welcome')
    })
    socket.on('offer', (offer, roomName) => {
        socket.to(roomName).emit('offer', offer)
    })
    socket.on('answer', (answer, roomName) => {
        socket.to(roomName).emit('answer', answer)
    })
    socket.on('ice', (ice, roomName) => {
        socket.to(roomName).emit('ice', ice)
    })
    
    socket.on('leave_room', (roomName) => {
        socket.leave(roomName)
        socket.to(roomName).emit('peer_left') // 옵션: 남은 참가자에게 알림
        console.log(`A user left room: ${roomName}`)
    })
})

server.listen(3000, () => {
    console.log('Socket IO server listening on port 3000')
})
