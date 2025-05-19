const socket = io()

const myFace = document.getElementById('myFace')
const muteBtn = document.getElementById('mute')
const cameraBtn = document.getElementById('camera')
const camerasSelect = document.getElementById('cameras')

const call = document.getElementById('call')
call.hidden = true

let myStream
let muted = false
let cameraOff = false
let roomName
let myPeerConnection

// 녹음 관련
let mediaRecorder
let recordedChunks = []
let isRecording = false
let audioStream

async function getCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const cameras = devices.filter((device) => device.kind === 'videoinput')
        const currentCamera = myStream.getVideoTracks()[0]
        cameras.forEach((camera) => {
            const option = document.createElement('option')
            option.value = camera.deviceId
            option.innerText = camera.label
            if (currentCamera.label === camera.label) {
                option.selected = true
            }
            camerasSelect.appendChild(option)
        })
    } catch (e) {
        console.log(e)
    }
}

async function getMedia(deviceId) {
    const initialConstraints = {
        audio: true,
        video: { facingMode: 'user' },
    }
    const cameraConstraints = {
        audio: true,
        video: { deviceId: { exact: deviceId } },
    }
    try {
        myStream = await navigator.mediaDevices.getUserMedia(deviceId ? cameraConstraints : initialConstraints)
        myFace.srcObject = myStream
        if (!deviceId) {
            await getCameras()
        }
    } catch (e) {
        console.log(e)
    }
}

// 자동 음성 녹음 시작
async function startAudioRecording() {
    try {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })

        recordedChunks = []
        mediaRecorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm' })

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data)
            }
        }

        mediaRecorder.onstop = async () => {
            console.log('🛑 음성 녹음 종료')

            const blob = new Blob(recordedChunks, { type: 'audio/webm' })
            const formData = new FormData()
            const filename = `recording_${Date.now()}.webm`
            formData.append('file', blob, filename)

            try {
                const response = await fetch('https://0681-211-45-60-5.ngrok-free.app/consult/upload', {
                    method: 'POST',
                    body: formData,
                })

                if (!response.ok) throw new Error('업로드 실패')

                const result = await response.json()
                console.log('✅ FastAPI 업로드  성공', result)
            } catch (error) {
                console.error('❌ FastAPI 업로드 오류:', error)
                alert('FastAPI 서버로 파일 전송에 실패했습니다.')
            }
        }

        mediaRecorder.start()
        console.log('🎙️ 음성 녹음 시작')
    } catch (e) {
        console.error('❌ 마이크 접근 실패:', e)
        alert('마이크 사용 권한을 허용해주세요!')
    }
}

// 자동 녹음 종료
async function stopAudioRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop()
    }

    if (audioStream) {
        audioStream.getTracks().forEach((track) => track.stop())
        audioStream = null
    }
}

muteBtn.addEventListener('click', () => {
    myStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled
    })
    muteBtn.innerText = muted ? 'Mute' : 'Unmute'
    muted = !muted
})

cameraBtn.addEventListener('click', () => {
    myStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled
    })
    cameraBtn.innerText = cameraOff ? 'Turn Camera Off' : 'Turn Camera On'
    cameraOff = !cameraOff
})

camerasSelect.addEventListener('input', async () => {
    await getMedia(camerasSelect.value)
    if (myPeerConnection) {
        const videoTrack = myStream.getVideoTracks()[0]
        const videoSender = myPeerConnection.getSenders().find((sender) => sender.track.kind === 'video')
        if (videoSender) {
            videoSender.replaceTrack(videoTrack)
        }
    }
})

// 방 입장
const welcome = document.getElementById('welcome')
const welcomeForm = welcome.querySelector('form')

async function initCall() {
    welcome.hidden = true
    call.hidden = false
    await getMedia()
    makeConnection()

    // 첫 참가자도 녹음 시작
    if (!isRecording) {
        await startAudioRecording()
        isRecording = true
    }
}

welcomeForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const input = welcomeForm.querySelector('input')
    await initCall()
    socket.emit('join_room', input.value)
    roomName = input.value
    input.value = ''
})

// 방 나가기
const exitBtn = document.getElementById('exitBtn')
exitBtn.addEventListener('click', async () => {
    if (myPeerConnection) {
        myPeerConnection.close()
        myPeerConnection = null
    }

    if (myStream) {
        myStream.getTracks().forEach((track) => track.stop())
        myStream = null
    }

    if (isRecording) {
        await stopAudioRecording()
        isRecording = false
    }

    call.hidden = true
    welcome.hidden = false

    socket.emit('leave_room', roomName)
    roomName = null

    console.log('🚪 방을 나갔습니다.')
})

// ✅ Socket Events
socket.on('welcome', async () => {
    const offer = await myPeerConnection.createOffer()
    myPeerConnection.setLocalDescription(offer)
    socket.emit('offer', offer, roomName)
    console.log('📤 sent the offer')

    if (!isRecording) {
        await startAudioRecording()
        isRecording = true
    }
})

socket.on('offer', async (offer) => {
    console.log('📩 received the offer')
    myPeerConnection.setRemoteDescription(offer)
    const answer = await myPeerConnection.createAnswer()
    myPeerConnection.setLocalDescription(answer)
    socket.emit('answer', answer, roomName)
    console.log('📤 sent the answer')
})

socket.on('answer', (answer) => {
    myPeerConnection.setRemoteDescription(answer)
    console.log('📩 received the answer')
})

socket.on('ice', (ice) => {
    myPeerConnection.addIceCandidate(ice)
    console.log('📩 received ICE candidate')
})

// ✅ peer가 떠날 때 자동 녹음 종료
socket.on('peer_left', async () => {
    console.log('👋 peer left')

    if (isRecording) {
        await stopAudioRecording()
        isRecording = false
    }
})

// RTC 연결
function makeConnection() {
    myPeerConnection = new RTCPeerConnection({
        iceServers: [
            { urls: ['stun:stun.l.google.com:19302'] },
        ],
    })
    myPeerConnection.addEventListener('icecandidate', handleIce)
    myPeerConnection.addEventListener('addstream', handleAddStream)
    myStream.getTracks().forEach((track) => {
        myPeerConnection.addTrack(track, myStream)
    })
}

function handleIce(data) {
    socket.emit('ice', data.candidate, roomName)
    console.log('📤 sent ICE candidate')
}

function handleAddStream(data) {
    const peersFace = document.getElementById('peersFace')
    peersFace.srcObject = data.stream
}
