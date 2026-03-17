// post_write.js - showCustomModal, API_BASE_URL는 common.js에서 제공

document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 0. 헤더 프로필 설정
    // ==========================================
    const profileIcon = document.getElementById('profileIcon');
    const profileDropdown = document.getElementById('profileDropdown');
    const logoutBtn = document.getElementById('logoutBtn');

    async function fetchUserProfile() {
        try {
            const response = await fetch(`${API_BASE_URL}/v1/auth/me`, {
                credentials: 'include'
            });
            if (response.ok) {
                const result = await response.json();
                const user = result.data || result;
                if (user.profileImage) {
                    localStorage.setItem('profileImage', user.profileImage);
                    if (profileIcon) profileIcon.style.backgroundImage = `url(${user.profileImage})`;
                } else if (profileIcon) {
                    profileIcon.style.backgroundColor = '#7F6AEE';
                }
            }
        } catch (error) {
            console.error('Failed to load user profile:', error);
        }
    }

    // 초기 로드 시 캐시된 이미지 먼저 보여주기
    const cachedProfileImage = localStorage.getItem('profileImage');
    if (cachedProfileImage && profileIcon) {
        profileIcon.style.backgroundImage = `url(${cachedProfileImage})`;
    }

    // 드롭다운 이벤트
    if (profileIcon) {
        profileIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            profileDropdown.classList.toggle('show');
        });
        document.addEventListener('click', (e) => {
            if (!profileDropdown.contains(e.target) && e.target !== profileIcon) {
                profileDropdown.classList.remove('show');
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await fetch(`${API_BASE_URL}/v1/auth/logout`, { method: 'POST', credentials: 'include' });
                // localStorage 정리 (다른 사용자 로그인 시 이전 데이터 방지)
                localStorage.removeItem('profileImage');
                localStorage.removeItem('nickname');
                localStorage.removeItem('email');
                localStorage.removeItem('userId');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
            } catch (e) { console.error(e); }
        });
    }

    fetchUserProfile();

    // ==========================================
    // 1. 요소 가져오기
    // ==========================================
    const postWriteForm = document.getElementById('postWriteForm');
    const titleInput = document.getElementById('title');
    const contentInput = document.getElementById('content');
    const helperText = document.getElementById('helperText');
    const imageInput = document.getElementById('imageInput');
    const fileSelectBtn = document.getElementById('fileSelectBtn');
    const fileNameSpan = document.getElementById('fileName');
    const submitBtn = document.getElementById('submitBtn');
    const POST_IMAGE_MAX_BYTES = 20 * 1024 * 1024;


    // ==========================================
    // 2. 헬퍼 함수
    // ==========================================
    function showHelper(message) {
        helperText.textContent = message;
        helperText.classList.add('show');
    }

    function hideHelper() {
        helperText.textContent = '';
        helperText.classList.remove('show');
    }

    function checkFormValidity() {
        const titleValue = titleInput.value.trim();
        const contentValue = contentInput.value.trim();

        if (titleValue.length > 0 && contentValue.length > 0) {
            submitBtn.disabled = false;
            submitBtn.classList.add('active');
        } else {
            submitBtn.disabled = true;
            submitBtn.classList.remove('active');
        }
    }

    // ==========================================
    // 3. 이벤트 핸들러 (이벤트 처리)
    // ==========================================

    // 제목 입력 - 26자 제한은 HTML maxlength로 처리됨
    titleInput.addEventListener('input', () => {
        hideHelper();
        checkFormValidity();
    });

    // 내용 입력
    contentInput.addEventListener('input', () => {
        hideHelper();
        checkFormValidity();
    });

    // 이미지 파일 선택 버튼 클릭
    fileSelectBtn.addEventListener('click', () => {
        imageInput.click();
    });

    // 이미지 파일 선택 완료
    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > POST_IMAGE_MAX_BYTES) {
                imageInput.value = '';
                fileNameSpan.textContent = '파일을 선택해주세요.';
                fileNameSpan.classList.remove('selected');
                showHelper('* 게시글 이미지는 20MB 이하 파일만 업로드할 수 있습니다.');
                return;
            }
            fileNameSpan.textContent = file.name;
            fileNameSpan.classList.add('selected');
        } else {
            fileNameSpan.textContent = '파일을 선택해주세요.';
            fileNameSpan.classList.remove('selected');
        }
    });

    // ==========================================
    // 4. 제출 핸들러 (Fetch API)
    // ==========================================
    submitBtn.addEventListener('click', async () => {
        if (submitBtn.disabled) return;

        const title = titleInput.value.trim();
        const content = contentInput.value.trim();

        // 유효성 검사 (이미 버튼 활성화로 체크되지만, 한번 더 확인)
        if (!title || !content) {
            showHelper('* 제목, 내용을 모두 작성해주세요');
            return;
        }

        // 1. 이미지 업로드 (만약 선택된 파일이 있다면)
        let postImage = null;
        if (imageInput.files[0]) {
            try {
                if (imageInput.files[0].size > POST_IMAGE_MAX_BYTES) {
                    showHelper('* 게시글 이미지는 20MB 이하 파일만 업로드할 수 있습니다.');
                    return;
                }

                postImage = await uploadFileViaPresigned(imageInput.files[0], 'post');
            } catch (error) {
                console.error('Image upload error:', error);
                showHelper(error.message || "이미지 업로드 중 오류가 발생했습니다.");
                return;
            }
        }

        const payload = {
            title: title,
            content: content,
            fileUrl: postImage
        };

        try {


            const response = await fetch(`${API_BASE_URL}/v1/posts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include', // 세션 쿠키 포함
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.status === 201) {
                showCustomModal('프로젝트 모집글이 등록되었습니다.', () => {
                    window.location.href = 'index.html';
                });
            } else if (response.status === 401) {
                showCustomModal('로그인이 필요합니다.', () => {
                    window.location.href = 'login.html';
                });
            } else {
                showHelper(data.message || '모집글 등록에 실패했습니다.');
            }

        } catch (error) {
            console.error('Post Create Error:', error);
            showHelper('서버 통신 중 오류가 발생했습니다.');
        }
    });

    // 초기화
    checkFormValidity();
});
