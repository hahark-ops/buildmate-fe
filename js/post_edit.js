// post_edit.js - API_BASE_URL, showCustomModal은 common.js에서 제공

document.addEventListener('DOMContentLoaded', () => {

    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('id');

    if (!postId) {
        showCustomModal('잘못된 접근입니다.', () => {
            window.location.href = 'index.html';
        });
        return;
    }

    const profileIcon = document.getElementById('profileIcon');
    const profileTrigger = document.getElementById('composerProfileTrigger') || profileIcon;
    const profileDropdown = document.getElementById('profileDropdown');
    const logoutBtn = document.getElementById('logoutBtn');
    const composerProfileLabel = document.getElementById('composerProfileLabel');

    function updateProfileSummary(user) {
        if (!composerProfileLabel) {
            return;
        }
        composerProfileLabel.textContent = user?.nickname || localStorage.getItem('nickname') || 'My Workspace';
    }

    async function parseApiResponse(response) {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            return await response.json();
        }
        const text = await response.text();
        return { message: text || `요청 처리에 실패했습니다. (HTTP ${response.status})` };
    }

    async function fetchUserProfile() {
        try {
            const response = await fetch(`${API_BASE_URL}/v1/auth/me`, {
                credentials: 'include'
            });
            if (response.ok) {
                const result = await response.json();
                const user = result.data || result;
                updateProfileSummary(user);
                if (user.profileImage) {
                    localStorage.setItem('profileImage', user.profileImage);
                    if (profileIcon) profileIcon.style.backgroundImage = `url(${user.profileImage})`;
                } else if (profileIcon) {
                    profileIcon.style.backgroundColor = '#DBEAFE';
                }
            }
        } catch (error) {
            console.error('Failed to load user profile:', error);
        }
    }

    const cachedProfileImage = localStorage.getItem('profileImage');
    if (cachedProfileImage && profileIcon) {
        profileIcon.style.backgroundImage = `url(${cachedProfileImage})`;
    }
    updateProfileSummary();

    if (profileTrigger && profileDropdown) {
        profileTrigger.addEventListener('click', (event) => {
            event.stopPropagation();
            profileDropdown.classList.toggle('show');
        });
        document.addEventListener('click', (event) => {
            if (!profileDropdown.contains(event.target) && !profileTrigger.contains(event.target)) {
                profileDropdown.classList.remove('show');
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (event) => {
            event.preventDefault();
            try {
                await fetch(`${API_BASE_URL}/v1/auth/logout`, { method: 'POST', credentials: 'include' });
                localStorage.removeItem('profileImage');
                localStorage.removeItem('nickname');
                localStorage.removeItem('email');
                localStorage.removeItem('userId');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
            } catch (error) {
                console.error(error);
            }
        });
    }

    fetchUserProfile();

    const titleInput = document.getElementById('title');
    const contentInput = document.getElementById('content');
    const helperText = document.getElementById('helperText');
    const imageInput = document.getElementById('imageInput');
    const fileSelectBtn = document.getElementById('fileSelectBtn');
    const fileNameSpan = document.getElementById('fileName');
    const submitBtn = document.getElementById('submitBtn');
    const uploadDropzone = document.getElementById('uploadDropzone');
    const projectStageSelect = document.getElementById('projectStage');
    const rolesInput = document.getElementById('rolesInput');
    const roleAddBtn = document.getElementById('roleAddBtn');
    const rolesPreview = document.getElementById('rolesPreview');
    const toolsInput = document.getElementById('toolsInput');
    const joinTypeInput = document.getElementById('joinType');
    const collaborationModeInput = document.getElementById('collaborationMode');
    const timeZoneInput = document.getElementById('timeZoneInput');
    const commitmentInput = document.getElementById('commitmentInput');
    const communicationToolInput = document.getElementById('communicationToolInput');
    const discardDraftBtn = document.getElementById('discardDraftBtn');
    const saveDraftBtn = document.getElementById('saveDraftBtn');

    const POST_IMAGE_MAX_BYTES = 20 * 1024 * 1024;
    let selectedRoles = [];
    let currentFileUrl = null;

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

    function syncRolePreview() {
        if (!rolesPreview) return;

        rolesPreview.innerHTML = '';
        selectedRoles.forEach((role) => {
            const chip = document.createElement('span');
            chip.className = 'composer-role-pill';

            const text = document.createElement('span');
            text.textContent = role;

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.setAttribute('aria-label', `${role} 삭제`);
            removeBtn.innerHTML = '<span class="material-symbols-outlined">close</span>';
            removeBtn.addEventListener('click', () => {
                selectedRoles = selectedRoles.filter((item) => item !== role);
                syncRolePreview();
            });

            chip.append(text, removeBtn);
            rolesPreview.appendChild(chip);
        });
    }

    function addRolesFromValue(rawValue) {
        const nextRoles = rawValue
            .split(/,|\n/)
            .map((item) => item.trim())
            .filter(Boolean);

        if (!nextRoles.length) {
            return;
        }

        nextRoles.forEach((role) => {
            if (!selectedRoles.includes(role)) {
                selectedRoles.push(role);
            }
        });
        rolesInput.value = '';
        syncRolePreview();
    }

    function setJoinType(nextValue) {
        joinTypeInput.value = nextValue;
        document.querySelectorAll('[data-join-type]').forEach((button) => {
            button.classList.toggle('is-active', button.dataset.joinType === nextValue);
        });
    }

    function setCollaborationMode(nextValue) {
        collaborationModeInput.value = nextValue;
        document.querySelectorAll('[data-collaboration-mode]').forEach((button) => {
            button.classList.toggle('is-active', button.dataset.collaborationMode === nextValue);
        });
    }

    function buildCollaborationSummary() {
        const rawOverride = collaborationModeInput.dataset.raw || '';
        const hasDefaultSupportValues = timeZoneInput.value.trim() === 'Anywhere'
            && commitmentInput.value.trim() === '10-15 hrs / week'
            && communicationToolInput.value.trim() === 'Discord / Slack';

        if (rawOverride && hasDefaultSupportValues) {
            return rawOverride;
        }

        return [
            collaborationModeInput.value.trim(),
            timeZoneInput.value.trim(),
            commitmentInput.value.trim(),
            communicationToolInput.value.trim()
        ].filter(Boolean).join(' / ');
    }

    function buildStructuredContent() {
        const rawSummary = contentInput.value.trim();
        if (!rawSummary) {
            return rawSummary;
        }

        const alreadyStructured = /(^|\n)\s*(프로젝트 소개|현재 단계|필요 역할|사용 도구|협업 방식|합류 형태)\s*[:：]/.test(rawSummary);
        const stage = projectStageSelect.value.trim();
        const tools = toolsInput.value.trim();
        const collaboration = buildCollaborationSummary();
        const joinType = joinTypeInput.value.trim();

        if (alreadyStructured || (!stage && !selectedRoles.length && !tools && !collaboration && !joinType)) {
            return rawSummary;
        }

        const lines = [];
        if (stage) lines.push(`현재 단계: ${stage}`);
        if (selectedRoles.length) lines.push(`필요 역할: ${selectedRoles.join(', ')}`);
        if (tools) lines.push(`사용 도구: ${tools}`);
        if (collaboration) lines.push(`협업 방식: ${collaboration}`);
        if (joinType) lines.push(`합류 형태: ${joinType}`);
        lines.push('');

        const summaryLines = rawSummary.split('\n').map((line) => line.trimEnd());
        if (summaryLines[0]) {
            lines.push(`프로젝트 소개: ${summaryLines[0]}`);
        }
        if (summaryLines.length > 1) {
            lines.push(...summaryLines.slice(1));
        }
        return lines.join('\n').trim();
    }

    function parseStructuredContent(rawContent) {
        const lines = (rawContent || '').split('\n');
        const facts = new Map();
        const bodyLines = [];
        const factLabels = ['현재 단계', '필요 역할', '사용 도구', '협업 방식', '합류 형태'];

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

            const matchedLabel = factLabels.find((label) => trimmed.startsWith(`${label}:`) || trimmed.startsWith(`${label} :`) || trimmed.startsWith(`${label}：`));
            if (!matchedLabel) {
                bodyLines.push(line);
                return;
            }

            const value = trimmed.replace(new RegExp(`^${matchedLabel}\\s*[:：]\\s*`), '').trim();
            if (value && !facts.has(matchedLabel)) {
                facts.set(matchedLabel, value);
                return;
            }
            bodyLines.push(line);
        });

        return {
            facts,
            summary: bodyLines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
        };
    }

    function ensureSelectValue(selectEl, value) {
        if (!selectEl || !value) {
            return;
        }
        const options = Array.from(selectEl.options);
        const hasOption = options.some((option) => option.value === value || option.textContent === value);
        if (!hasOption) {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            selectEl.appendChild(option);
        }
        selectEl.value = value;
    }

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
            const post = result.data || result;
            const parsed = parseStructuredContent(post.content || '');

            titleInput.value = post.title || '';
            contentInput.value = parsed.summary || post.content || '';

            ensureSelectValue(projectStageSelect, parsed.facts.get('현재 단계') || '');
            selectedRoles = (parsed.facts.get('필요 역할') || '')
                .split(/,|\/|\||·|ㆍ|\n/)
                .map((item) => item.trim())
                .filter(Boolean);
            syncRolePreview();
            toolsInput.value = parsed.facts.get('사용 도구') || '';

            const joinType = parsed.facts.get('합류 형태') || joinTypeInput.value || '지분 기반';
            setJoinType(joinType);

            const collaborationValue = parsed.facts.get('협업 방식') || collaborationModeInput.value || '비동기 중심';
            collaborationModeInput.dataset.raw = parsed.facts.get('협업 방식') || '';
            setCollaborationMode(collaborationValue.includes('고밀도') ? '고밀도 협업' : '비동기 중심');

            if (post.fileUrl) {
                currentFileUrl = post.fileUrl;
                const fileName = post.fileUrl.split('/').pop();
                fileNameSpan.textContent = fileName || 'Existing file';
                fileNameSpan.classList.add('selected');
            } else {
                fileNameSpan.textContent = 'No file selected';
            }

            checkFormValidity();
        } catch (error) {
            console.error('Failed to load post:', error);
            showCustomModal('게시글을 불러오는데 실패했습니다.');
        }
    }

    titleInput.addEventListener('input', () => {
        hideHelper();
        checkFormValidity();
    });

    contentInput.addEventListener('input', () => {
        hideHelper();
        checkFormValidity();
    });

    if (roleAddBtn) {
        roleAddBtn.addEventListener('click', () => addRolesFromValue(rolesInput.value));
    }

    if (rolesInput) {
        rolesInput.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ',') {
                return;
            }
            event.preventDefault();
            addRolesFromValue(rolesInput.value);
        });
        rolesInput.addEventListener('blur', () => addRolesFromValue(rolesInput.value));
    }

    document.querySelectorAll('[data-join-type]').forEach((button) => {
        button.addEventListener('click', () => setJoinType(button.dataset.joinType));
    });

    document.querySelectorAll('[data-collaboration-mode]').forEach((button) => {
        button.addEventListener('click', () => {
            collaborationModeInput.dataset.raw = '';
            setCollaborationMode(button.dataset.collaborationMode);
        });
    });

    [timeZoneInput, commitmentInput, communicationToolInput].forEach((input) => {
        input?.addEventListener('input', () => {
            collaborationModeInput.dataset.raw = '';
        });
    });

    fileSelectBtn?.addEventListener('click', (event) => {
        event.stopPropagation();
        imageInput.click();
    });

    uploadDropzone?.addEventListener('click', () => {
        imageInput.click();
    });

    uploadDropzone?.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
            return;
        }
        event.preventDefault();
        imageInput.click();
    });

    imageInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            if (file.size > POST_IMAGE_MAX_BYTES) {
                imageInput.value = '';
                showHelper('* 게시글 이미지는 20MB 이하 파일만 업로드할 수 있습니다.');
                return;
            }
            fileNameSpan.textContent = file.name;
            fileNameSpan.classList.add('selected');
            currentFileUrl = null;
            hideHelper();
        } else if (!currentFileUrl) {
            fileNameSpan.textContent = 'No file selected';
            fileNameSpan.classList.remove('selected');
        }
    });

    discardDraftBtn?.addEventListener('click', () => {
        window.history.back();
    });

    saveDraftBtn?.addEventListener('click', () => {
        showCustomModal('편집 상태는 로컬에 유지됩니다. 게시할 준비가 되면 오른쪽 버튼으로 업데이트하세요.');
    });

    submitBtn.addEventListener('click', async () => {
        if (submitBtn.disabled) return;

        const title = titleInput.value.trim();
        const content = buildStructuredContent();

        if (!title || !content) {
            showHelper('* 제목, 내용을 모두 작성해주세요');
            return;
        }

        let fileUrl = currentFileUrl;
        if (imageInput.files[0]) {
            try {
                if (imageInput.files[0].size > POST_IMAGE_MAX_BYTES) {
                    showHelper('* 게시글 이미지는 20MB 이하 파일만 업로드할 수 있습니다.');
                    return;
                }
                fileUrl = await uploadFileViaPresigned(imageInput.files[0], 'post');
            } catch (error) {
                console.error('Image upload error:', error);
                showHelper(error.message || '이미지 업로드 중 오류가 발생했습니다.');
                return;
            }
        }

        try {
            const response = await fetch(`${API_BASE_URL}/v1/posts/${postId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    title,
                    content,
                    fileUrl
                })
            });

            const data = await parseApiResponse(response);

            if (response.ok) {
                showCustomModal('프로젝트 모집글이 수정되었습니다.', () => {
                    window.location.href = `post_detail.html?id=${postId}`;
                });
            } else if (response.status === 401) {
                showCustomModal('로그인이 필요합니다.', () => {
                    window.location.href = 'login.html';
                });
            } else {
                showHelper(data.message || '모집글 수정에 실패했습니다.');
            }
        } catch (error) {
            console.error('Post update error:', error);
            showHelper('서버 통신 중 오류가 발생했습니다.');
        }
    });

    setJoinType(joinTypeInput.value || '지분 기반');
    setCollaborationMode(collaborationModeInput.value || '비동기 중심');
    syncRolePreview();
    loadPostData();
});
