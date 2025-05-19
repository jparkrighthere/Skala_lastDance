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

// Record Function
const recordBtn = document.getElementById('recordBtn')
let mediaRecorder
let recordedChunks = []
let isRecording = false

async function getCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices() //api call that shows all devices
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
    const initialConstrains = {
        audio: true,
        video: { facingMode: 'user' },
    }
    const cameraConstraints = {
        audio: true,
        video: { deviceId: { exact: deviceId } },
    }
    try {
        myStream = await navigator.mediaDevices.getUserMedia(deviceId ? cameraConstraints : initialConstrains) // api call that gets the media
        myFace.srcObject = myStream // setting the video stream to the video element
        if (!deviceId) {
            await getCameras()
        }
    } catch (e) {
        console.log(e)
    }
}
// 녹음 시작 함수
async function startAudioRecording() {
    try {
        // 오디오만 요청
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
            const url = URL.createObjectURL(blob)

            const a = document.createElement('a')
            a.href = url
            a.download = `recording_${Date.now()}.webm`
            a.style.display = 'none'
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)

            // Send FastAPI
            const formData = new FormData()
            const filename = `recording_${Date.now()}.webm`
            formData.append('file', blob, filename)

            try {
                const response = await fetch('http://localhost:8000/upload-audio', {
                    method: 'POST',
                    body: formData,
                })

                if (!response.ok) {
                    throw new Error('업로드 실패')
                }
                const result = await response.json()
                console.log('FastAPI 업로드 성공', result)
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

// 녹음 종료 함수
async function stopAudioRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.onstop = async () => {
            console.log('🛑 음성 녹음 종료')

            const blob = new Blob(recordedChunks, { type: 'audio/webm' })
            const url = URL.createObjectURL(blob)

            const a = document.createElement('a')
            a.href = url
            a.download = `recording_${Date.now()}.webm`
            a.style.display = 'none'
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url) // 메모리 정리

            // Send FastAPI
            const formData = new FormData()
            const filename = `recording_${Date.now()}.webm`
            formData.append('file', blob, filename)

            try {
                const response = await fetch('http://localhost:8000/upload-audio', {
                    method: 'POST',
                    body: formData,
                })

                if (!response.ok) {
                    throw new Error('업로드 실패')
                }
                const result = await response.json()
                console.log('FastAPI 업로드 성공', result)
            } catch (error) {
                console.error('❌ FastAPI 업로드 오류:', error)
                alert('FastAPI 서버로 파일 전송에 실패했습니다.')
            }
        }

        mediaRecorder.stop() // onstop은 여기 이후에 실행됨
    }

    if (audioStream) {
        audioStream.getTracks().forEach((track) => track.stop())
    }
}

muteBtn.addEventListener('click', () => {
    myStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled
    })
    if (!muted) {
        muteBtn.innerText = 'Unmute'
        muted = true
    } else {
        muteBtn.innerText = 'Mute'
        muted = false
    }
})

cameraBtn.addEventListener('click', () => {
    myStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled
    })
    if (!cameraOff) {
        cameraBtn.innerText = 'Turn Camera On'
        cameraOff = true
    } else {
        cameraBtn.innerText = 'Turn Camera Off'
        cameraOff = false
    }
})

camerasSelect.addEventListener('input', async () => {
    await getMedia(camerasSelect.value)
    if (myPeerConnection) {
        const videoTrack = myStream.getVideoTracks()[0]
        const videoSender = myPeerConnection.getSenders().find((sender) => sender.track.kind === 'video')
        videoSender.replaceTrack(videoTrack)
    }
})
// 녹음 시작 버튼
recordBtn.addEventListener('click', () => {
    if (!isRecording) {
        startAudioRecording()
        recordBtn.innerText = 'Stop Recording'
        isRecording = true
    } else {
        stopAudioRecording()
        recordBtn.innerText = 'Start Recording'
        isRecording = false
    }
})

// Welcome Form (Choose a room)
const welcome = document.getElementById('welcome')
welcomeForm = welcome.querySelector('form')

async function initCall() {
    welcome.hidden = true
    call.hidden = false
    await getMedia()
    makeConnection()
}

welcomeForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const input = welcomeForm.querySelector('input')
    await initCall()
    socket.emit('join_room', input.value)
    roomName = input.value
    input.value = ''
})

const exitBtn = document.getElementById('exitBtn')

exitBtn.addEventListener('click', () => {
    if (myPeerConnection) {
        myPeerConnection.close()
        myPeerConnection = null
    }

    // 미디어 스트림 정리
    if (myStream) {
        myStream.getTracks().forEach((track) => track.stop())
        myStream = null
    }

    // UI 초기화
    call.hidden = true
    welcome.hidden = false

    // 서버에 방 퇴장 알리기 (선택)
    socket.emit('leave_room', roomName)
    roomName = null

    console.log('🚪 방을 나갔습니다.')
})

// Socket Code

// in Brave
socket.on('welcome', async () => {
    const offer = await myPeerConnection.createOffer()
    myPeerConnection.setLocalDescription(offer)
    console.log('sent the offer')
    socket.emit('offer', offer, roomName)
})

// in FireFox
socket.on('offer', async (offer) => {
    console.log('received the offer')
    myPeerConnection.setRemoteDescription(offer)
    const answer = await myPeerConnection.createAnswer()
    myPeerConnection.setLocalDescription(answer)
    socket.emit('answer', answer, roomName)
    console.log('sent the answer')
})

// back in Brave
socket.on('answer', (answer) => {
    myPeerConnection.setRemoteDescription(answer)
    console.log('received the answer')
})

socket.on('ice', (ice) => {
    myPeerConnection.addIceCandidate(ice)
    console.log('received candidate')
})

// RTC code
function makeConnection() {
    myPeerConnection = new RTCPeerConnection({
        iceServers: [
            {
                urls: [
                    'stun:stun.l.google.com:19302',
                    'stun:stun1.l.google.com:19302',
                    'stun:stun2.l.google.com:19302',
                    'stun:stun3.l.google.com:19302',
                    'stun:stun4.l.google.com:19302',
                    // We need to implement our own STUN server as we make our web app
                ],
            },
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
    console.log('sent candidate')
}

function handleAddStream(data) {
    const peersFace = document.getElementById('peersFace')
    peersFace.srcObject = data.stream
}
