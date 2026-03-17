# Buildmate Frontend

빌드메이트 프런트엔드 저장소입니다.

빌드메이트는 사이드 프로젝트 팀원을 찾고, 공개 질문과 실시간 협업 채팅으로 협업을 시작할 수 있는 팀 빌딩 서비스입니다. 초기 타깃은 AI 툴을 활용해 빠르게 MVP를 실험하는 메이커이지만, 서비스의 본질은 `팀원 모집 + 협업 시작` 흐름을 만드는 데 있습니다.

## 이 저장소의 역할
- 멀티페이지 프런트엔드
- 인증, 모집글, 공개 질문, 관심 표시, 협업 채팅, 프로필/계정 보안 화면 제공
- 별도 백엔드 API를 프록시하는 Express 정적 서버 포함

관련 백엔드 저장소: `/Users/junsu/Desktop/buildmate-be`

## 핵심 사용자 흐름
1. 사용자가 회원가입/로그인 후 프로젝트 모집글을 올립니다.
2. 다른 사용자가 목록과 상세에서 공개 질문을 남기거나 관심을 표시합니다.
3. 작성자 카드 또는 DM 진입점을 통해 1:1 협업 채팅으로 이어집니다.
4. unread/read와 브라우저 알림으로 협업 대화를 이어갑니다.

## 주요 화면
- `index.html`: 프로젝트 모집 보드
- `login.html`, `signup.html`: 인증 진입 화면
- `post_write.html`, `post_edit.html`: 모집글 작성/수정
- `post_detail.html`: 모집글 상세, 공개 질문, 관심 표시
- `dm.html`: 협업 채팅
- `profile.html`: 메이커 프로필
- `password.html`: 계정 보안

## 기술 스택
- Frontend: HTML, CSS, Vanilla JavaScript
- Server: Node.js, Express, `http-proxy-middleware`
- Testing: Playwright
- Backend API: 별도 서버 사용

## 로컬 실행
1. 의존성 설치

```bash
npm install
```

2. 프런트엔드 서버 실행

```bash
npm start
```

3. 브라우저 접속

```text
http://localhost:3000
```

기본 설정에서는 백엔드 API가 `http://127.0.0.1:8000`에서 실행 중이어야 정상 동작합니다.

환경 변수 예시는 `.env.example`을 참고하세요.

## 프로젝트 구조
```text
.
├── css/                 # 페이지별 스타일
├── js/                  # 페이지별 로직과 공통 유틸
├── src/server.js        # 정적 파일 서빙 + API 프록시
├── tests/e2e/           # Playwright E2E
├── docs/                # 리브랜딩 계획 및 카피 문서
├── *.html               # 각 페이지 엔트리
└── README.md
```

## 관련 문서
- `docs/BUILDMATE_START_HERE.md`
- `docs/BUILDMATE_REBRANDING_PLAN.md`
- `docs/BUILDMATE_COPY_TEXTS.md`
- `docs/BUILDMATE_IMPLEMENTATION_CHECKLIST.md`
- `docs/BUILDMATE_SESSION_CHECKPOINT_2026-03-17.md`
- `docs/BUILDMATE_README_INTRO_DRAFT.md`
