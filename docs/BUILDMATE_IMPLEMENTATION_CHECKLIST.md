# Buildmate Implementation Checklist

이 문서는 새 세션에서 바로 리브랜딩 구현에 들어갈 수 있도록, 실제 표면과 순서를 정리한 체크리스트입니다.

## 0. 먼저 해야 할 일
- 이 문서를 source of truth로 사용하고, 구현 전에 새 인벤토리를 다시 설계하지 않습니다.
- Playwright에서 텍스트에 의존하는 assertion 위치만 먼저 확인합니다.
- 공유 헤더/프로필/작성자 카드 문자열부터 먼저 정리합니다.
- 구현 마지막 단계에서 grep으로 남은 원본 문자열만 역검증합니다.
- 아래 `반드시 확인할 실제 문자열` 섹션은 `새 카피`가 아니라 `제거되어야 할 원본 문자열` 목록입니다.

## 1. 실제 수정 대상 표면
### HTML
- `index.html`
- `login.html`
- `signup.html`
- `post_write.html`
- `post_edit.html`
- `post_detail.html`
- `profile.html`
- `password.html`
- `dm.html`

### CSS
- `css/common.css`
- `css/posts.css`
- `css/login.css`
- `css/signup.css`
- `css/post_write.css`
- `css/post_detail.css`
- `css/dm.css`
- `css/profile.css`
- `css/password.css`

### JS
- `js/common.js`
  - 헤더 프로필 드롭다운
  - 작성자 카드 캡션/CTA
  - 헤더 DM 버튼 visible text와 `aria-label`
  - 공통 로그인 필요 문구 점검
- `js/post_detail.js`
  - 댓글 버튼/상태/empty state
- `js/dm.js`
  - 연결 상태 문구
  - empty state
  - push 상태 힌트
  - room preview fallback
  - room 미선택 상태
- `js/posts.js`
  - 메인 목록 empty state
  - 카드 상태 배지
  - 카드 통계/메타 라벨
- `js/login.js`
- `js/signup.js`
- `js/profile.js`
- `js/password.js`
- `js/post_write.js`
- `js/post_edit.js`

### 문서
- `README.md`
- 필요 시 프로젝트 소개/영상용 문구 문서

### 테스트
- `tests/e2e/auth-profile.spec.cjs`
- `tests/e2e/posts-dm.spec.cjs`
- `tests/e2e/helpers.cjs`
- 카피 변경으로 selector가 깨지는 부분 확인

## 2. 구현 순서
### Step 1. 공유 셸
- 로고 텍스트
- DM 버튼 텍스트
- DM 버튼 `aria-label`
- 헤더 버튼 폭/정렬 등 `css/common.css` 레이아웃 보정
- 프로필 드롭다운 텍스트
- 작성자 카드 캡션/CTA

### Step 2. 진입 화면
- 메인 페이지 카피
- 로그인/회원가입 카피
- 메인/로그인/회원가입 보조 설명용 DOM 노드 추가
- 보조 설명 추가 후 레이아웃과 줄바꿈 확인
- 페이지별 CSS 보정
- 모집/합류 양쪽 CTA 문맥 정리

### Step 3. 모집글 흐름
- 글 작성/수정 페이지 제목과 안내 문구
- 글 작성/수정의 구조 가이드 또는 starter template 반영
- 카드의 `모집 중` 배지와 `관심 / 질문 / 조회` 메타 라벨 반영
- 본문 접두어(`현재 단계:`, `필요 역할:`, `사용 도구:`, `협업 방식:`, `합류 형태:`)를 상세 key facts로 노출할 규칙 반영
- 상세 페이지 통계/댓글 문구
- 상세 삭제 모달 문구 정리
- 질문/관심/협업 제안의 역할 구분 정리

### Step 4. 협업 채팅 흐름
- DM 제목/상태/empty state
- push 힌트
- 협업 메시지 placeholder
- room preview fallback과 room 미선택 상태 문구 정리
- 연결 완료/끊김/재연결 상태 문구 정리

### Step 5. 메이커 프로필 흐름
- 프로필 제목/버튼
- 계정 보안 페이지 제목/버튼
- 저장 버튼과 이동 버튼 의미 분리
- 탈퇴 안내 문구

### Step 6. README와 데모 문구
- README 소개문 교체
- 영상 데모 흐름 문구 정리

### Step 7. 테스트 보정
- Playwright text assertion 업데이트
- `helpers.cjs`의 성공 문구 assertion 업데이트
- 필요한 경우 selector를 텍스트 의존보다 구조 의존으로 변경
- 전체 E2E 재실행

## 3. 반드시 확인할 실제 문자열
- `아무 말 대잔치`
- `DM`
- `aria-label="DM"`
- `게시글이 없습니다. 첫 글을 작성해보세요!`
- `게시글 작성`
- `게시글 수정`
- `회원정보수정`
- `비밀번호수정`
- `좋아요수`
- `댓글 등록`
- `채팅하기`
- `대화 목록`
- `대화 상대를 선택해주세요.`
- `대화방이 없습니다.`
- `아직 시작한 대화가 없습니다.`
- `실시간 1:1 대화를 지원합니다.`
- `실시간 연결됨`
- `메시지를 시작해보세요.`
- `메시지를 입력하세요`
- `게시글이 작성되었습니다.`
- `게시글 작성에 실패했습니다.`
- `게시글이 수정되었습니다.`
- `게시글이 삭제되었습니다.`
- `게시글을 삭제하시겠습니까?`
- `삭제한 내용은 복구 할 수 없습니다.`
- `댓글 등록에 실패했습니다.`
- `댓글 삭제에 실패했습니다.`
- `아직 메시지가 없습니다.`
- `수정하기`
- `수정완료`
- `수정 완료`
- `회원탈퇴 하시겠습니까?`
- `작성된 게시글, 댓글, DM 기록은 삭제됩니다.`

## 4. 완료 판단 기준
- 첫 화면에서 `빌드메이트`와 `팀원 모집 서비스`라는 정체성이 즉시 보인다.
- 모집글 작성/상세/댓글/DM이 한 흐름으로 이해된다.
- 프로필과 DM이 협업 문맥으로 자연스럽게 이어진다.
- Playwright가 수정된 카피 기준으로 다시 green이다.
- README 소개가 제품 관점으로 정리돼 있다.
