// post_edit.js - API_BASE_URL, showCustomModal은 common.js에서 제공

document.addEventListener('DOMContentLoaded', () => {

    // URL에서 게시글 ID 추출
    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('id');

    if (!postId) {
        showCustomModal('잘못된 접근입니다.', () => {
            window.location.href = 'index.html';
        });
        return;
    }

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
    const postEditForm = document.getElementById('postEditForm');
    const titleInput = document.getElementById('title');
    const contentInput = document.getElementById('content');
    const helperText = document.getElementById('helperText');
    const imageInput = document.getElementById('imageInput');
    const fileSelectBtn = document.getElementById('fileSelectBtn');
    const fileNameSpan = document.getElementById('fileName');
    const submitBtn = document.getElementById('submitBtn');
    const POST_IMAGE_MAX_BYTES = 20 * 1024 * 1024;

    // 상태 변수
    let originalPost = null;
    let currentFileUrl = null;

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
    // showCustomModal은 common.js에서 제공
    // ==========================================
    // 3. 기존 게시글 데이터 로드
    // ==========================================
    async function loadPostData() {
        try {
            const response = await fetch(`${API_BASE_URL}/v1/posts/${postId}?increase_view=false`, {
                credentials: 'include'
            });

            if (!response.ok) {
                showCustomModal('게시글을 찾을 수 없습니다.', () => {
                    window.location.href = 'index.html';
                });
                return;
            }

            const result = await response.json();
            originalPost = result.data || result;

            // 폼에 기존 데이터 채우기
            titleInput.value = originalPost.title || '';
            contentInput.value = originalPost.content || '';

            // 기존 이미지 파일명 표시
            if (originalPost.fileUrl) {
                currentFileUrl = originalPost.fileUrl;
                const fileName = originalPost.fileUrl.split('/').pop();
                fileNameSpan.textContent = fileName || '기존 파일';
                fileNameSpan.classList.add('selected');
            } else {
                fileNameSpan.textContent = '파일을 선택해주세요.';
            }

            checkFormValidity();

        } catch (error) {
            console.error('Failed to load post:', error);
            showCustomModal('게시글을 불러오는데 실패했습니다.');
        }
    }

    // ==========================================
    // 4. 이벤트 핸들러
    // ==========================================
    titleInput.addEventListener('input', () => {
        hideHelper();
        checkFormValidity();
    });

    contentInput.addEventListener('input', () => {
        hideHelper();
        checkFormValidity();
    });

    fileSelectBtn.addEventListener('click', () => {
        imageInput.click();
    });

    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > POST_IMAGE_MAX_BYTES) {
                imageInput.value = '';
                showHelper('* 게시글 이미지는 20MB 이하 파일만 업로드할 수 있습니다.');
                return;
            }
            fileNameSpan.textContent = file.name;
            fileNameSpan.classList.add('selected');
            currentFileUrl = null; // 새 파일 선택 시 기존 URL 초기화
        }
    });

    // ==========================================
    // 5. 제출 핸들러 - PATCH API
    // ==========================================
    submitBtn.addEventListener('click', async () => {
        if (submitBtn.disabled) return;

        const title = titleInput.value.trim();
        const content = contentInput.value.trim();

        if (!title || !content) {
            showHelper('* 제목, 내용을 모두 작성해주세요');
            return;
        }

        // 이미지 업로드 로직 (수정 시)
        let fileUrl = currentFileUrl; // 기본값: 기존 URL 유지

        if (imageInput.files[0]) {
            try {
                if (imageInput.files[0].size > POST_IMAGE_MAX_BYTES) {
                    showHelper('* 게시글 이미지는 20MB 이하 파일만 업로드할 수 있습니다.');
                    return;
                }
                fileUrl = await uploadFileViaPresigned(imageInput.files[0], 'post');
            } catch (error) {
                console.error('Image upload error:', error);
                showHelper(error.message || "이미지 업로드 중 오류가 발생했습니다.");
                return;
            }
        }

        const payload = {
            title: title,
            content: content,
            fileUrl: fileUrl
        };

        try {


            const response = await fetch(`${API_BASE_URL}/v1/posts/${postId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.ok) {
                showCustomModal('모집글이 수정되었습니다.', () => {
                    window.location.href = `post_detail.html?id=${postId}`;
                });
            } else if (response.status === 401) {
                showCustomModal('로그인이 필요합니다.', () => {
                    window.location.href = 'login.html';
                });
            } else if (response.status === 403) {
                showCustomModal('수정 권한이 없습니다.', () => {
                    window.location.href = `post_detail.html?id=${postId}`;
                });
            } else {
                showHelper(data.message || '모집글 수정에 실패했습니다.');
            }

        } catch (error) {
            console.error('Post Edit Error:', error);
            showHelper('서버 통신 중 오류가 발생했습니다.');
        }
    });

    // ==========================================
    // 6. 초기화
    // ==========================================
    loadPostData();
});
