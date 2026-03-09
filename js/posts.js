// posts.js - API_BASE_URL, formatNumber, formatDate는 common.js에서 제공

document.addEventListener('DOMContentLoaded', () => {
    const postContainer = document.getElementById('postList');
    const scrollTrigger = document.getElementById('scrollTrigger');
    const profileIcon = document.getElementById('profileIcon');
    const profileDropdown = document.getElementById('profileDropdown');
    const logoutBtn = document.getElementById('logoutBtn');

    let offset = 0;
    const LIMIT = 10;
    let isLoading = false;
    let isLastPage = false;
    let wasHidden = false;
    let lastReloadAt = 0;
    const RELOAD_COOLDOWN_MS = 800;
    let feedVersion = 0;
    let currentUser = null;

    // 로컬 스토리지에서 사용자 정보 즉시 로드 (깜박임 방지)
    function loadUserFromStorage() {
        const profileImage = localStorage.getItem('profileImage');
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                currentUser = JSON.parse(userStr);
            } catch (error) {
                console.warn('failed to parse stored user', error);
            }
        }
        if (!currentUser && localStorage.getItem('userId')) {
            currentUser = {
                userId: localStorage.getItem('userId'),
                nickname: localStorage.getItem('nickname'),
                email: localStorage.getItem('email'),
                profileImage: localStorage.getItem('profileImage')
            };
        }
        if (profileImage) {
            updateProfileIcon(profileImage);
        }
    }

    // 1. 백엔드에서 게시글 목록 가져오기
    async function fetchPosts() {
        if (isLoading || isLastPage) return;

        isLoading = true;
        const requestFeedVersion = feedVersion;
        const requestOffset = offset;

        try {
            const cacheBuster = Date.now();
            const response = await fetch(`${API_BASE_URL}/v1/posts?offset=${requestOffset}&limit=${LIMIT}&_ts=${cacheBuster}`, {
                cache: 'no-store'
            });
            const result = await response.json();

            // 이전 reload 사이클에서 온 늦은 응답은 무시한다.
            if (requestFeedVersion !== feedVersion) {
                return;
            }

            if (response.ok) {
                const posts = result.data.posts;
                const totalCount = result.data.totalCount;

                if (posts.length === 0) {
                    isLastPage = true;
                    if (requestOffset === 0) {
                        const emptyState = document.createElement('div');
                        emptyState.style.textAlign = 'center';
                        emptyState.style.padding = '20px';
                        emptyState.textContent = '게시글이 없습니다. 첫 글을 작성해보세요!';
                        postContainer.appendChild(emptyState);
                    }
                    return;
                }


                posts.forEach(post => {
                    const postEl = createPostElement(post);
                    postContainer.appendChild(postEl);
                });

                offset = requestOffset + posts.length;

                // 더 이상 불러올 데이터가 없으면 중단
                if (offset >= totalCount) {
                    isLastPage = true;
                    // 스크롤 트리거 숨김 또는 감시 중지
                    if (scrollTrigger) scrollTrigger.style.display = 'none';
                }
            } else {
                console.error('Failed to fetch posts:', result.message);
            }
        } catch (error) {
            console.error('Error fetching posts:', error);
        } finally {
            isLoading = false;
        }
    }

    function resetAndReloadPosts() {
        feedVersion += 1;
        offset = 0;
        isLoading = false;
        isLastPage = false;
        postContainer.innerHTML = '';
        lastReloadAt = Date.now();
        if (scrollTrigger) {
            scrollTrigger.style.display = 'block';
        }
        fetchPosts();
    }

    function reloadPostsIfNeeded() {
        const now = Date.now();
        if (now - lastReloadAt < RELOAD_COOLDOWN_MS) {
            return;
        }
        resetAndReloadPosts();
    }

    // 2. 사용자 프로필 가져오기
    async function fetchUserProfile() {
        try {
            const response = await fetch(`${API_BASE_URL}/v1/auth/me`, {
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include' // 세션 쿠키 포함
            });

            const result = await response.json();

            if (response.ok) {
                // 최신 정보로 업데이트 및 스토리지 갱신
                const user = result.data || result;
                currentUser = user;
                localStorage.setItem('user', JSON.stringify(user));
                if (user.userId) localStorage.setItem('userId', user.userId);
                if (user.nickname) localStorage.setItem('nickname', user.nickname);
                if (user.email) localStorage.setItem('email', user.email);
                if (user.profileImage) {
                    localStorage.setItem('profileImage', user.profileImage);
                    updateProfileIcon(user.profileImage);
                }
            } else {
                console.warn('Login required or session expired');
            }
        } catch (error) {
            console.error('Error fetching user profile:', error);
        }
    }

    function updateProfileIcon(imageUrl) {
        if (profileIcon) {
            if (imageUrl) {
                profileIcon.style.backgroundImage = `url(${imageUrl})`;
            } else {
                profileIcon.style.backgroundColor = '#7F6AEE'; // 로그인한 사용자 기본 색상
            }
        }
    }

    function closeAuthorCards(exceptCard = null) {
        document.querySelectorAll('.author-profile-card.show').forEach((card) => {
            if (card !== exceptCard) {
                card.classList.remove('show');
            }
        });
    }


    async function logout() {
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
    }

    // HTML 요소 생성
    function createPostElement(post) {
        const card = document.createElement('div');
        card.className = 'post-card';
        card.onclick = () => {
            window.location.href = `post_detail.html?id=${post.postId}`;
        };

        // 백엔드 응답 매핑
        // 좋아요/댓글 수 포맷팅
        const likesStr = formatNumber(post.likeCount || 0);
        const commentsStr = formatNumber(post.commentCount || 0);
        const viewsStr = formatNumber(post.viewCount || 0);
        const dateStr = formatDate(post.createdAt);
        const titleEl = document.createElement('div');
        titleEl.className = 'post-card-title';
        titleEl.textContent = post.title || '';

        const metaEl = document.createElement('div');
        metaEl.className = 'post-card-meta';

        const statsEl = document.createElement('div');
        statsEl.className = 'post-stats';

        const likesEl = document.createElement('span');
        likesEl.textContent = `좋아요 ${likesStr}`;
        const commentsEl = document.createElement('span');
        commentsEl.textContent = `댓글 ${commentsStr}`;
        const viewsEl = document.createElement('span');
        viewsEl.textContent = `조회수 ${viewsStr}`;
        statsEl.append(likesEl, commentsEl, viewsEl);

        const dateEl = document.createElement('div');
        dateEl.className = 'post-date';
        dateEl.textContent = dateStr;
        metaEl.append(statsEl, dateEl);

        const dividerEl = document.createElement('div');
        dividerEl.className = 'post-divider';

        const authorRowEl = document.createElement('div');
        authorRowEl.className = 'post-author-row';

        const authorImageEl = document.createElement('div');
        authorImageEl.className = 'author-profile-img';
        if (post.authorProfileImage) {
            authorImageEl.style.backgroundImage = `url("${post.authorProfileImage}")`;
            authorImageEl.style.backgroundSize = 'cover';
        } else {
            authorImageEl.classList.add('default-profile');
        }

        const authorNameEl = document.createElement('span');
        authorNameEl.className = 'author-name';
        authorNameEl.textContent = post.writer || '';

        const authorCardEl = window.buildAuthorProfileCard({
            userId: post.authorId || post.userId,
            nickname: post.writer,
            profileImage: post.authorProfileImage
        });

        authorRowEl.classList.add('author-card-trigger');
        authorRowEl.addEventListener('click', (event) => {
            event.stopPropagation();
            const willShow = !authorCardEl.classList.contains('show');
            closeAuthorCards(authorCardEl);
            authorCardEl.classList.toggle('show', willShow);
        });

        authorRowEl.append(authorImageEl, authorNameEl);
        card.append(titleEl, metaEl, dividerEl, authorRowEl, authorCardEl);
        return card;
    }

    // 3. 이벤트 리스너
    // 드롭다운 토글
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
        if (!e.target.closest('.author-card-trigger') && !e.target.closest('.author-profile-card')) {
            closeAuthorCards();
        }
    });

    // 로그아웃
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }

    // 인터섹션 옵저버 (무한 스크롤)
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                fetchPosts();
            }
        });
    });

    if (scrollTrigger) {
        observer.observe(scrollTrigger);
    }

    // 초기화
    loadUserFromStorage(); // 스토리지에서 먼저 로드해서 깜박임 방지
    fetchUserProfile(); // 백엔드에서 최신 정보 확인
    resetAndReloadPosts(); // 초기 게시글 로드

    // ==========================================
    // 브라우저 뒤로가기 시 데이터 새로고침 (bfcache 대응)
    // ==========================================
    window.addEventListener('pageshow', (event) => {
        const navEntries = performance.getEntriesByType('navigation');
        const navType = navEntries.length > 0 ? navEntries[0].type : '';
        if (event.persisted || navType === 'back_forward') {
            reloadPostsIfNeeded();
        }
    });

    // 일부 브라우저/상황에서는 pageshow만으로 감지가 불안정할 수 있어 보조 처리
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            wasHidden = true;
            return;
        }

        if (document.visibilityState === 'visible' && wasHidden) {
            wasHidden = false;
            reloadPostsIfNeeded();
        }
    });
});
