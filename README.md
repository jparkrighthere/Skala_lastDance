# 🎙️ Skala_LastDance - WebRTC 기반 실시간 음성 상담 & 녹음 웹앱

> 실시간 상담을 위한 WebRTC 연결과, 상담 중 음성 녹음을 지원하는 웹 애플리케이션입니다.  
> 상담 종료 시 자동으로 음성 파일을 `.webm` 형식으로 저장할 수 있습니다.

---

## 📸 주요 기능

-   ✅ **WebRTC를 통한 실시간 1:1 상담 연결**
-   🎤 **브라우저에서 마이크 음성만 녹음**
-   ⏺️ **상담 시작/종료 버튼으로 음성 녹음 제어**
-   💾 **녹음 종료 시 자동 `.webm` 파일 다운로드**
-   📦 FastAPI 업로드 또는 Whisper STT 연동 확장 가능

---

## 📁 프로젝트 구조

```text
Skala_LastDance/
├── public/
│ └── app.js # 메인 WebRTC + 녹음 로직
├── index.html # 클라이언트 UI
├── server.ts # Express + Socket.IO 서버 (TypeScript)
├── tsconfig.json
├── package.json
└── dist/ # 컴파일된 JS 파일 (tsc 실행 결과)
```

---

## 🚀 실행 방법

### 1. Node.js 의존성 설치

```bash
npm install
```

### 2. Typescript 컴파일

```bash
npx tsc
```

### 3. 서버 실행

```bash
node dist/server.js
```

### 4. 접속

-   브라우저에서: http://localhost:3000
-   두 개의 창/탭에서 같은 Room 이름으로 접속 시 실시간 상담 연결

## 사용법

1. 메인 페이지에서 Room 이름을 입력하고 입장합니다.
2. 다른 사용자가 같은 Room 이름으로 입장하면 WebRTC로 자동 연결됩니다.
3. [Start Recording] 버튼을 누르면 마이크 녹음이 시작됩니다.
4. [Stop Recording] 버튼을 누르면 녹음이 중지되고 .webm 파일이 자동 다운로드됩니다.

## 주의사항

-   영상 스트림은 사용하지 않으며, 오직 오디오 스트림만 활용합니다.
-   Safari 브라우저는 MediaRecorder를 지원하지 않으므로, Chrome / Firefox / Edge를 사용해 주세요.
-   저장된 .webm 파일은 Whisper 등 STT 모델로 바로 처리 가능합니다.
