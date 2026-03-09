// post_detail.js - API_BASE_URL, formatDate는 common.js에서 제공

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
    // 1. DOM 요소
    // ==========================================
    // 게시글 요소
    const postTitle = document.getElementById('postTitle');
    const authorAvatar = document.getElementById('authorAvatar');
    const authorName = document.getElementById('authorName');
    const postDate = document.getElementById('postDate');
    const postActions = document.getElementById('postActions');
    const authorInfo = document.querySelector('.author-info');
    const postMetaRow = document.querySelector('.post-meta-row');
    const editPostBtn = document.getElementById('editPostBtn');
    const deletePostBtn = document.getElementById('deletePostBtn');
    const postImageContainer = document.getElementById('postImageContainer');
    const postImage = document.getElementById('postImage');
    const postContent = document.getElementById('postContent');
    const likeBtn = document.getElementById('likeBtn');
    const likeCount = document.getElementById('likeCount');
    const viewCount = document.getElementById('viewCount');
    const commentCountEl = document.getElementById('commentCount');

    // 댓글 요소
    const commentInput = document.getElementById('commentInput');
    const commentSubmitBtn = document.getElementById('commentSubmitBtn');
    const commentList = document.getElementById('commentList');

    // 모달 요소
    const deleteModal = document.getElementById('deleteModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalCancelBtn = document.getElementById('modalCancelBtn');
    const modalConfirmBtn = document.getElementById('modalConfirmBtn');

    // 프로필 드롭다운 요소
    const profileIcon = document.getElementById('profileIcon');
    const profileDropdown = document.getElementById('profileDropdown');
    const logoutBtn = document.getElementById('logoutBtn');

    // 상태 변수
    let currentPost = null;
    let currentUser = null;
    let isLiked = false;
    let editingCommentId = null;
    let authorCardEl = null;

    // 로컬스토리지에서 사용자 정보 로드 (동기 처리 - 딜레이 방지)
    function loadUserFromStorage() {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            currentUser = JSON.parse(userStr);
        }
        // 개별 ID가 존재하는 경우도 확인 (안정성)
        if (!currentUser && localStorage.getItem('userId')) {
            currentUser = {
                userId: localStorage.getItem('userId'),
                nickname: localStorage.getItem('nickname'),
                email: localStorage.getItem('email'),
                profileImage: localStorage.getItem('profileImage')
            };
        }

        // 헤더 프로필 즉시 적용
        const cachedProfileImage = localStorage.getItem('profileImage') || (currentUser && currentUser.profileImage);
        if (cachedProfileImage && profileIcon) {
            profileIcon.style.backgroundImage = `url(${cachedProfileImage})`;
        }
    }

    // ==========================================
    // 유틸리티 함수
    // ==========================================
    function formatCount(num) {
        if (num >= 100000) return Math.floor(num / 1000) + 'k';
        if (num >= 10000) return Math.floor(num / 1000) + 'k';
        if (num >= 1000) return Math.floor(num / 1000) + 'k';
        return num.toString();
    }

    // formatDate는 common.js에서 제공

    function showModal(title, onConfirm) {
        modalTitle.textContent = title;
        deleteModal.style.display = 'flex';

        const handleConfirm = () => {
            deleteModal.style.display = 'none';
            modalConfirmBtn.removeEventListener('click', handleConfirm);
            onConfirm();
        };

        modalConfirmBtn.addEventListener('click', handleConfirm);
    }

    function hideModal() {
        deleteModal.style.display = 'none';
    }
    function closeAuthorCard() {
        if (authorCardEl) {
            authorCardEl.classList.remove('show');
        }
    }

    function mountAuthorCard() {
        if (!currentPost || !postMetaRow) return;
        if (authorCardEl) {
            authorCardEl.remove();
        }

        authorCardEl = window.buildAuthorProfileCard({
            userId: currentPost.authorId || currentPost.userId,
            nickname: currentPost.writer,
            profileImage: currentPost.authorProfileImage
        });
        postMetaRow.insertAdjacentElement('afterend', authorCardEl);

        if (authorInfo) {
            authorInfo.classList.add('author-card-trigger');
            authorInfo.onclick = (event) => {
                event.preventDefault();
                event.stopPropagation();
                const willShow = !authorCardEl.classList.contains('show');
                closeAuthorCard();
                authorCardEl.classList.toggle('show', willShow);
            };
        }
    }


    // ==========================================
    // API 함수
    // ==========================================

    // 현재 사용자 정보 조회 (비동기) - 변경사항 있으면 업데이트
    async function fetchCurrentUser() {
        try {
            const response = await fetch(`${API_BASE_URL}/v1/auth/me`, {
                credentials: 'include'
            });
            if (response.ok) {
                const result = await response.json();
                const remoteUser = result.data || result;
                if (remoteUser) {
                    currentUser = remoteUser;
                    // 스토리지 업데이트
                    localStorage.setItem('user', JSON.stringify(currentUser));
                    if (currentUser.userId) localStorage.setItem('userId', currentUser.userId);
                    if (currentUser.profileImage) localStorage.setItem('profileImage', currentUser.profileImage);

                    // 헤더 프로필 아이콘 업데이트
                    if (profileIcon && currentUser.profileImage) {
                        profileIcon.style.backgroundImage = `url(${currentUser.profileImage})`;
                    } else if (profileIcon) {
                        profileIcon.style.backgroundColor = '#7F6AEE';
                    }
                }
            }
        } catch (error) {
            console.error('Failed to fetch user:', error);
        }
    }

    async function fetchPostDetail() {
        try {
            const response = await fetch(`${API_BASE_URL}/v1/posts/${postId}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                showCustomModal('게시글을 찾을 수 없습니다.', () => {
                    window.location.href = 'index.html';
                });
                return;
            }

            const result = await response.json();
            currentPost = result.data || result;
            renderPost();
        } catch (error) {
            console.error('Failed to fetch post:', error);
            showCustomModal('게시글을 불러오는데 실패했습니다.');
        }
    }

    async function fetchComments() {
        try {
            const response = await fetch(`${API_BASE_URL}/v1/posts/${postId}/comments`, {
                credentials: 'include'
            });

            if (response.ok) {
                const result = await response.json();
                const data = result.data || result;
                const comments = Array.isArray(data) ? data : (data.comments || []);
                renderComments(comments);
            }
        } catch (error) {
            console.error('Failed to fetch comments:', error);
        }
    }

    // 현재 사용자가 이미 좋아요한 게시글인지 확인
    // 참고: 백엔드가 GET /likes를 지원하지 않음 (405 반환)
    // toggleLike에서 409 Conflict 처리로 대체
    async function fetchLikeStatus() {
        // 백엔드가 아직 이 엔드포인트를 지원하지 않음 - 405 오류 방지를 위해 비활성화
        // 백엔드에서 GET /likes 지원 또는 게시글 상세에 isLiked 포함 시 재활성화 가능
        return;
    }

    async function toggleLike() {
        if (!currentUser) {
            showCustomModal('로그인이 필요합니다.', () => {
                window.location.href = 'login.html';
            });
            return;
        }



        try {
            // 현재 상태에 따라 메서드 결정
            const method = isLiked ? 'DELETE' : 'POST';

            const response = await fetch(`${API_BASE_URL}/v1/posts/${postId}/likes`, {
                method: method,
                credentials: 'include'
            });



            // 409 Conflict (ALREADY_LIKED) 처리 - 상태만 교정하고 재시도 안함
            if (response.status === 409) {

                isLiked = true;
                likeBtn.classList.add('liked');
                // 카운트 변경 안함 - 백엔드에 이미 좋아요 카운트됨
                return;
            }

            if (response.ok || response.status === 200 || response.status === 201 || response.status === 204) {
                // 상태 토글
                isLiked = (method === 'POST');
                likeBtn.classList.toggle('liked', isLiked);



                // 로컬 카운트 업데이트
                let count = parseInt(likeCount.textContent.replace(/[^0-9]/g, '')) || 0;
                if (method === 'POST') count++;
                else count--;
                likeCount.textContent = formatCount(Math.max(0, count));

            } else {
                const errorText = await response.text();
                console.error('[좋아요] 실패:', response.status, errorText);
            }
        } catch (error) {
            console.error('[좋아요] 에러:', error);
        }
    }

    async function deletePost() {
        try {
            const response = await fetch(`${API_BASE_URL}/v1/posts/${postId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                showCustomModal('게시글이 삭제되었습니다.', () => {
                    window.location.href = 'index.html';
                });
            } else {
                showCustomModal('삭제에 실패했습니다.');
            }
        } catch (error) {
            console.error('Failed to delete post:', error);
        }
    }

    async function submitComment() {
        const content = commentInput.value.trim();
        if (!content) return;

        if (!currentUser) {
            showCustomModal('로그인이 필요합니다.', () => {
                window.location.href = 'login.html';
            });
            return;
        }

        try {
            let response;
            if (editingCommentId) {
                response = await fetch(`${API_BASE_URL}/v1/posts/${postId}/comments/${editingCommentId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ content })
                });
            } else {
                response = await fetch(`${API_BASE_URL}/v1/posts/${postId}/comments`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ content })
                });
            }

            if (response.ok) {
                const isEditMode = Boolean(editingCommentId);
                commentInput.value = '';
                commentSubmitBtn.textContent = '댓글 등록';
                commentSubmitBtn.disabled = true;
                commentSubmitBtn.classList.remove('active');
                editingCommentId = null;
                fetchComments();

                // 댓글 수 업데이트
                let count = parseInt(commentCountEl.textContent.replace(/[^0-9]/g, '')) || 0;
                if (!isEditMode) { // 새 댓글인 경우
                    commentCountEl.textContent = formatCount(count + 1);
                }
            } else {
                showCustomModal('댓글 등록에 실패했습니다.');
            }
        } catch (error) {
            console.error('Error submitting comment:', error);
        }
    }

    async function deleteComment(commentId) {
        try {
            const response = await fetch(`${API_BASE_URL}/v1/posts/${postId}/comments/${commentId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                fetchComments();
                let count = parseInt(commentCountEl.textContent.replace(/[^0-9]/g, '')) || 0;
                commentCountEl.textContent = formatCount(Math.max(0, count - 1));
            } else {
                showCustomModal('댓글 삭제에 실패했습니다.');
            }
        } catch (error) {
            console.error('Failed to delete comment:', error);
        }
    }

    // ==========================================
    // 4. 렌더링 함수
    // ==========================================
    function renderPost() {
        if (!currentPost) return;

        postTitle.textContent = currentPost.title || '';
        postContent.textContent = currentPost.content || '';
        authorName.textContent = currentPost.writer || '익명';
        postDate.textContent = currentPost.createdAt ? formatDate(currentPost.createdAt) : '';

        // 작성자 프로필 이미지
        if (currentPost.authorProfileImage) {
            authorAvatar.style.backgroundImage = `url(${currentPost.authorProfileImage})`;
        } else {
            authorAvatar.style.backgroundColor = '#D9D9D9';
        }

        mountAuthorCard();

        // 이미지
        if (currentPost.fileUrl) {
            postImage.src = currentPost.fileUrl;
            postImageContainer.style.display = 'block';
        } else {
            postImageContainer.style.display = 'none';
        }

        // 통계
        likeCount.textContent = formatCount(currentPost.likeCount || 0);
        viewCount.textContent = formatCount(currentPost.viewCount || 0);
        commentCountEl.textContent = formatCount(currentPost.commentCount || 0);



        // 소유권 확인 (userId 비교)
        const currentUserId = currentUser ? String(currentUser.userId) : null;
        // 게시글 작성자 ID를 다양한 필드에서 확인
        let postAuthorId = null;
        if (currentPost.author && currentPost.author.userId) {
            postAuthorId = String(currentPost.author.userId);
        } else if (currentPost.authorId) {
            postAuthorId = String(currentPost.authorId);
        } else if (currentPost.userId) {
            postAuthorId = String(currentPost.userId);
        }



        if (currentUserId && postAuthorId && currentUserId === postAuthorId) {
            postActions.style.display = 'flex';
        } else {
            postActions.style.display = 'none';
        }

        // 좋아요 상태 - 다양한 필드 확인
        if (currentPost.isLiked === true || currentPost.liked === true) {
            isLiked = true;
            likeBtn.classList.add('liked');

        } else if (currentPost.likes && Array.isArray(currentPost.likes) && currentUser) {
            // likes 배열이 있고 사용자 정보가 있다면 확인
            const userLiked = currentPost.likes.some(like =>
                String(like.userId) === String(currentUser.userId)
            );
            if (userLiked) {
                isLiked = true;
                likeBtn.classList.add('liked');

            } else {
                isLiked = false;
                likeBtn.classList.remove('liked');
            }
        } else {
            isLiked = false;
            likeBtn.classList.remove('liked');
        }
    }

    function renderComments(comments) {


        commentList.innerHTML = '';

        comments.forEach((comment) => {
            const commentEl = document.createElement('div');
            commentEl.className = 'comment-item';
            commentEl.dataset.id = comment.commentId;

            // 현재 사용자가 댓글 작성자인지 확인
            // 보안: authorId/userId만 사용하여 판별
            const currentUserId = currentUser ? String(currentUser.userId) : null;

            // 백엔드가 authorId, userId, 또는 중첩된 author.userId를 반환해야 함
            let commentAuthorId = null;
            if (comment.authorId) {
                commentAuthorId = String(comment.authorId);
            } else if (comment.userId) {
                commentAuthorId = String(comment.userId);
            } else if (comment.author && comment.author.userId) {
                commentAuthorId = String(comment.author.userId);
            }

            // ID 기반 소유권 확인만 허용
            const isOwner = Boolean(currentUserId && commentAuthorId && currentUserId === commentAuthorId);



            // 표시할 작성자 이름 가져오기 (다양한 필드 시도)
            const authorDisplayName = comment.authorNickname || comment.nickname || comment.writer || '익명';

            const headerEl = document.createElement('div');
            headerEl.className = 'comment-header';

            const authorInfoEl = document.createElement('div');
            authorInfoEl.className = 'comment-author-info';

            const avatarEl = document.createElement('div');
            avatarEl.className = 'comment-avatar';
            if (comment.authorProfileImage) {
                avatarEl.style.backgroundImage = `url("${comment.authorProfileImage}")`;
            }

            const authorNameEl = document.createElement('span');
            authorNameEl.className = 'comment-author-name';
            authorNameEl.textContent = authorDisplayName;

            const dateEl = document.createElement('span');
            dateEl.className = 'comment-date';
            dateEl.textContent = formatDate(comment.createdAt);

            authorInfoEl.append(avatarEl, authorNameEl, dateEl);
            headerEl.appendChild(authorInfoEl);

            let editBtn = null;
            let deleteBtn = null;
            if (isOwner) {
                const actionsEl = document.createElement('div');
                actionsEl.className = 'comment-actions';

                editBtn = document.createElement('button');
                editBtn.className = 'comment-action-btn edit-comment-btn';
                editBtn.type = 'button';
                editBtn.textContent = '수정';

                deleteBtn = document.createElement('button');
                deleteBtn.className = 'comment-action-btn delete-comment-btn';
                deleteBtn.type = 'button';
                deleteBtn.textContent = '삭제';

                actionsEl.append(editBtn, deleteBtn);
                headerEl.appendChild(actionsEl);
            }

            const contentEl = document.createElement('div');
            contentEl.className = 'comment-content';
            contentEl.textContent = comment.content || '';

            commentEl.append(headerEl, contentEl);

            // 이 댓글에 이벤트 바인딩
            if (isOwner) {
                editBtn.addEventListener('click', () => {
                    editingCommentId = comment.commentId;
                    commentInput.value = comment.content;
                    commentInput.focus();
                    commentSubmitBtn.textContent = '댓글 수정';
                    commentSubmitBtn.disabled = false;
                    commentSubmitBtn.classList.add('active');
                    // 입력창으로 스크롤
                    commentInput.scrollIntoView({ behavior: 'smooth' });
                });

                deleteBtn.addEventListener('click', () => {
                    showModal('댓글을 삭제하시겠습니까?', () => {
                        deleteComment(comment.commentId);
                    });
                });
            }

            commentList.appendChild(commentEl);
        });
    }

    // ==========================================
    // 이벤트 리스너
    // ==========================================
    likeBtn.addEventListener('click', toggleLike);
    editPostBtn.addEventListener('click', () => {
        window.location.href = `post_edit.html?id=${postId}`;
    });
    deletePostBtn.addEventListener('click', () => {
        showModal('게시글을 삭제하시겠습니까?', deletePost);
    });
    modalCancelBtn.addEventListener('click', hideModal);
    deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) hideModal();
    });
    commentInput.addEventListener('input', () => {
        const hasContent = commentInput.value.trim().length > 0;
        commentSubmitBtn.disabled = !hasContent;
        commentSubmitBtn.classList.toggle('active', hasContent);
    });
    commentSubmitBtn.addEventListener('click', submitComment);

    // 프로필 드롭다운 이벤트
    if (profileIcon) {
        profileIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            profileDropdown.classList.toggle('show');
        });
    }

    // 외부 클릭 시 드롭다운 닫기
    document.addEventListener('click', (e) => {
        if (profileDropdown && !profileDropdown.contains(e.target) && e.target !== profileIcon) {
            profileDropdown.classList.remove('show');
        }
        if (!e.target.closest('.author-info') && !e.target.closest('.author-profile-card')) {
            closeAuthorCard();
        }
    });

    // 로그아웃
    if (logoutBtn) {
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
    }


    // 초기화
    async function init() {
        loadUserFromStorage(); // 로컬스토리지에서 즉시 로드
        await fetchPostDetail();
        await fetchLikeStatus(); // 사용자가 이미 좋아요한 게시글인지 확인
        fetchComments();
        fetchCurrentUser(); // 백그라운드에서 사용자 데이터 새로고침
    }

    init();

    // ==========================================
    // 브라우저 뒤로가기 시 데이터 새로고침 (bfcache 대응)
    // ==========================================
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            // bfcache에서 복원된 경우 - 게시글 상세 및 댓글 다시 로드
            init();
        }
    });
});
