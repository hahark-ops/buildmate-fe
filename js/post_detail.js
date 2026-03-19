// post_detail.js - API_BASE_URL, formatDate는 common.js에서 제공

document.addEventListener('DOMContentLoaded', () => {

    // URL에서 게시글 ID 추출
    const urlParams = new URLSearchParams(window.location.search);
    const isPreviewMode = urlParams.get('preview') === 'stitch';
    const postId = urlParams.get('id') || (isPreviewMode ? 'preview' : null);

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
    const postSummary = document.getElementById('postSummary');
    const authorAvatar = document.getElementById('authorAvatar');
    const authorName = document.getElementById('authorName');
    const postDate = document.getElementById('postDate');
    const postActions = document.getElementById('postActions');
    const authorInfo = document.querySelector('.author-info');
    const postMetaRow = document.querySelector('.post-meta-row');
    const postHeroBriefTitle = document.getElementById('postHeroBriefTitle');
    const postHeroBriefCopy = document.getElementById('postHeroBriefCopy');
    const postHeroBriefPills = document.getElementById('postHeroBriefPills');
    const authorCardSlot = document.getElementById('authorCardSlot');
    const editPostBtn = document.getElementById('editPostBtn');
    const deletePostBtn = document.getElementById('deletePostBtn');
    const postImageContainer = document.getElementById('postImageContainer');
    const postImage = document.getElementById('postImage');
    const postKeyFacts = document.getElementById('postKeyFacts');
    const postContent = document.getElementById('postContent');
    const lookingForSection = document.getElementById('lookingForSection');
    const lookingForGrid = document.getElementById('lookingForGrid');
    const likeBtn = document.getElementById('likeBtn');
    const likeCount = document.getElementById('likeCount');
    const viewCount = document.getElementById('viewCount');
    const commentCountEl = document.getElementById('commentCount');

    // 댓글 요소
    const commentInput = document.getElementById('commentInput');
    const commentSubmitBtn = document.getElementById('commentSubmitBtn');
    const commentList = document.getElementById('commentList');
    const askQuestionBtn = document.getElementById('askQuestionBtn');
    const commentsSection = document.getElementById('commentsSection');

    // 모달 요소
    const deleteModal = document.getElementById('deleteModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalSubtitle = document.getElementById('modalSubtitle');
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
    let modalConfirmHandler = null;

    const previewPost = {
        postId: 9999,
        title: 'Apple-style onboarding for a fast-moving maker team',
        content: [
            '현재 단계: MVP 실험 직전',
            '필요 역할: Frontend Designer, Product Engineer, Growth Marketer',
            '사용 도구: Figma, Cursor, Supabase, Notion',
            '협업 방식: 주 2회 싱크 + 비동기 작업',
            '합류 형태: 파트타임 코어 멤버',
            '',
            '프로젝트 소개: 팀원을 모으는 서비스지만, 첫 인상은 제품처럼 보여야 한다고 판단했습니다.',
            '이번 라운드에서는 홈 보드와 프로젝트 상세, 협업 채팅의 밀도를 다시 설계하고 있습니다.',
            '바로 구현 가능한 수준의 시안을 먼저 맞춘 뒤 실제 기능을 그대로 입히는 방식으로 진행합니다.',
        ].join('\n'),
        writer: 'Ari Kim',
        authorId: 101,
        authorProfileImage: '',
        createdAt: '2026-03-19T09:00:00.000Z',
        likeCount: 28,
        viewCount: 184,
        commentCount: 2,
        isLiked: false,
    };

    const previewComments = [
        {
            commentId: 1,
            content: '디자인 시스템 없이 먼저 홈/상세 톤을 고정하는 방향인가요?',
            authorId: 202,
            authorNickname: 'Min',
            authorProfileImage: '',
            createdAt: '2026-03-19T10:20:00.000Z',
        },
        {
            commentId: 2,
            content: '합류 형태가 파트타임 코어 멤버면 주당 예상 투입 시간도 함께 맞춰보면 좋겠습니다.',
            authorId: 303,
            authorNickname: 'Soo',
            authorProfileImage: '',
            createdAt: '2026-03-19T11:05:00.000Z',
        },
    ];

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
        if (cachedProfileImage && window.applyProfileIconImage) {
            window.applyProfileIconImage(cachedProfileImage);
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

    const KEY_FACT_LABELS = [
        '현재 단계',
        '필요 역할',
        '사용 도구',
        '협업 방식',
        '합류 형태',
    ];

    // formatDate는 common.js에서 제공

    function parseStructuredContent(rawContent) {
        const content = rawContent || '';
        const lines = content.split('\n');
        const factMap = new Map();
        const bodyLines = [];

        lines.forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed) {
                bodyLines.push(line);
                return;
            }

            const introMatch = trimmed.match(/^프로젝트 소개\s*[:：]\s*(.*)$/);
            if (introMatch) {
                if (introMatch[1].trim()) {
                    bodyLines.push(introMatch[1].trim());
                }
                return;
            }

            const matchedLabel = KEY_FACT_LABELS.find((label) => trimmed.startsWith(`${label}:`) || trimmed.startsWith(`${label} :`) || trimmed.startsWith(`${label}：`));
            if (!matchedLabel) {
                bodyLines.push(line);
                return;
            }

            const value = trimmed.replace(new RegExp(`^${matchedLabel}\\s*[:：]\\s*`), '').trim();
            if (value && !factMap.has(matchedLabel)) {
                factMap.set(matchedLabel, value);
                return;
            }
            bodyLines.push(line);
        });

        return {
            facts: KEY_FACT_LABELS
                .filter((label) => factMap.has(label))
                .map((label) => ({ label, value: factMap.get(label) })),
            body: bodyLines.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
        };
    }

    function renderKeyFacts(facts) {
        if (!postKeyFacts) {
            return;
        }

        postKeyFacts.innerHTML = '';
        if (!facts.length) {
            postKeyFacts.hidden = true;
            return;
        }

        facts.forEach((fact) => {
            const item = document.createElement('div');
            item.className = 'post-key-fact';

            const label = document.createElement('span');
            label.className = 'post-key-fact-label';
            label.textContent = fact.label;

            const value = document.createElement('strong');
            value.className = 'post-key-fact-value';
            value.textContent = fact.value;

            item.append(label, value);
            postKeyFacts.appendChild(item);
        });

        postKeyFacts.hidden = false;
    }

    function splitFactValue(value) {
        if (!value) {
            return [];
        }
        return value
            .split(/,|\/|\||·|ㆍ|\n/)
            .map((item) => item.trim())
            .filter(Boolean);
    }

    function renderLookingFor(facts) {
        if (!lookingForSection || !lookingForGrid) {
            return;
        }

        const factMap = new Map(facts.map((fact) => [fact.label, fact.value]));
        const cards = [];
        const roles = splitFactValue(factMap.get('필요 역할'));
        const tools = splitFactValue(factMap.get('사용 도구'));

        if (roles.length) {
            cards.push({
                label: 'Needed Roles',
                value: roles.slice(0, 3).join(' · ')
            });
        }
        if (factMap.get('협업 방식')) {
            cards.push({
                label: 'Collaboration',
                value: factMap.get('협업 방식')
            });
        }
        if (tools.length) {
            cards.push({
                label: 'Tool Stack',
                value: tools.slice(0, 4).join(' · ')
            });
        }
        if (factMap.get('합류 형태')) {
            cards.push({
                label: 'Join Type',
                value: factMap.get('합류 형태')
            });
        }

        lookingForGrid.innerHTML = '';
        if (!cards.length) {
            lookingForSection.hidden = true;
            return;
        }

        cards.forEach((card) => {
            const item = document.createElement('div');
            item.className = 'looking-for-item';

            const label = document.createElement('span');
            label.className = 'looking-for-item-label';
            label.textContent = card.label;

            const value = document.createElement('strong');
            value.className = 'looking-for-item-value';
            value.textContent = card.value;

            item.append(label, value);
            lookingForGrid.appendChild(item);
        });

        lookingForSection.hidden = false;
    }

    function buildLeadSummary(bodyText, facts) {
        const summarySource = (bodyText || '').replace(/\s+/g, ' ').trim();
        if (summarySource) {
            return summarySource.length > 180 ? `${summarySource.slice(0, 177)}...` : summarySource;
        }

        if (facts.length) {
            return facts.map((fact) => `${fact.label} ${fact.value}`).join(' · ');
        }

        return '현재 단계와 필요한 역할을 확인한 뒤, 공개 질문과 협업 제안으로 실제 작업 흐름을 이어갈 수 있습니다.';
    }

    function renderHeroBrief(facts, bodyText) {
        if (!postHeroBriefTitle || !postHeroBriefCopy || !postHeroBriefPills) {
            return;
        }

        const factMap = new Map(facts.map((fact) => [fact.label, fact.value]));
        const roles = splitFactValue(factMap.get('필요 역할'));
        const tools = splitFactValue(factMap.get('사용 도구'));
        const stage = factMap.get('현재 단계') || '초기 논의 단계';
        const collaboration = factMap.get('협업 방식') || '협업 방식 조율 필요';
        const joinType = factMap.get('합류 형태') || '합류 형태 협의';
        const summarySource = (bodyText || '').replace(/\s+/g, ' ').trim();

        postHeroBriefTitle.textContent = roles.length
            ? `${roles[0]} 중심으로 팀을 확장합니다.`
            : '합류 전에 역할 적합도를 먼저 맞춰보세요.';
        postHeroBriefCopy.textContent = summarySource
            ? (summarySource.length > 120 ? `${summarySource.slice(0, 117)}...` : summarySource)
            : '핵심 역할, 협업 방식, 합류 형태를 빠르게 확인하고 공개 질문으로 이어가세요.';

        const pills = [
            `Stage · ${stage}`,
            `Mode · ${collaboration}`,
            `Join · ${joinType}`,
            roles.length ? `Roles · ${roles.slice(0, 2).join(' / ')}` : null,
            tools.length ? `Tools · ${tools.slice(0, 2).join(' / ')}` : null,
        ].filter(Boolean);

        postHeroBriefPills.innerHTML = '';
        pills.forEach((pillText) => {
            const pill = document.createElement('span');
            pill.className = 'post-hero-brief-pill';
            pill.textContent = pillText;
            postHeroBriefPills.appendChild(pill);
        });
    }

    function showModal(title, onConfirm, subtitle = '삭제한 모집 내용은 복구할 수 없습니다.') {
        modalTitle.textContent = title;
        if (modalSubtitle) {
            modalSubtitle.textContent = subtitle;
        }
        deleteModal.style.display = 'flex';

        if (modalConfirmHandler) {
            modalConfirmBtn.removeEventListener('click', modalConfirmHandler);
        }

        modalConfirmHandler = () => {
            deleteModal.style.display = 'none';
            modalConfirmBtn.removeEventListener('click', modalConfirmHandler);
            modalConfirmHandler = null;
            onConfirm();
        };

        modalConfirmBtn.addEventListener('click', modalConfirmHandler);
    }

    function hideModal() {
        deleteModal.style.display = 'none';
        if (modalConfirmHandler) {
            modalConfirmBtn.removeEventListener('click', modalConfirmHandler);
            modalConfirmHandler = null;
        }
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

        if (authorCardSlot) {
            authorCardEl.classList.add('show');
            authorCardSlot.innerHTML = '';
            authorCardSlot.appendChild(authorCardEl);
        } else {
            postMetaRow.insertAdjacentElement('afterend', authorCardEl);
        }

        if (authorInfo) {
            authorInfo.onclick = (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (authorCardSlot) {
                    authorCardEl.classList.add('show');
                    authorCardSlot.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    return;
                }
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
                    if (currentUser.profileImage && window.applyProfileIconImage) {
                        window.applyProfileIconImage(currentUser.profileImage);
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
                credentials: 'include',
                cache: 'no-store'
            });

            if (response.ok) {
                const result = await response.json();
                const data = result.data || result;
                const comments = Array.isArray(data) ? data : (data.comments || []);
                renderComments(comments);
                return comments;
            }

            const hasRenderedComments = Boolean(commentList.querySelector('.comment-item'));
            const hasExpectedComments = Number(currentPost?.commentCount || 0) > 0;
            renderCommentStatus(
                hasRenderedComments
                    ? '최신 질문을 다시 불러오지 못했습니다. 잠시 후 새로고침 해주세요.'
                    : (hasExpectedComments
                        ? '질문 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
                        : '아직 공개 질문이나 문의가 없습니다.'),
                (hasRenderedComments || hasExpectedComments) ? 'error' : 'empty',
                hasRenderedComments
            );
            console.warn('Failed to fetch comments:', response.status);
        } catch (error) {
            console.error('Failed to fetch comments:', error);
            const hasRenderedComments = Boolean(commentList.querySelector('.comment-item'));
            const hasExpectedComments = Number(currentPost?.commentCount || 0) > 0;
            renderCommentStatus(
                hasRenderedComments
                    ? '최신 질문을 다시 불러오지 못했습니다. 잠시 후 새로고침 해주세요.'
                    : (hasExpectedComments
                        ? '질문 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
                        : '아직 공개 질문이나 문의가 없습니다.'),
                (hasRenderedComments || hasExpectedComments) ? 'error' : 'empty',
                hasRenderedComments
            );
        }
        return [];
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
        if (isPreviewMode) {
            isLiked = !isLiked;
            likeBtn.classList.toggle('liked', isLiked);
            const baseCount = Number(currentPost?.likeCount || 0);
            const nextCount = isLiked ? baseCount + 1 : baseCount;
            likeCount.textContent = formatCount(nextCount);
            return;
        }

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
                showCustomModal('모집글이 삭제되었습니다.', () => {
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
                const result = await response.json();
                const commentPayload = result.data || null;
                const isEditMode = Boolean(editingCommentId);
                const pendingCommentId = editingCommentId;

                commentInput.value = '';
                commentSubmitBtn.textContent = '질문 남기기';
                commentSubmitBtn.disabled = true;
                commentSubmitBtn.classList.remove('active');
                editingCommentId = null;

                if (!isEditMode && commentPayload) {
                    prependComment(commentPayload);
                }
                if (isEditMode && commentPayload) {
                    replaceRenderedComment(pendingCommentId, commentPayload);
                }

                await fetchComments();

                if (!isEditMode) {
                    let count = parseInt(commentCountEl.textContent.replace(/[^0-9]/g, '')) || 0;
                    commentCountEl.textContent = formatCount(count + 1);
                    if (currentPost) {
                        currentPost.commentCount = count + 1;
                    }
                }
            } else {
                showCustomModal('질문 등록에 실패했습니다.');
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
                const existingComment = commentList.querySelector(`[data-id="${commentId}"]`);
                if (existingComment) {
                    existingComment.remove();
                }

                let count = parseInt(commentCountEl.textContent.replace(/[^0-9]/g, '')) || 0;
                const nextCount = Math.max(0, count - 1);
                commentCountEl.textContent = formatCount(nextCount);
                if (currentPost) {
                    currentPost.commentCount = nextCount;
                }

                if (!commentList.querySelector('.comment-item')) {
                    renderCommentStatus('아직 공개 질문이나 문의가 없습니다.');
                }

                await fetchComments();
            } else {
                showCustomModal('질문 삭제에 실패했습니다.');
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

        const structuredContent = parseStructuredContent(currentPost.content || '');

        const bodyText = structuredContent.body || '';

        postTitle.textContent = currentPost.title || '';
        postSummary.textContent = buildLeadSummary(bodyText, structuredContent.facts);
        renderHeroBrief(structuredContent.facts, bodyText);
        renderKeyFacts(structuredContent.facts);
        renderLookingFor(structuredContent.facts);
        postContent.textContent = bodyText;
        postContent.style.display = bodyText ? 'block' : 'none';
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
        likeBtn.disabled = false;



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

    function buildCommentElement(comment) {
        const commentEl = document.createElement('div');
        commentEl.className = 'comment-item';
        commentEl.dataset.id = comment.commentId;

        const currentUserId = currentUser ? String(currentUser.userId) : null;
        let commentAuthorId = null;
        if (comment.authorId) {
            commentAuthorId = String(comment.authorId);
        } else if (comment.userId) {
            commentAuthorId = String(comment.userId);
        } else if (comment.author && comment.author.userId) {
            commentAuthorId = String(comment.author.userId);
        }

        const isOwner = Boolean(currentUserId && commentAuthorId && currentUserId === commentAuthorId);
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
            editBtn.textContent = '질문 수정';

            deleteBtn = document.createElement('button');
            deleteBtn.className = 'comment-action-btn delete-comment-btn';
            deleteBtn.type = 'button';
            deleteBtn.textContent = '질문 삭제';

            actionsEl.append(editBtn, deleteBtn);
            headerEl.appendChild(actionsEl);
        }

        const contentEl = document.createElement('div');
        contentEl.className = 'comment-content';
        contentEl.textContent = comment.content || '';

        commentEl.append(headerEl, contentEl);

        if (isOwner) {
            editBtn.addEventListener('click', () => {
                editingCommentId = comment.commentId;
                commentInput.value = comment.content;
                commentInput.focus();
                commentSubmitBtn.textContent = '질문 수정';
                commentSubmitBtn.disabled = false;
                commentSubmitBtn.classList.add('active');
                commentInput.scrollIntoView({ behavior: 'smooth' });
            });

            deleteBtn.addEventListener('click', () => {
                showModal('질문을 삭제하시겠습니까?', () => {
                    deleteComment(comment.commentId);
                }, '삭제한 질문은 복구할 수 없습니다.');
            });
        }

        return commentEl;
    }

    function prependComment(comment) {
        const nextCommentId = String(comment.commentId || '');
        if (nextCommentId && commentList.querySelector(`[data-id="${nextCommentId}"]`)) {
            return;
        }
        const commentEl = buildCommentElement(comment);
        commentList.appendChild(commentEl);
    }

    function replaceRenderedComment(commentId, nextComment) {
        const targetId = String(commentId || nextComment.commentId || '');
        const existing = targetId ? commentList.querySelector(`[data-id="${targetId}"]`) : null;
        const nextEl = buildCommentElement(nextComment);
        if (existing) {
            existing.replaceWith(nextEl);
            return;
        }
        commentList.appendChild(nextEl);
    }

    function renderComments(comments) {
        commentList.innerHTML = '';
        if (!comments.length) {
            renderCommentStatus('아직 공개 질문이나 문의가 없습니다.');
            return;
        }
        comments.forEach((comment) => {
            commentList.appendChild(buildCommentElement(comment));
        });
    }

    function renderCommentStatus(message, variant = 'empty', preserveExisting = false) {
        if (!preserveExisting) {
            commentList.innerHTML = '';
        } else {
            commentList.querySelectorAll('.comment-empty-state, .comment-error-state').forEach((el) => el.remove());
        }

        const stateEl = document.createElement('div');
        stateEl.className = variant === 'error' ? 'comment-error-state' : 'comment-empty-state';
        stateEl.textContent = message;
        commentList.appendChild(stateEl);
    }

    // ==========================================
    // 이벤트 리스너
    // ==========================================
    likeBtn.addEventListener('click', toggleLike);
    editPostBtn.addEventListener('click', () => {
        window.location.href = `post_edit.html?id=${postId}`;
    });
    deletePostBtn.addEventListener('click', () => {
        showModal('모집글을 삭제하시겠습니까?', deletePost);
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
    if (askQuestionBtn) {
        askQuestionBtn.addEventListener('click', () => {
            if (commentsSection) {
                commentsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            commentInput.focus();
        });
    }

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
        likeBtn.disabled = true;
        if (isPreviewMode) {
            currentUser = {
                userId: 101,
                nickname: 'Ari Kim',
                email: 'ari@buildmate.local',
                profileImage: ''
            };
            currentPost = previewPost;
            renderPost();
            renderComments(previewComments);
            return;
        }
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
