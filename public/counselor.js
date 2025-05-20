// import { API_BASE_URL } from '../config'
const chatForm = document.getElementById('chat-form')
const chatInput = document.getElementById('chat-input')
const chatHistory = document.getElementById('chat-history')

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    const question = chatInput.value.trim()
    if (!question) return

    // 상담사 메시지 출력 (오른쪽)
    appendMessage('👤 상담사', question, 'user')

    // 챗봇 로딩 메시지 출력 (왼쪽)
    const loadingBubble = appendMessage('🤖 챗봇', '', 'bot')

    try {
        const answer = await callChatAPI(question)

        // Typewriter 애니메이션으로 응답 출력
        typewriterEffect(loadingBubble, answer)
    } catch (err) {
        loadingBubble.textContent = '❌ 챗봇 응답 오류'
    }

    chatInput.value = ''
})

function appendMessage(sender, text, type = 'user') {
    const wrapper = document.createElement('div')

    const senderLabel = document.createElement('div')
    senderLabel.className = 'chat-sender'
    senderLabel.textContent = sender

    const bubble = document.createElement('div')
    bubble.className = `chat-bubble ${type}`
    bubble.textContent = text

    wrapper.appendChild(senderLabel)
    wrapper.appendChild(bubble)
    chatHistory.appendChild(wrapper)
    chatHistory.scrollTop = chatHistory.scrollHeight

    return bubble
}

function typewriterEffect(element, text, speed = 30) {
    let i = 0
    function typing() {
        if (i < text.length) {
            element.textContent += text.charAt(i)
            i++
            setTimeout(typing, speed)
        }
    }
    typing()
}
// 목업 FastAPI 응답
// async function mockPostToFastAPI(question) {
//     console.log('[Mock] FastAPI 질문 전송:', question)
//     return new Promise((resolve) => {
//         setTimeout(() => {
//             resolve({ answer: `질문 "${question}" 에 대한 응답입니다.` })
//         }, 2000)
//     })
// }
// ✅ 실제 FastAPI 챗 API와 연결하는 함수
async function callChatAPI(question) {
    try {
        const response = await fetch(`https://5102-211-45-60-5.ngrok-free.app/chat/?q=${encodeURIComponent(question)}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true',
            },
        })

        const text = await response.text()
        console.log('🔍 응답 원문:', text)

        if (!response.ok) {
            throw new Error(`서버 오류 상태: ${response.status}`)
        }

        const result = JSON.parse(text) // 이 시점에서는 JSON이 확실한 경우만 파싱
        return result.answer
    } catch (err) {
        console.error('❌ GPT 서버 요청 실패:', err)
        return '서버 응답 실패'
    }
}
const chatbotBox = document.getElementById('chatbot-box')

// 외부 클릭으로만 열고 닫기
chatbotBox.addEventListener('click', (event) => {
    if (!chatbotBox.classList.contains('expanded')) {
        chatbotBox.classList.add('expanded')
        chatbotBox.classList.remove('minimized')
    }
})
// 내부 요소들 클릭 시 이벤트 전파 막기
const stopPropagationElements = ['chat-form', 'chat-input', 'chat-history']

stopPropagationElements.forEach((id) => {
    const el = document.getElementById(id)
    if (el) {
        el.addEventListener('click', (e) => {
            e.stopPropagation()
        })
    }
})
// 닫기 버튼 누르면 접힘
document.getElementById('chat-close-btn').addEventListener('click', (e) => {
    e.stopPropagation()
    chatbotBox.classList.remove('expanded')
    chatbotBox.classList.add('minimized')
})
