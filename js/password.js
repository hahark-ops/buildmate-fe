// password.js - API_BASE_URL, showCustomModal은 common.js에서 제공

document.addEventListener('DOMContentLoaded', () => {
    const isPreviewMode = new URLSearchParams(window.location.search).get('preview') === 'stitch';
    // ==========================================
    // 1. 요소 가져오기
    // ==========================================
    // 헤더 및 드롭다운
    const profileIcon = document.getElementById('profileIcon');
    const profileDropdown = document.getElementById('profileDropdown');
    const logoutBtn = document.getElementById('logoutBtn');

    // 폼 입력 필드
    const accountEmailInput = document.getElementById('accountEmail');
    const accountEmailDisplay = document.getElementById('accountEmailDisplay');
    const currentPasswordInput = document.getElementById('currentPassword');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');

    // 헬퍼 텍스트
    const currentPasswordHelper = document.getElementById('currentPasswordHelper');
    const newPasswordHelper = document.getElementById('newPasswordHelper');
    const confirmPasswordHelper = document.getElementById('confirmPasswordHelper');

    const submitBtn = document.getElementById('submitBtn');
    const toast = document.getElementById('toast');

    // 상태 변수
    let currentUser = null;
    const previewUser = {
        userId: 101,
        email: 'ari@buildmate.local',
        profileImage: '',
    };

    // ==========================================
    // 2. 헬퍼 함수
    // ==========================================
    function showHelper(element, message) {
        element.textContent = message;
        element.classList.add('show');
    }

    function hideHelper(element) {
        element.textContent = '';
        element.classList.remove('show');
    }

    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2000);
    }

    // 비밀번호 유효성 검사 (8~20자, 대/소/숫/특 포함)
    function validatePassword(password) {
        if (!password) return { valid: false, message: '*비밀번호를 입력해주세요.' };

        if (password.length < 8 || password.length > 20) {
            return { valid: false, message: '*비밀번호는 8자 이상, 20자 이하이어야 합니다.' };
        }

        if (/\s/.test(password)) {
            return { valid: false, message: '*비밀번호에 공백을 포함할 수 없습니다.' };
        }

        // 대문자, 소문자, 숫자, 특수문자 각각 최소 1개
        const hasUpper = /[A-Z]/.test(password);
        const hasLower = /[a-z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSpecial = /[^A-Za-z0-9]/.test(password);

        if (!(hasUpper && hasLower && hasNumber && hasSpecial)) {
            return { valid: false, message: '*비밀번호는 대문자, 소문자, 숫자, 특수문자를 각각 최소 1개 포함해야 합니다.' };
        }

        return { valid: true };
    }

    function checkFormValidity() {
        const currentPw = currentPasswordInput.value;
        const newPw = newPasswordInput.value;
        const confirmPw = confirmPasswordInput.value;

        // 1. 현재 비밀번호 입력 여부
        if (!currentPw) {
            submitBtn.disabled = true;
            submitBtn.classList.remove('active');
            return;
        }

        // 2. 새 비밀번호 유효성
        if (!validatePassword(newPw).valid) {
            submitBtn.disabled = true;
            submitBtn.classList.remove('active');
            return;
        }

        // 3. 비밀번호 확인 일치 여부
        if (newPw !== confirmPw) {
            submitBtn.disabled = true;
            submitBtn.classList.remove('active');
            return;
        }

        // 모두 통과
        submitBtn.disabled = false;
        submitBtn.classList.add('active');
    }

    // ==========================================
    // 3. API 및 데이터 로드
    // ==========================================
    async function loadUserData() {
        try {
            const response = await fetch(`${API_BASE_URL}/v1/auth/me`, {
                credentials: 'include'
            });

            if (!response.ok) {
                showCustomModal('로그인이 필요합니다.', () => {
                    window.location.href = 'login.html';
                });
                return;
            }

            const result = await response.json();
            currentUser = result.data || result;

            if (currentUser.email && accountEmailInput) {
                accountEmailInput.value = currentUser.email;
            }
            if (currentUser.email && accountEmailDisplay) {
                accountEmailDisplay.textContent = currentUser.email;
            }

            if (currentUser.profileImage) {
                localStorage.setItem('profileImage', currentUser.profileImage);
                profileIcon.style.backgroundImage = `url(${currentUser.profileImage})`;
            }
        } catch (error) {
            console.error('Failed to load user:', error);
        }
    }

    // ==========================================
    // 4. 이벤트 핸들러
    // ==========================================
    // 드롭다운 메뉴
    profileIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        profileDropdown.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
        if (!profileDropdown.contains(e.target) && e.target !== profileIcon) {
            profileDropdown.classList.remove('show');
        }
    });

    logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            await fetch(`${API_BASE_URL}/v1/auth/logout`, {
                method: 'POST',
                credentials: 'include'
            });
            // localStorage 정리 (다른 사용자 로그인 시 이전 데이터 방지)
            localStorage.removeItem('profileImage');
            localStorage.removeItem('nickname');
            localStorage.removeItem('email');
            localStorage.removeItem('userId');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Logout failed:', error);
        }
    });

    // 입력 필드 제어
    currentPasswordInput.addEventListener('input', () => {
        if (!currentPasswordInput.value) {
            showHelper(currentPasswordHelper, '*비밀번호를 입력해주세요');
        } else {
            hideHelper(currentPasswordHelper);
        }
        checkFormValidity();
    });

    newPasswordInput.addEventListener('input', () => {
        const val = validatePassword(newPasswordInput.value);
        if (!val.valid) {
            showHelper(newPasswordHelper, val.message);
        } else {
            hideHelper(newPasswordHelper);
        }
        checkFormValidity();
    });

    confirmPasswordInput.addEventListener('input', () => {
        if (confirmPasswordInput.value !== newPasswordInput.value) {
            showHelper(confirmPasswordHelper, '*비밀번호가 일치하지 않습니다');
        } else {
            hideHelper(confirmPasswordHelper);
        }
        checkFormValidity();
    });

    // 변경사항 저장
    submitBtn.addEventListener('click', async () => {
        if (submitBtn.disabled) return;

        if (isPreviewMode) {
            showToast('저장 완료');
            currentPasswordInput.value = '';
            newPasswordInput.value = '';
            confirmPasswordInput.value = '';
            submitBtn.disabled = true;
            submitBtn.classList.remove('active');
            hideHelper(currentPasswordHelper);
            hideHelper(newPasswordHelper);
            hideHelper(confirmPasswordHelper);
            return;
        }

        const payload = {
            currentPassword: currentPasswordInput.value,
            newPassword: newPasswordInput.value
        };

        try {
            const response = await fetch(`${API_BASE_URL}/v1/users/${currentUser.userId}/password`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.ok) {
                showToast('저장 완료');
                // 입력 필드 초기화
                currentPasswordInput.value = '';
                newPasswordInput.value = '';
                confirmPasswordInput.value = '';
                submitBtn.disabled = true;
                submitBtn.classList.remove('active');
            } else {
                // 에러 처리
                if (data.code === 'INVALID_CURRENT_PASSWORD') {
                    showHelper(currentPasswordHelper, '*현재 비밀번호가 일치하지 않습니다.');
                } else {
                    showCustomModal(data.message || '비밀번호 변경에 실패했습니다.');
                }
            }
        } catch (error) {
            console.error('Password change error:', error);
            showCustomModal('서버 통신 중 오류가 발생했습니다.');
        }
    });

    // ==========================================
    // 5. 초기화
    // ==========================================

    // 로컬 스토리지에서 먼저 로드 (깜박임 방지)
    const cachedProfileImage = localStorage.getItem('profileImage');
    const cachedEmail = localStorage.getItem('email');
    if (cachedProfileImage && profileIcon) {
        profileIcon.style.backgroundImage = `url(${cachedProfileImage})`;
    }
    if (cachedEmail && accountEmailInput) {
        accountEmailInput.value = cachedEmail;
    }
    if (cachedEmail && accountEmailDisplay) {
        accountEmailDisplay.textContent = cachedEmail;
    }

    if (isPreviewMode) {
        currentUser = { ...previewUser };
        if (accountEmailInput) {
            accountEmailInput.value = currentUser.email;
        }
        if (accountEmailDisplay) {
            accountEmailDisplay.textContent = currentUser.email;
        }
        return;
    }

    loadUserData();
});
