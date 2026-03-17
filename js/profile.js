// profile.js - API_BASE_URL, showCustomModal은 common.js에서 제공

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 1. 요소 가져오기
    // ==========================================
    const profileIcon = document.getElementById('profileIcon');
    const profileDropdown = document.getElementById('profileDropdown');
    const logoutBtn = document.getElementById('logoutBtn');

    const emailDisplay = document.getElementById('emailDisplay');
    const nicknameInput = document.getElementById('nickname');
    const nicknameHelper = document.getElementById('nicknameHelper');
    const imageInput = document.getElementById('imageInput');
    const profileImageContainer = document.getElementById('profileImageContainer');
    const profileImg = document.getElementById('profileImg');
    const submitBtn = document.getElementById('submitBtn');
    const completeBtn = document.getElementById('completeBtn');

    const withdrawBtn = document.getElementById('withdrawBtn');
    const withdrawModal = document.getElementById('withdrawModal');
    const modalCancelBtn = document.getElementById('modalCancelBtn');
    const modalConfirmBtn = document.getElementById('modalConfirmBtn');

    const toast = document.getElementById('toast');

    // 상태 변수
    let currentUser = null;
    const PROFILE_IMAGE_MAX_BYTES = 15 * 1024 * 1024;

    // ==========================================
    // 2. 헬퍼 함수
    // ==========================================
    function showHelper(message) {
        nicknameHelper.textContent = message;
        nicknameHelper.classList.add('show');
    }

    function hideHelper() {
        nicknameHelper.textContent = '';
        nicknameHelper.classList.remove('show');
    }

    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2000);
    }

    function validateNickname(nickname) {
        if (!nickname || nickname.trim().length === 0) {
            return { valid: false, message: '*닉네임을 입력해주세요.' };
        }
        if (nickname.length > 10) {
            return { valid: false, message: '*닉네임은 최대 10자 까지 작성 가능합니다.' };
        }
        return { valid: true };
    }

    // ==========================================
    // 3. 드롭다운 메뉴
    // ==========================================
    profileIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        profileDropdown.classList.toggle('show');
    });

    // 외부 클릭 시 드롭다운 닫기
    document.addEventListener('click', (e) => {
        if (!profileDropdown.contains(e.target) && e.target !== profileIcon) {
            profileDropdown.classList.remove('show');
        }
    });

    // 로그아웃
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
            // showCustomModal('로그아웃 되었습니다.', () => {
            //     window.location.href = 'login.html';
            // });
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Logout failed:', error);
        }
    });

    // ==========================================
    // 4. 사용자 데이터 로드
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

            if (currentUser.profileImage) {
                localStorage.setItem('profileImage', currentUser.profileImage);
            }

            // 폼에 데이터 채우기
            emailDisplay.textContent = currentUser.email || '';
            nicknameInput.value = currentUser.nickname || '';

            if (currentUser.profileImage) {
                // 원형 미리보기 이미지 설정
                profileImg.src = currentUser.profileImage;
            } else {
                // 기본 이미지 처리 (필요시)
                profileImg.style.backgroundColor = '#C4C4C4';
            }

            // 프로필 아이콘 이미지 설정
            if (currentUser.profileImage) {
                profileIcon.style.backgroundImage = `url(${currentUser.profileImage})`;
            }

        } catch (error) {
            console.error('Failed to load user:', error);
            showCustomModal('사용자 정보를 불러오는데 실패했습니다.');
        }
    }

    // ==========================================
    // 5. 이벤트 핸들러
    // ==========================================
    nicknameInput.addEventListener('input', () => {
        hideHelper();
    });

    profileImageContainer.addEventListener('click', () => {
        imageInput.click();
    });

    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > PROFILE_IMAGE_MAX_BYTES) {
                imageInput.value = '';
                showHelper('* 프로필 이미지는 15MB 이하 파일만 업로드할 수 있습니다.');
                return;
            }

            // 프리뷰 업데이트
            const reader = new FileReader();
            reader.onload = (e) => {
                profileImg.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    // 수정완료 버튼 - 목록으로 이동
    if (completeBtn) {
        completeBtn.addEventListener('click', () => {
            if (window.history.length > 1) {
                window.history.back();
                return;
            }
            window.location.href = 'index.html';
        });
    }

    // ==========================================
    // 6. 폼 제출 - 프로필 수정
    // ==========================================
    submitBtn.addEventListener('click', async () => {
        const nickname = nicknameInput.value.trim();

        // 닉네임 유효성 검사
        const validation = validateNickname(nickname);
        if (!validation.valid) {
            showHelper(validation.message);
            return;
        }

        // 이미지 업로드 로직
        let profileImage = null; // 변경사항 없으면 null 안 보낼수도 있지만, 여기선 API 명세에 따라 결정. 보통 PATCH는 보낸 필드만 수정됨.
        // 하지만 기존 로직상 닉네임만 보내고 있었음. 프로필 이미지가 선택되었다면 업로드 후 URL 확보.

        let newProfileImageUrl = null;
        if (imageInput.files[0]) {
            try {
                if (imageInput.files[0].size > PROFILE_IMAGE_MAX_BYTES) {
                    showHelper('* 프로필 이미지는 15MB 이하 파일만 업로드할 수 있습니다.');
                    return;
                }
                newProfileImageUrl = await uploadFileViaPresigned(imageInput.files[0], 'profile');
            } catch (error) {
                console.error('Image upload error:', error);
                showHelper(error.message || "이미지 업로드 중 오류가 발생했습니다.");
                return;
            }
        }

        const payload = {
            nickname: nickname
        };
        if (newProfileImageUrl) {
            payload.profileImage = newProfileImageUrl;
        }

        try {


            const response = await fetch(`${API_BASE_URL}/v1/users/${currentUser.userId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.ok) {
                // localStorage 및 UI 업데이트
                if (newProfileImageUrl) {
                    localStorage.setItem('profileImage', newProfileImageUrl);
                    // 헤더 프로필 아이콘도 즉시 업데이트
                    if (profileIcon) {
                        profileIcon.style.backgroundImage = `url(${newProfileImageUrl})`;
                    }
                }
                if (nickname) {
                    localStorage.setItem('nickname', nickname);
                }
                showToast('저장 완료');
            } else if (response.status === 409) {
                showHelper('*중복된 닉네임 입니다.');
            } else {
                showHelper(data.message || '프로필 수정에 실패했습니다.');
            }

        } catch (error) {
            console.error('Profile Update Error:', error);
            showHelper('서버 통신 중 오류가 발생했습니다.');
        }
    });

    // ==========================================
    // 7. 회원 탈퇴 모달
    // ==========================================
    withdrawBtn.addEventListener('click', (e) => {
        e.preventDefault();
        withdrawModal.style.display = 'flex';
    });

    modalCancelBtn.addEventListener('click', () => {
        withdrawModal.style.display = 'none';
    });

    withdrawModal.addEventListener('click', (e) => {
        if (e.target === withdrawModal) {
            withdrawModal.style.display = 'none';
        }
    });

    modalConfirmBtn.addEventListener('click', async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/v1/users/me`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                localStorage.removeItem('profileImage');
                localStorage.removeItem('nickname');
                localStorage.removeItem('email');
                localStorage.removeItem('userId');
                localStorage.removeItem('user');
                showCustomModal('빌드메이트 탈퇴가 완료되었습니다. 계정과 관련 데이터가 영구 삭제되었습니다.', () => {
                    window.location.href = 'login.html';
                });
            } else {
                showCustomModal('회원 탈퇴에 실패했습니다.');
            }
        } catch (error) {
            console.error('Withdrawal Error:', error);
            showCustomModal('회원 탈퇴 중 오류가 발생했습니다.');
        }
    });

    // ==========================================
    // 8. 초기화
    // ==========================================

    // 로컬 스토리지에서 먼저 로드 (깜박임 방지)
    const cachedProfileImage = localStorage.getItem('profileImage');
    if (cachedProfileImage && profileIcon) {
        profileIcon.style.backgroundImage = `url(${cachedProfileImage})`;
    }

    loadUserData();
});
