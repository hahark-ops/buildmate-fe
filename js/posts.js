// posts.js - API_BASE_URL, formatNumber, formatDate는 common.js에서 제공

document.addEventListener('DOMContentLoaded', () => {
    const postContainer = document.getElementById('postList');
    const scrollTrigger = document.getElementById('scrollTrigger');
    const viewMorePostsBtn = document.getElementById('viewMorePostsBtn');
    const opportunityCountEl = document.getElementById('opportunityCount');
    const homeHeaderAuthActions = document.getElementById('homeHeaderAuthActions');
    const headerActions = document.querySelector('.header-actions');
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
    let totalPostCount = 0;

    const PREVIEW_FACT_LABELS = [
        '현재 단계',
        '필요 역할',
        '사용 도구',
        '협업 방식',
        '합류 형태',
    ];

    const DOMAIN_RULES = [
        { label: 'AI Tools', shortLabel: 'AI', keywords: ['ai', 'agent', 'llm', 'automation', 'cursor', 'gpt', '모델', '에이전트', '자동화'] },
        { label: 'Fintech', shortLabel: 'FN', keywords: ['finance', 'fintech', 'treasury', 'dao', 'crypto', '결제', '금융'] },
        { label: 'Healthcare', shortLabel: 'HC', keywords: ['health', 'care', 'medical', 'patient', '의료', '헬스', '건강'] },
        { label: 'Climate', shortLabel: 'CL', keywords: ['climate', 'eco', 'carbon', 'sustain', '환경', '탄소', '지속가능'] },
        { label: 'Commerce', shortLabel: 'CM', keywords: ['commerce', 'shopping', 'store', 'market', '이커머스', '커머스', '마켓'] },
        { label: 'Education', shortLabel: 'ED', keywords: ['edtech', 'learning', 'school', 'education', '교육', '학습'] },
        { label: 'Creator', shortLabel: 'CR', keywords: ['creator', 'content', 'media', 'design', '크리에이터', '콘텐츠'] },
    ];

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

    function updateProfileIcon(imageUrl) {
        if (!profileIcon) {
            return;
        }
        if (imageUrl) {
            profileIcon.style.backgroundImage = `url(${imageUrl})`;
        } else {
            profileIcon.style.backgroundColor = '#D9D9D9';
        }
    }

    function syncHomeHeaderState() {
        if (!homeHeaderAuthActions || !headerActions) {
            return;
        }
        const isLoggedIn = Boolean(currentUser && currentUser.userId);
        headerActions.hidden = !isLoggedIn;
        homeHeaderAuthActions.hidden = isLoggedIn;
    }

    function updateBoardMeta(totalCount) {
        if (!opportunityCountEl) {
            return;
        }

        if (totalCount === null) {
            opportunityCountEl.textContent = '열려 있는 프로젝트를 불러오는 중입니다.';
            return;
        }

        if (!Number.isFinite(totalCount) || totalCount <= 0) {
            opportunityCountEl.textContent = '아직 열린 프로젝트가 없습니다.';
            return;
        }

        opportunityCountEl.textContent = `${formatNumber(totalCount)}개의 열린 프로젝트`;
    }

    function updateLoadMoreButton() {
        if (!viewMorePostsBtn) {
            return;
        }
        const shouldShow = !isLastPage && offset > 0 && offset < totalPostCount;
        viewMorePostsBtn.hidden = !shouldShow;
        viewMorePostsBtn.disabled = isLoading;
    }

    function extractProjectSignals(rawContent) {
        const content = rawContent || '';
        const facts = {};
        const bodyLines = [];

        content.split('\n').forEach((line) => {
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

            const label = PREVIEW_FACT_LABELS.find((item) => trimmed.startsWith(`${item}:`) || trimmed.startsWith(`${item} :`) || trimmed.startsWith(`${item}：`));
            if (!label) {
                bodyLines.push(line);
                return;
            }

            const value = trimmed.replace(new RegExp(`^${label}\\s*[:：]\\s*`), '').trim();
            if (value && !facts[label]) {
                facts[label] = value;
            }
        });

        const rawSummary = bodyLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
        const collapsedSummary = rawSummary.replace(/\s+/g, ' ').trim();
        const summary = collapsedSummary || '프로젝트 요약이 아직 등록되지 않았습니다.';

        const splitChips = (value) => {
            if (!value) return [];
            return value
                .split(/,|\/|\||·|ㆍ|\n/)
                .map((item) => item.trim())
                .filter(Boolean)
                .slice(0, 4);
        };

        return {
            stage: facts['현재 단계'] || '모집 중',
            roles: splitChips(facts['필요 역할']),
            tools: splitChips(facts['사용 도구']),
            collaboration: facts['협업 방식'] || '대화 후 조율',
            joinType: facts['합류 형태'] || '합류 형태 협의',
            summary,
        };
    }

    function inferProjectDomain(post) {
        const source = `${post.title || ''} ${post.content || ''}`.toLowerCase();
        const matchedRule = DOMAIN_RULES.find((rule) => rule.keywords.some((keyword) => source.includes(keyword)));
        return matchedRule || { label: 'General', shortLabel: 'BM' };
    }

    function getProjectMark(post, projectSignals, projectDomain) {
        const source = (projectDomain.shortLabel || projectSignals.stage || post.title || 'BM').trim();
        return source.slice(0, 2).toUpperCase();
    }

    async function fetchPosts() {
        if (isLoading || isLastPage) return;

        isLoading = true;
        updateLoadMoreButton();
        const requestFeedVersion = feedVersion;
        const requestOffset = offset;

        try {
            const cacheBuster = Date.now();
            const response = await fetch(`${API_BASE_URL}/v1/posts?offset=${requestOffset}&limit=${LIMIT}&_ts=${cacheBuster}`, {
                cache: 'no-store'
            });
            const result = window.parseApiResponseSafe
                ? await window.parseApiResponseSafe(response)
                : await response.json();

            if (requestFeedVersion !== feedVersion) {
                return;
            }

            if (!response.ok) {
                console.error('Failed to fetch posts:', result.message);
                if (requestOffset === 0 && postContainer.children.length === 0) {
                    const errorState = document.createElement('div');
                    errorState.className = 'posts-empty-state';
                    errorState.textContent = '프로젝트를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
                    postContainer.appendChild(errorState);
                }
                return;
            }

            const data = result?.data ?? result ?? {};
            const posts = Array.isArray(data.posts) ? data.posts : [];
            totalPostCount = Number.isFinite(Number(data.totalCount))
                ? Number(data.totalCount)
                : requestOffset + posts.length;
            updateBoardMeta(totalPostCount);

            if (posts.length === 0) {
                isLastPage = true;
                if (requestOffset === 0) {
                    const emptyState = document.createElement('div');
                    emptyState.className = 'posts-empty-state';
                    emptyState.textContent = '아직 등록된 프로젝트가 없습니다. 첫 모집글을 올려보세요.';
                    postContainer.appendChild(emptyState);
                    if (opportunityCountEl) {
                        opportunityCountEl.textContent = '아직 열린 프로젝트가 없습니다.';
                    }
                }
                updateLoadMoreButton();
                return;
            }

            posts.forEach((post) => {
                const postEl = createPostElement(post);
                postContainer.appendChild(postEl);
            });

            offset = requestOffset + posts.length;
            if (offset >= totalPostCount) {
                isLastPage = true;
                if (scrollTrigger) {
                    scrollTrigger.style.display = 'none';
                }
            } else if (scrollTrigger) {
                scrollTrigger.style.display = 'block';
            }
        } catch (error) {
            console.error('Error fetching posts:', error);
        } finally {
            isLoading = false;
            updateLoadMoreButton();
        }
    }

    function resetAndReloadPosts() {
        feedVersion += 1;
        offset = 0;
        totalPostCount = 0;
        isLoading = false;
        isLastPage = false;
        postContainer.innerHTML = '';
        lastReloadAt = Date.now();
        updateBoardMeta(null);
        if (scrollTrigger) {
            scrollTrigger.style.display = 'block';
        }
        updateLoadMoreButton();
        fetchPosts();
    }

    function reloadPostsIfNeeded() {
        const now = Date.now();
        if (now - lastReloadAt < RELOAD_COOLDOWN_MS) {
            return;
        }
        resetAndReloadPosts();
    }

    async function fetchUserProfile() {
        try {
            const response = await fetch(`${API_BASE_URL}/v1/auth/me`, {
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            const result = await response.json();

            if (!response.ok) {
                console.warn('Login required or session expired');
                return;
            }

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
            syncHomeHeaderState();
        } catch (error) {
            console.error('Error fetching user profile:', error);
            syncHomeHeaderState();
        }
    }

    async function logout() {
        try {
            await fetch(`${API_BASE_URL}/v1/auth/logout`, {
                method: 'POST',
                credentials: 'include'
            });
            localStorage.removeItem('profileImage');
            localStorage.removeItem('nickname');
            localStorage.removeItem('email');
            localStorage.removeItem('userId');
            localStorage.removeItem('user');
            currentUser = null;
            syncHomeHeaderState();
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Logout failed:', error);
        }
    }

    function createPostElement(post) {
        const card = document.createElement('div');
        card.className = 'post-card';
        card.onclick = () => {
            window.location.href = `post_detail.html?id=${post.postId}`;
        };

        const projectSignals = extractProjectSignals(post.content || '');
        const projectDomain = inferProjectDomain(post);
        const topEl = document.createElement('div');
        topEl.className = 'post-card-top';

        const markEl = document.createElement('div');
        markEl.className = 'post-card-mark';
        markEl.textContent = getProjectMark(post, projectSignals, projectDomain);

        const headingEl = document.createElement('div');
        headingEl.className = 'post-card-heading';

        const eyebrowEl = document.createElement('div');
        eyebrowEl.className = 'post-card-eyebrow';
        eyebrowEl.textContent = `${projectSignals.stage} • ${projectDomain.label}`;

        const titleEl = document.createElement('div');
        titleEl.className = 'post-card-title';
        titleEl.textContent = post.title || '';

        headingEl.append(eyebrowEl, titleEl);
        topEl.append(markEl, headingEl);

        const summaryEl = document.createElement('p');
        summaryEl.className = 'post-card-summary';
        summaryEl.textContent = projectSignals.summary;

        const chipRowEl = document.createElement('div');
        chipRowEl.className = 'post-chip-row';
        const chipValues = projectSignals.roles.length ? projectSignals.roles : ['Roles Open'];
        chipValues.slice(0, 3).forEach((chipValue) => {
            const chipEl = document.createElement('span');
            chipEl.className = 'post-chip';
            chipEl.textContent = chipValue;
            chipRowEl.appendChild(chipEl);
        });

        const footerEl = document.createElement('div');
        footerEl.className = 'post-card-bottom';

        const toolRowEl = document.createElement('div');
        toolRowEl.className = 'post-card-tools';
        const toolValues = projectSignals.tools.length ? projectSignals.tools : [projectSignals.collaboration];
        toolValues.slice(0, 3).forEach((toolValue) => {
            const toolEl = document.createElement('span');
            toolEl.className = 'post-tool-pill';
            toolEl.textContent = toolValue;
            toolRowEl.appendChild(toolEl);
        });

        const joinTypeEl = document.createElement('div');
        joinTypeEl.className = 'post-card-join-type';
        joinTypeEl.textContent = projectSignals.joinType;

        footerEl.append(toolRowEl, joinTypeEl);

        card.append(topEl, summaryEl, chipRowEl, footerEl);
        return card;
    }

    if (profileIcon) {
        profileIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            profileDropdown.classList.toggle('show');
        });
    }

    document.addEventListener('click', (e) => {
        if (profileDropdown && !profileDropdown.contains(e.target) && e.target !== profileIcon) {
            profileDropdown.classList.remove('show');
        }
    });

    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }

    if (viewMorePostsBtn) {
        viewMorePostsBtn.addEventListener('click', () => {
            fetchPosts();
        });
    }

    loadUserFromStorage();
    syncHomeHeaderState();
    fetchUserProfile();
    resetAndReloadPosts();

    window.addEventListener('pageshow', (event) => {
        const navEntries = performance.getEntriesByType('navigation');
        const navType = navEntries.length > 0 ? navEntries[0].type : '';
        if (event.persisted || navType === 'back_forward') {
            reloadPostsIfNeeded();
        }
    });

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
