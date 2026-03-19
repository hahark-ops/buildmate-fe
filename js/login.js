// login.js - API_BASE_URL, showCustomModal은 common.js에서 제공

document.addEventListener('DOMContentLoaded', () => {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    const emailError = document.getElementById('emailError');
    const passwordError = document.getElementById('passwordError');
    const defaultLoginLabel = loginBtn.textContent.trim();

    // 정규식 패턴
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])\S{8,20}$/;

    async function parseApiResponse(response) {
        const text = await response.text();
        if (!text) return {};
        try {
            return JSON.parse(text);
        } catch (_) {
            return { message: text };
        }
    }

    function validateInput() {
        const email = emailInput.value;
        const password = passwordInput.value;

        let isEmailValid = false;
        let isPasswordValid = false;

        // 이메일 유효성 검사
        if (!email) {
            emailError.textContent = "이메일을 입력해주세요.";
            emailError.classList.add('show');
        } else if (!emailRegex.test(email)) {
            emailError.textContent = "올바른 이메일 주소 형식을 입력해주세요. (예: example@example.com)";
            emailError.classList.add('show');
        } else {
            emailError.textContent = "";
            emailError.classList.remove('show');
            isEmailValid = true;
        }

        // 비밀번호 유효성 검사
        if (!password) {
            passwordError.textContent = "비밀번호를 입력해주세요.";
            passwordError.classList.add('show');
        } else if (!passwordRegex.test(password)) {
            passwordError.textContent = "비밀번호는 8~20자, 대/소문자/숫자/특수문자를 포함해야 합니다.";
            passwordError.classList.add('show');
        } else {
            passwordError.textContent = "";
            passwordError.classList.remove('show');
            isPasswordValid = true;
        }

        // 버튼 상태 업데이트
        if (isEmailValid && isPasswordValid) {
            loginBtn.disabled = false;
            loginBtn.classList.add('active');
        } else {
            loginBtn.disabled = true;
            loginBtn.classList.remove('active');
        }
    }

    // 이벤트 리스너 (입력값 실시간 검증)
    emailInput.addEventListener('input', validateInput);
    passwordInput.addEventListener('input', validateInput);

    // 초기 검증 실행
    validateInput();

    // 폼 제출 (Fetch API 사용)
    const loginForm = document.getElementById('loginForm');
    loginForm.addEventListener('submit', async function (event) {
        event.preventDefault();

        if (loginBtn.disabled) {
            return;
        }

        const email = emailInput.value;
        const password = passwordInput.value;

        try {
            // 로딩 상태 표시
            loginBtn.textContent = `${defaultLoginLabel}...`;
            loginBtn.disabled = true;

            // Fetch API 호출
            const response = await fetch(`${API_BASE_URL}/v1/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include', // 쿠키 포함 (세션 유지)
                body: JSON.stringify({
                    email: email,
                    password: password
                })
            });

            const result = await parseApiResponse(response);

            if (response.ok) {
                // 로그인 성공
                // localStorage에 세션 정보 저장 (프론트엔드 상태 관리용)
                const userData = (result.data && result.data.user) ? result.data.user : result.data;
                const token = (result.data && result.data.token) ? result.data.token : null;

                if (userData) {
                    localStorage.setItem('user', JSON.stringify(userData));
                    // 편의를 위해 개별 필드도 저장 (다른 페이지에서 쉽게 접근)
                    if (userData.userId) localStorage.setItem('userId', userData.userId);
                    if (userData.nickname) localStorage.setItem('nickname', userData.nickname);
                    if (userData.email) localStorage.setItem('email', userData.email);
                    if (userData.profileImage) localStorage.setItem('profileImage', userData.profileImage);
                }
                if (token) {
                    localStorage.setItem('token', token);
                    localStorage.setItem('accessToken', token); // 호환성 유지
                }

                // showCustomModal('로그인 성공!', () => {
                //     window.location.href = 'index.html';
                // });
                window.location.href = 'index.html';
            } else {
                // 로그인 실패 (서버에서 보낸 에러 메시지 표시)
                const message = result.message || `요청 처리에 실패했습니다. (HTTP ${response.status})`;
                showCustomModal(`로그인 실패\n${message}`);
                loginBtn.textContent = defaultLoginLabel;
                loginBtn.disabled = false;
                loginBtn.classList.add('active');
            }
        } catch (error) {
            // 네트워크 에러 등
            console.error('Login error:', error);
            showCustomModal('서버 연결에 실패했습니다. 백엔드 서버가 실행 중인지 확인해주세요.');
            loginBtn.textContent = defaultLoginLabel;
            loginBtn.disabled = false;
            loginBtn.classList.add('active');
        }
    });
});
