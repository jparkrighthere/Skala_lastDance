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
let remoteStream = null

// 녹음 관련
let mediaRecorder
let recordedChunks = []
let isRecording = false
let audioContext
let destination

// 중복 업로드 방지 플래그
let hasUploaded = false

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

// ✅ 상대방이 들어왔을 때만 오디오 믹싱 및 녹음 시작
async function startAudioRecording() {
    if (!myStream || !remoteStream) {
        console.warn('🎧 스트림이 준비되지 않았습니다.')
        return
    }

    // 중복 업로드 방지 플래그 초기화
    hasUploaded = false
    recordedChunks = []

    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)()
        destination = audioContext.createMediaStreamDestination()

        const localAudioSource = audioContext.createMediaStreamSource(myStream)
        const remoteAudioSource = audioContext.createMediaStreamSource(remoteStream)

        localAudioSource.connect(destination)
        remoteAudioSource.connect(destination)

        mediaRecorder = new MediaRecorder(destination.stream, { mimeType: 'audio/webm' })

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data)
            }
        }

        mediaRecorder.onstop = async () => {
            console.log('🛑 음성 녹음 종료')

            if (hasUploaded) {
                // 이미 업로드 완료되었으면 리턴
                return
            }
            hasUploaded = true

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
                console.log('✅ FastAPI 업로드 성공', result)
            } catch (error) {
                console.error('❌ 업로드 실패:', error)
                alert('FastAPI 서버로 파일 전송에 실패했습니다.')
            }
        }

        mediaRecorder.start()
        console.log('🎙️ 양방향 음성 녹음 시작')
    } catch (e) {
        console.error('❌ 오디오 믹싱 녹음 실패:', e)
    }
}

async function stopAudioRecording(upload = true) {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop()
    }

    if (audioContext) {
        await audioContext.close()
        audioContext = null
    }

    destination = null

    // upload는 stop 호출 시 업로드 여부 결정 플래그, 
    // 실제 업로드는 mediaRecorder.onstop 내부에서 hasUploaded 체크해서 진행
    if (upload && !hasUploaded) {
        hasUploaded = true
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
        await stopAudioRecording(true)  // 업로드 수행
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

// ✅ 누가 나가든 녹음 종료 & 업로드 중복 방지
socket.on('peer_left', async () => {
    console.log('👋 peer left')

    if (isRecording) {
        await stopAudioRecording(false)  // 업로드 하지 않음 (나간 쪽이 업로드 담당)
        isRecording = false
    }
})

// ✅ RTC 연결
function makeConnection() {
    myPeerConnection = new RTCPeerConnection({
        iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
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
    remoteStream = data.stream

    // 상대방이 들어왔으므로 녹음 시작
    if (!isRecording) {
        startAudioRecording()
        isRecording = true
    }
}
