// signup.js - showCustomModal, API_BASE_URL는 common.js에서 제공

document.addEventListener('DOMContentLoaded', () => {

    // 1. 요소 가져오기
    const signupForm = document.getElementById('signupForm');
    const signupBtn = document.getElementById('signupBtn');

    // 입력 필드
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const passwordConfirmInput = document.getElementById('passwordConfirm');
    const nicknameInput = document.getElementById('nickname');
    const profileImageInput = document.getElementById('profileImageInput');
    const profilePreview = document.getElementById('profilePreview');
    const profileImgElement = profilePreview.querySelector('img');

    // 헬퍼 텍스트 요소
    const emailHelper = document.getElementById('emailHelper');
    const passwordHelper = document.getElementById('passwordHelper');
    const passwordConfirmHelper = document.getElementById('passwordConfirmHelper');
    const nicknameHelper = document.getElementById('nicknameHelper');
    const profileError = document.getElementById('profileError');

    // 유효성 검사 플래그
    let isEmailValid = false;
    let isEmailAvailabilityChecked = false;
    let isPasswordValid = false;
    let isPasswordConfirmValid = false;
    let isNicknameValid = false;
    let isNicknameAvailabilityChecked = false;
    const PROFILE_IMAGE_MAX_BYTES = 15 * 1024 * 1024;
    const DUPLICATE_CHECK_FAILURE_MESSAGE = '* 중복 확인에 실패했습니다. 네트워크 확인 후 새로고침 해주세요.';


    // 헬퍼 함수
    function showHelper(element, message) {
        element.textContent = message;
        element.classList.add('show');
    }

    function hideHelper(element) {
        element.textContent = '';
        element.classList.remove('show');
    }

    function checkFormValidity() {
        if (
            isEmailValid &&
            isEmailAvailabilityChecked &&
            isPasswordValid &&
            isPasswordConfirmValid &&
            isNicknameValid &&
            isNicknameAvailabilityChecked
        ) {
            signupBtn.disabled = false;
            signupBtn.classList.add('active');
        } else {
            signupBtn.disabled = true;
            signupBtn.classList.remove('active');
        }
    }

    async function parseApiResponse(response) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            return await response.json();
        }
        const text = await response.text();
        return { message: text || `요청 처리에 실패했습니다. (HTTP ${response.status})` };
    }

    function saveAuthState(userData, token = null) {
        if (!userData) return;

        localStorage.setItem('user', JSON.stringify(userData));
        if (userData.userId) localStorage.setItem('userId', userData.userId);
        if (userData.nickname) localStorage.setItem('nickname', userData.nickname);
        if (userData.email) localStorage.setItem('email', userData.email);
        if (userData.profileImage) {
            localStorage.setItem('profileImage', userData.profileImage);
        } else {
            localStorage.removeItem('profileImage');
        }

        if (token) {
            localStorage.setItem('token', token);
            localStorage.setItem('accessToken', token);
        }
    }

    async function loginAfterSignup(email, password) {
        const response = await fetch(`${API_BASE_URL}/v1/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });

        const data = await parseApiResponse(response);
        if (!response.ok) {
            throw new Error(data.message || '자동 로그인에 실패했습니다.');
        }

        return data;
    }

    async function fetchMe() {
        const response = await fetch(`${API_BASE_URL}/v1/auth/me`, {
            credentials: 'include'
        });

        const data = await parseApiResponse(response);
        if (!response.ok || !data?.data?.userId) {
            throw new Error(data.message || '사용자 정보 조회에 실패했습니다.');
        }

        return data.data;
    }

    async function uploadProfileImage(file) {
        if (file.size > PROFILE_IMAGE_MAX_BYTES) {
            throw new Error('프로필 이미지는 15MB 이하 파일만 업로드할 수 있습니다.');
        }
        return await uploadFileViaPresigned(file, 'profile');
    }

    async function updateProfileImage(userId, fileUrl) {
        const response = await fetch(`${API_BASE_URL}/v1/users/${userId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ profileImage: fileUrl })
        });

        const data = await parseApiResponse(response);
        if (!response.ok) {
            throw new Error(data.message || '프로필 이미지 저장에 실패했습니다.');
        }
    }

    // --- 유효성 검사 로직 ---

    // 1. 프로필 이미지
    profilePreview.addEventListener('click', () => {
        profileImageInput.click();
    });

    profileImageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > PROFILE_IMAGE_MAX_BYTES) {
                profileImageInput.value = '';
                profileImgElement.src = '';
                profilePreview.classList.remove('has-image');
                showHelper(profileError, '* 프로필 이미지는 15MB 이하 파일만 선택할 수 있습니다.');
                checkFormValidity();
                return;
            }

            const reader = new FileReader();
            reader.onload = (evt) => {
                profileImgElement.src = evt.target.result;
                profilePreview.classList.add('has-image');
                hideHelper(profileError);
                checkFormValidity();
            };
            reader.readAsDataURL(file);
        } else {
            profileImgElement.src = '';
            profilePreview.classList.remove('has-image');
            showHelper(profileError, '* 프로필 사진은 선택사항입니다. 선택하면 가입 직후 자동 반영됩니다.');
            checkFormValidity();
        }
    });


    // 2. 이메일
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    emailInput.addEventListener('focusout', async () => {
        const value = emailInput.value.trim();
        if (value === '') {
            showHelper(emailHelper, '* 이메일을 입력해주세요.');
            isEmailValid = false;
            isEmailAvailabilityChecked = false;
        } else if (!emailPattern.test(value)) {
            showHelper(emailHelper, '* 올바른 이메일 주소 형식을 입력해주세요. (예: example@example.com)');
            isEmailValid = false;
            isEmailAvailabilityChecked = false;
        } else {
            const checkedValue = value;
            try {
                const response = await fetch(`${API_BASE_URL}/v1/auth/emails/availability?email=${encodeURIComponent(value)}`);
                const data = await parseApiResponse(response);

                if (emailInput.value.trim() !== checkedValue) {
                    return;
                }

                if (response.ok) {
                    hideHelper(emailHelper);
                    isEmailValid = true;
                    isEmailAvailabilityChecked = true;
                } else if (response.status === 409) {
                    showHelper(emailHelper, '* 이미 사용 중인 이메일입니다.');
                    isEmailValid = false;
                    isEmailAvailabilityChecked = false;
                } else if (response.status >= 500) {
                    showHelper(emailHelper, DUPLICATE_CHECK_FAILURE_MESSAGE);
                    isEmailValid = false;
                    isEmailAvailabilityChecked = false;
                } else {
                    showHelper(emailHelper, data.message || '* 이메일 확인 중 오류가 발생했습니다.');
                    isEmailValid = false;
                    isEmailAvailabilityChecked = false;
                }
            } catch (error) {
                console.error('Email check error:', error);
                if (emailInput.value.trim() === checkedValue) {
                    showHelper(emailHelper, DUPLICATE_CHECK_FAILURE_MESSAGE);
                    isEmailValid = false;
                    isEmailAvailabilityChecked = false;
                }
            }
        }
        checkFormValidity();
    });

    emailInput.addEventListener('input', () => {
        const value = emailInput.value.trim();
        isEmailAvailabilityChecked = false;
        if (emailPattern.test(value)) {
            isEmailValid = true;
            hideHelper(emailHelper);
        } else {
            isEmailValid = false;
        }
        checkFormValidity();
    });


    // 3. 비밀번호
    const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])\S{8,20}$/;

    passwordInput.addEventListener('focusout', () => {
        const value = passwordInput.value;
        if (value === '') {
            showHelper(passwordHelper, '* 비밀번호를 입력해주세요.');
            isPasswordValid = false;
        } else if (!passwordPattern.test(value)) {
            showHelper(passwordHelper, '* 비밀번호는 8자 이상, 20자 이하이며, 대문자, 소문자, 숫자, 특수문자를 각각 최소 1개 포함해야 합니다.');
            isPasswordValid = false;
        } else {
            hideHelper(passwordHelper);
            isPasswordValid = true;
        }
        checkFormValidity();

        if (passwordConfirmInput.value !== '') {
            triggerPasswordConfirmCheck();
        }
    });

    passwordInput.addEventListener('input', () => {
        const value = passwordInput.value;
        if (passwordPattern.test(value)) {
            isPasswordValid = true;
            hideHelper(passwordHelper);
        } else {
            isPasswordValid = false;
        }
        checkFormValidity();
    });


    // 4. 비밀번호 확인
    function triggerPasswordConfirmCheck() {
        const pwd = passwordInput.value;
        const confirm = passwordConfirmInput.value;

        if (confirm === '') {
            showHelper(passwordConfirmHelper, '* 비밀번호를 한번 더 입력해주세요.');
            isPasswordConfirmValid = false;
        } else if (pwd !== confirm) {
            showHelper(passwordConfirmHelper, '* 비밀번호가 다릅니다.');
            isPasswordConfirmValid = false;
        } else {
            hideHelper(passwordConfirmHelper);
            isPasswordConfirmValid = true;
        }
        checkFormValidity();
    }

    passwordConfirmInput.addEventListener('focusout', triggerPasswordConfirmCheck);

    passwordConfirmInput.addEventListener('input', () => {
        const pwd = passwordInput.value;
        const confirm = passwordConfirmInput.value;
        if (pwd === confirm && confirm !== '') {
            isPasswordConfirmValid = true;
            hideHelper(passwordConfirmHelper);
        } else {
            isPasswordConfirmValid = false;
        }
        checkFormValidity();
    });


    // 5. 닉네임
    const nicknamePattern = /^[a-zA-Z0-9가-힣]{1,10}$/;

    nicknameInput.addEventListener('focusout', async () => {
        const value = nicknameInput.value;
        if (value === '') {
            showHelper(nicknameHelper, '* 닉네임을 입력해주세요.');
            isNicknameValid = false;
            isNicknameAvailabilityChecked = false;
        } else if (/\s/.test(value)) {
            showHelper(nicknameHelper, '* 띄어쓰기를 없애주세요.');
            isNicknameValid = false;
            isNicknameAvailabilityChecked = false;
        } else if (value.length > 10) {
            showHelper(nicknameHelper, '* 닉네임은 최대 10자까지 작성 가능합니다.');
            isNicknameValid = false;
            isNicknameAvailabilityChecked = false;
        } else if (!nicknamePattern.test(value)) {
            showHelper(nicknameHelper, '* 닉네임 형식이 올바르지 않습니다. (공백/특수문자 불가)');
            isNicknameValid = false;
            isNicknameAvailabilityChecked = false;
        } else {
            const checkedValue = value;
            try {
                const response = await fetch(`${API_BASE_URL}/v1/auth/nicknames/availability?nickname=${encodeURIComponent(value)}`);
                const data = await parseApiResponse(response);

                if (nicknameInput.value !== checkedValue) {
                    return;
                }

                if (response.ok) {
                    hideHelper(nicknameHelper);
                    isNicknameValid = true;
                    isNicknameAvailabilityChecked = true;
                } else if (response.status === 409) {
                    showHelper(nicknameHelper, '* 이미 사용 중인 닉네임입니다.');
                    isNicknameValid = false;
                    isNicknameAvailabilityChecked = false;
                } else if (response.status >= 500) {
                    showHelper(nicknameHelper, DUPLICATE_CHECK_FAILURE_MESSAGE);
                    isNicknameValid = false;
                    isNicknameAvailabilityChecked = false;
                } else {
                    showHelper(nicknameHelper, data.message || '* 닉네임 확인 중 오류가 발생했습니다.');
                    isNicknameValid = false;
                    isNicknameAvailabilityChecked = false;
                }
            } catch (error) {
                console.error('Nickname check error:', error);
                if (nicknameInput.value === checkedValue) {
                    showHelper(nicknameHelper, DUPLICATE_CHECK_FAILURE_MESSAGE);
                    isNicknameValid = false;
                    isNicknameAvailabilityChecked = false;
                }
            }
        }
        checkFormValidity();
    });

    nicknameInput.addEventListener('input', () => {
        const value = nicknameInput.value;
        isNicknameAvailabilityChecked = false;
        if (value.length > 10) {
            showHelper(nicknameHelper, '* 닉네임은 최대 10자까지 작성 가능합니다.');
            isNicknameValid = false;
        } else if (nicknamePattern.test(value)) {
            hideHelper(nicknameHelper);
            isNicknameValid = true;
        } else {
            isNicknameValid = false;
        }
        checkFormValidity();
    });


    // 6. 회원가입 제출
    signupBtn.addEventListener('click', async () => {
        if (signupBtn.disabled) return;
        if (
            !isEmailValid ||
            !isEmailAvailabilityChecked ||
            !isPasswordValid ||
            !isPasswordConfirmValid ||
            !isNicknameValid ||
            !isNicknameAvailabilityChecked
        ) {
            showCustomModal('중복 확인이 완료되지 않았습니다. 이메일/닉네임 입력 후 중복 확인을 다시 진행해주세요.');
            checkFormValidity();
            return;
        }

        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const nickname = nicknameInput.value.trim();
        const selectedProfileFile = profileImageInput.files[0] || null;

        const payload = {
            email,
            password,
            nickname,
            profileImage: null
        };

        try {
            signupBtn.disabled = true;
            signupBtn.classList.remove('active');

            const response = await fetch(`${API_BASE_URL}/v1/auth/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await parseApiResponse(response);

            if (response.status !== 201) {
                showCustomModal(data.message || '회원가입에 실패했습니다.');
                signupBtn.disabled = false;
                signupBtn.classList.add('active');
                return;
            }

            if (!selectedProfileFile) {
                localStorage.removeItem('profileImage');
                showCustomModal('회원가입이 완료되었습니다.\n로그인 화면으로 이동합니다.', () => {
                    window.location.href = 'login.html';
                });
                return;
            }

            try {
                const loginResult = await loginAfterSignup(email, password);
                const me = await fetchMe();
                const fileUrl = await uploadProfileImage(selectedProfileFile);
                await updateProfileImage(me.userId, fileUrl);

                const loginUserData = (loginResult.data && loginResult.data.user)
                    ? loginResult.data.user
                    : (loginResult.data || {});

                const mergedUser = {
                    ...loginUserData,
                    userId: me.userId,
                    email,
                    nickname,
                    profileImage: fileUrl
                };

                const token = (loginResult.data && loginResult.data.token)
                    ? loginResult.data.token
                    : null;
                saveAuthState(mergedUser, token);

                showCustomModal('회원가입이 완료되었습니다.\n프로필 이미지가 즉시 적용되었습니다.', () => {
                    window.location.href = 'index.html';
                });
            } catch (autoApplyError) {
                console.error('Signup image auto-apply error:', autoApplyError);
                showCustomModal('회원가입은 완료되었지만 프로필 이미지 자동 반영에 실패했습니다.\n로그인 후 프로필 수정에서 다시 시도해주세요.', () => {
                    window.location.href = 'login.html';
                });
            }

        } catch (error) {
            console.error('Signup error:', error);
            showCustomModal('서버 통신 중 오류가 발생했습니다.');
            signupBtn.disabled = false;
            signupBtn.classList.add('active');
        }
    });

    // 초기화
    showHelper(profileError, '* 프로필 사진은 선택사항입니다. 선택하면 가입 직후 자동 반영됩니다.');
    checkFormValidity();
});
