document.addEventListener('DOMContentLoaded', () => {
    const profileIcon = document.getElementById('profileIcon');
    const profileDropdown = document.getElementById('profileDropdown');
    const logoutBtn = document.getElementById('logoutBtn');
    const roomListEl = document.getElementById('dmRoomList');
    const messageListEl = document.getElementById('dmMessageList');
    const emptyStateEl = document.getElementById('dmEmptyState');
    const composerEl = document.getElementById('dmComposer');
    const inputEl = document.getElementById('dmInput');
    const sendBtn = document.getElementById('dmSendBtn');
    const peerAvatarEl = document.getElementById('dmPeerAvatar');
    const peerNameEl = document.getElementById('dmPeerName');
    const statusMessageEl = document.getElementById('dmStatusMessage');
    const pushToggleBtn = document.getElementById('dmPushToggleBtn');
    const pushHintEl = document.getElementById('dmPushHint');
    const contextTitleEl = document.getElementById('dmContextTitle');
    const contextSubtitleEl = document.getElementById('dmContextSubtitle');
    const contextPillsEl = document.getElementById('dmContextPills');
    const sideAvatarEl = document.getElementById('dmSideAvatar');
    const sidePeerNameEl = document.getElementById('dmSidePeerName');
    const sideStatusEl = document.getElementById('dmSideStatus');
    const sideHighlightsEl = document.getElementById('dmSideHighlights');

    const PAGE_SIZE = 50;
    const AUTO_SCROLL_THRESHOLD = 80;
    const ROOM_REFRESH_INTERVAL_MS = 15000;
    const HEARTBEAT_INTERVAL_MS = 20000;

    const params = new URLSearchParams(window.location.search);
    const isPreviewMode = params.get('preview') === 'stitch';
    let currentRoomId = params.get('roomId') ? Number(params.get('roomId')) : null;
    let currentUser = window.getStoredCurrentUser ? window.getStoredCurrentUser() : null;
    let rooms = [];
    let socket = null;
    let reconnectAttempts = 0;
    let reconnectTimer = null;
    let roomRefreshTimer = null;
    let heartbeatTimer = null;
    let messageState = new Map();
    let pendingMessages = new Map();
    let isComposing = false;
    let isWindowFocused = document.hasFocus();
    let isPageVisible = document.visibilityState === 'visible';
    let hasMoreMessages = false;
    let oldestMessageId = null;
    let isLoadingOlderMessages = false;
    let lastReadMessageId = 0;
    let pushRegistration = null;
    let webPushStatus = {
        enabled: false,
        subscribed: false,
        activeSubscriptionCount: 0,
        vapidPublicKey: null,
    };

    const previewCurrentUser = {
        userId: 101,
        nickname: 'Ari Kim',
        email: 'ari@buildmate.local',
        profileImage: '',
    };

    const previewRooms = [
        {
            roomId: 2001,
            partner: { nickname: 'Mina', profileImage: '' },
            lastMessage: 'I will tighten the home board card density one more time tonight.',
            lastMessageAt: '2026-03-19T13:12:00.000Z',
            unreadCount: 2,
            projectTitle: 'Buildmate Home Refresh',
            projectStage: 'Hero polish',
            collaborationMode: 'Async-first',
            targetRole: 'Product Designer',
            joinType: 'Core contributor',
            highlights: [
                'Reduce information density while keeping role clarity high.',
                'Preserve existing runtime hooks while matching the Stitch tone.',
                'Make sure filter priority still works well on mobile.',
            ],
        },
        {
            roomId: 2002,
            partner: { nickname: 'Jun', profileImage: '' },
            lastMessage: 'The public question CTA should show in the hero before the right rail.',
            lastMessageAt: '2026-03-18T21:40:00.000Z',
            unreadCount: 0,
            projectTitle: 'Project Detail Direction',
            projectStage: 'Review',
            collaborationMode: 'Twice-weekly sync',
            targetRole: 'Frontend Engineer',
            joinType: 'Part-time core',
            highlights: [
                'Show collaboration checkpoints inside the hero first.',
                'Make the question section read like intent plus next action.',
                'Rebalance priority between the lead card and the quick stats rail.',
            ],
        },
    ];

    const previewMessagesByRoom = {
        2001: [
            {
                messageId: 1,
                roomId: 2001,
                senderNickname: 'Mina',
                senderProfileImage: '',
                content: '홈 히어로는 지금보다 조금 더 침착하고 제품 소개처럼 보이면 좋겠어요.',
                createdAt: '2026-03-19T12:52:00.000Z',
                isMine: false,
                readByOther: true,
            },
            {
                messageId: 2,
                roomId: 2001,
                senderNickname: 'Ari Kim',
                senderProfileImage: '',
                content: '좋아요. 카드 하단 통계는 빼고 역할과 합류 형태만 남기는 쪽으로 조정해볼게요.',
                createdAt: '2026-03-19T12:58:00.000Z',
                isMine: true,
                readByOther: true,
            },
            {
                messageId: 3,
                roomId: 2001,
                senderNickname: 'Mina',
                senderProfileImage: '',
                content: '오늘 밤까지 홈 보드 카드 밀도만 한 번 더 맞춰볼게요.',
                createdAt: '2026-03-19T13:12:00.000Z',
                isMine: false,
                readByOther: false,
            },
        ],
        2002: [
            {
                messageId: 11,
                roomId: 2002,
                senderNickname: 'Jun',
                senderProfileImage: '',
                content: '상세 화면은 CTA가 지금보다 위에 보여야 하겠네요.',
                createdAt: '2026-03-18T21:32:00.000Z',
                isMine: false,
                readByOther: true,
            },
            {
                messageId: 12,
                roomId: 2002,
                senderNickname: 'Ari Kim',
                senderProfileImage: '',
                content: '네, hero 오른쪽에 decision snapshot 카드로 올리면 Stitch 톤에도 더 가깝습니다.',
                createdAt: '2026-03-18T21:40:00.000Z',
                isMine: true,
                readByOther: true,
            },
        ],
    };

    const historyLoaderEl = document.createElement('div');
    historyLoaderEl.className = 'dm-history-loader';
    historyLoaderEl.style.display = 'none';
    historyLoaderEl.textContent = 'Loading earlier collaboration messages...';

    function ensureHistoryLoader() {
        if (!historyLoaderEl.parentElement) {
            messageListEl.appendChild(historyLoaderEl);
        }
    }

    function generateClientMessageId() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }
        return `dm-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    }

    function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let index = 0; index < rawData.length; index += 1) {
            outputArray[index] = rawData.charCodeAt(index);
        }
        return outputArray;
    }

    function setPushHint(message) {
        if (pushHintEl) {
            pushHintEl.textContent = message || '';
        }
    }

    function getRoomMeta(room = null) {
        if (!room) {
            return {
                projectTitle: 'Current collaboration',
                stage: 'Open discussion',
                mode: 'Async-first',
                role: 'Role fit',
                joinType: 'Flexible',
                highlights: [
                    'Confirm role expectations and weekly availability first.',
                    'Summarize what was already resolved in public questions.',
                    'Agree on an exact start point before moving into execution.',
                ],
            };
        }

        return {
            projectTitle: room.projectTitle || room.contextTitle || 'Current collaboration',
            stage: room.projectStage || 'Open discussion',
            mode: room.collaborationMode || 'Async-first',
            role: room.targetRole || 'Role fit',
            joinType: room.joinType || 'Flexible',
            highlights: Array.isArray(room.highlights) && room.highlights.length
                ? room.highlights
                : [
                    'Confirm role expectations and weekly availability first.',
                    'Summarize what was already resolved in public questions.',
                    'Agree on an exact start point before moving into execution.',
                ],
        };
    }

    function renderContextPills(room = null) {
        if (!contextPillsEl) {
            return;
        }
        const meta = getRoomMeta(room);
        const pills = [
            `Stage · ${meta.stage}`,
            `Role · ${meta.role}`,
            `Mode · ${meta.mode}`,
            `Join · ${meta.joinType}`,
        ];

        contextPillsEl.innerHTML = '';
        pills.forEach((pillText) => {
            const pill = document.createElement('span');
            pill.className = 'dm-chat-context-pill';
            pill.textContent = pillText;
            contextPillsEl.appendChild(pill);
        });
    }

    function renderSideHighlights(room = null) {
        if (!sideHighlightsEl) {
            return;
        }
        const meta = getRoomMeta(room);
        sideHighlightsEl.innerHTML = '';
        meta.highlights.forEach((highlight) => {
            const item = document.createElement('li');
            item.textContent = highlight;
            sideHighlightsEl.appendChild(item);
        });
    }

    function syncConversationChrome(room = null) {
        const partnerName = room && room.partner && room.partner.nickname
            ? room.partner.nickname
            : 'Select a collaborator to continue.';
        const meta = getRoomMeta(room);
        const statusText = room && room.lastMessageAt
            ? `Latest activity · ${formatDate(room.lastMessageAt)}`
            : 'Project context and conversation history will appear here.';

        if (contextTitleEl) {
            contextTitleEl.textContent = room ? meta.projectTitle : partnerName;
        }
        if (contextSubtitleEl) {
            contextSubtitleEl.textContent = room
                ? `Align role fit, availability, and collaboration mode with ${partnerName}.`
                : 'Project context and conversation history will appear here.';
        }
        if (sideAvatarEl) {
            sideAvatarEl.style.backgroundImage = room && room.partner && room.partner.profileImage
                ? `url(${room.partner.profileImage})`
                : '';
        }
        if (sidePeerNameEl) {
            sidePeerNameEl.textContent = room ? meta.projectTitle : partnerName;
        }
        if (sideStatusEl) {
            sideStatusEl.textContent = room ? `Talking with ${partnerName} · ${statusText}` : statusText;
        }
        renderContextPills(room);
        renderSideHighlights(room);
    }

    function isWebPushSupported() {
        return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    }

    async function ensurePushRegistration() {
        if (!isWebPushSupported()) {
            throw new Error('This browser does not support web push.');
        }
        if (pushRegistration) {
            return pushRegistration;
        }
        pushRegistration = await navigator.serviceWorker.register('/push-sw.js');
        return pushRegistration;
    }

    async function getBrowserPushSubscription() {
        if (!isWebPushSupported()) {
            return null;
        }
        const registration = await ensurePushRegistration();
        return registration.pushManager.getSubscription();
    }

    async function syncPushToggleState() {
        if (!pushToggleBtn) {
            return;
        }

        if (!isWebPushSupported()) {
            pushToggleBtn.textContent = 'Unsupported';
            pushToggleBtn.disabled = true;
            setPushHint('This browser does not support web push.');
            return;
        }

        if (!webPushStatus.enabled) {
            pushToggleBtn.textContent = 'Alerts Off';
            pushToggleBtn.disabled = true;
            setPushHint('Browser alerts are disabled on the server.');
            return;
        }

        pushToggleBtn.disabled = false;
        let subscription = null;
        try {
            subscription = await getBrowserPushSubscription();
        } catch (error) {
            console.error('push registration init failed', error);
            pushToggleBtn.textContent = 'Unavailable';
            pushToggleBtn.disabled = true;
            setPushHint('We could not initialize browser alerts. Refresh and try again.');
            return;
        }
        const permission = Notification.permission;

        if (permission === 'denied') {
            pushToggleBtn.textContent = 'Blocked';
            setPushHint('Allow browser alerts to receive new collaboration updates.');
            return;
        }

        if (subscription && webPushStatus.subscribed) {
            pushToggleBtn.textContent = 'Turn off alerts';
            setPushHint('You will receive browser alerts for new collaboration updates.');
            return;
        }

        pushToggleBtn.textContent = 'Turn on alerts';
        setPushHint('Enable browser alerts for new collaboration updates.');
    }

    async function fetchWebPushStatus() {
        const response = await fetch(`${API_BASE_URL}/v1/notifications/webpush/status`, { credentials: 'include' });
        const result = await window.parseApiResponseSafe(response);
        if (!response.ok) {
            throw new Error(result.message || 'Failed to load browser alert status.');
        }
        webPushStatus = result.data || webPushStatus;
        await syncPushToggleState();
        return webPushStatus;
    }

    async function subscribeToWebPush() {
        if (!webPushStatus.enabled) {
            showCustomModal('Browser alerts are disabled on the server.');
            return;
        }

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            showCustomModal('Allow browser alerts to receive new collaboration updates.');
            await syncPushToggleState();
            return;
        }

        const registration = await ensurePushRegistration();
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(webPushStatus.vapidPublicKey),
        });

        const response = await fetch(`${API_BASE_URL}/v1/notifications/webpush/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(subscription.toJSON()),
        });
        const result = await window.parseApiResponseSafe(response);
        if (!response.ok) {
            throw new Error(result.message || 'Failed to subscribe to browser alerts.');
        }
        await fetchWebPushStatus();
    }

    async function unsubscribeFromWebPush() {
        const subscription = await getBrowserPushSubscription();
        if (!subscription) {
            webPushStatus.subscribed = false;
            await syncPushToggleState();
            return;
        }

        const response = await fetch(`${API_BASE_URL}/v1/notifications/webpush/subscribe`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        const result = await window.parseApiResponseSafe(response);
        if (!response.ok) {
            throw new Error(result.message || 'Failed to unsubscribe from browser alerts.');
        }

        await subscription.unsubscribe().catch(() => undefined);
        await fetchWebPushStatus();
    }

    async function toggleWebPush() {
        if (!isWebPushSupported()) {
            showCustomModal('This browser does not support web push.');
            return;
        }

        if (Notification.permission === 'denied') {
            showCustomModal('Allow browser alerts to receive new collaboration updates.');
            return;
        }

        pushToggleBtn.disabled = true;
        try {
            await fetchWebPushStatus();
            const subscription = await getBrowserPushSubscription();
            if (subscription && webPushStatus.subscribed) {
                await unsubscribeFromWebPush();
            } else {
                await subscribeToWebPush();
            }
        } catch (error) {
            console.error('push toggle failed', error);
            showCustomModal(error.message || 'Failed to update browser alerts.');
            await syncPushToggleState();
        } finally {
            pushToggleBtn.disabled = false;
        }
    }

    function startHeartbeat() {
        stopHeartbeat();
        heartbeatTimer = window.setInterval(() => {
            if (!socket || socket.readyState !== WebSocket.OPEN) {
                return;
            }
            socket.send(JSON.stringify({ type: 'heartbeat' }));
        }, HEARTBEAT_INTERVAL_MS);
    }

    function stopHeartbeat() {
        if (heartbeatTimer) {
            window.clearInterval(heartbeatTimer);
            heartbeatTimer = null;
        }
    }

    function sortRooms() {
        rooms.sort((a, b) => {
            const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
            const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
            if (aTime !== bTime) {
                return bTime - aTime;
            }
            return Number(b.roomId) - Number(a.roomId);
        });
    }

    function syncUnreadBadge() {
        const totalUnreadCount = rooms.reduce((sum, room) => sum + Number(room.unreadCount || 0), 0);
        if (window.setDmUnreadBadgeCount) {
            window.setDmUnreadBadgeCount(totalUnreadCount);
        }
    }

    function updateRoomSummary(roomId, updater) {
        const room = rooms.find((item) => Number(item.roomId) === Number(roomId));
        if (!room) {
            return;
        }
        updater(room);
        sortRooms();
        renderRooms();
        syncUnreadBadge();
    }

    function formatMessageTime(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
    }

    function formatDate(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        const yy = String(date.getFullYear()).slice(-2);
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yy}.${mm}.${dd}`;
    }

    function isNearBottom() {
        const remaining = messageListEl.scrollHeight - (messageListEl.scrollTop + messageListEl.clientHeight);
        return remaining <= AUTO_SCROLL_THRESHOLD;
    }

    function closeSocket(intentional = true) {
        stopHeartbeat();
        if (reconnectTimer) {
            window.clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        if (socket) {
            socket.__intentionalClose = intentional;
            socket.close();
            socket = null;
        }
    }

    async function fetchCurrentUser() {
        const response = await fetch(`${API_BASE_URL}/v1/auth/me`, { credentials: 'include' });
        const result = await window.parseApiResponseSafe(response);
        if (!response.ok) {
            showCustomModal('You need to sign in first.', () => {
                window.location.href = 'login.html';
            });
            throw new Error(result.message || 'login required');
        }
        currentUser = result.data || result;
        localStorage.setItem('user', JSON.stringify(currentUser));
        localStorage.setItem('userId', currentUser.userId);
        localStorage.setItem('nickname', currentUser.nickname || '');
        localStorage.setItem('email', currentUser.email || '');
        localStorage.setItem('profileImage', currentUser.profileImage || '');
        if (currentUser.profileImage) {
            profileIcon.style.backgroundImage = `url(${currentUser.profileImage})`;
        }
    }

    async function fetchRooms(options = {}) {
        const preserveSelection = options.preserveSelection !== false;
        const response = await fetch(`${API_BASE_URL}/v1/dm/rooms`, { credentials: 'include' });
        const result = await window.parseApiResponseSafe(response);
        if (!response.ok) {
            throw new Error(result.message || 'Failed to load collaboration rooms.');
        }
        const data = result.data || {};
        rooms = Array.isArray(data.rooms) ? data.rooms : [];
        sortRooms();
        renderRooms();
        syncUnreadBadge();

        if (!currentRoomId && rooms.length > 0) {
            currentRoomId = rooms[0].roomId;
        }

        if (!preserveSelection && currentRoomId) {
            await selectRoom(currentRoomId, false);
            return;
        }

        if (currentRoomId) {
            const activeRoom = rooms.find((room) => Number(room.roomId) === Number(currentRoomId));
            if (activeRoom) {
                peerNameEl.textContent = activeRoom.partner && activeRoom.partner.nickname ? activeRoom.partner.nickname : 'Unknown collaborator';
                peerAvatarEl.style.backgroundImage = activeRoom.partner && activeRoom.partner.profileImage ? `url(${activeRoom.partner.profileImage})` : '';
                statusMessageEl.textContent = activeRoom.lastMessageAt ? `Latest activity · ${formatDate(activeRoom.lastMessageAt)}` : 'No collaboration messages yet.';
                syncConversationChrome(activeRoom);
                renderRooms();
            } else {
                renderEmptyRoom();
            }
        } else {
            renderEmptyRoom();
        }
    }

    function renderRooms() {
        roomListEl.innerHTML = '';
        if (!rooms.length) {
            const empty = document.createElement('div');
            empty.className = 'dm-room-last';
            empty.textContent = 'There are no active collaboration rooms yet.';
            roomListEl.appendChild(empty);
            return;
        }

        rooms.forEach((room) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'dm-room-item';
            if (Number(room.roomId) === Number(currentRoomId)) {
                item.classList.add('active');
            }

            const top = document.createElement('div');
            top.className = 'dm-room-top';

            const topLeft = document.createElement('div');
            topLeft.className = 'dm-room-top-left';

            const topRight = document.createElement('div');
            topRight.className = 'dm-room-top-right';

            const avatar = document.createElement('div');
            avatar.className = 'dm-room-avatar';
            if (room.partner && room.partner.profileImage) {
                avatar.style.backgroundImage = `url(${room.partner.profileImage})`;
            }

            const meta = document.createElement('div');
            const eyebrow = document.createElement('div');
            eyebrow.className = 'dm-room-eyebrow';
            eyebrow.textContent = room.projectTitle || room.contextTitle || 'Current collaboration';
            const name = document.createElement('div');
            name.className = 'dm-room-name';
            name.textContent = room.partner && room.partner.nickname ? room.partner.nickname : 'Unknown collaborator';
            const time = document.createElement('div');
            time.className = 'dm-room-time';
            time.textContent = formatDate(room.lastMessageAt || '');
            meta.append(eyebrow, name);
            topLeft.append(avatar, meta);
            topRight.append(time);

            if (Number(room.unreadCount || 0) > 0) {
                const unreadBadge = document.createElement('span');
                unreadBadge.className = 'dm-room-unread-badge';
                unreadBadge.textContent = Number(room.unreadCount) > 99 ? '99+' : String(room.unreadCount);
                topRight.append(unreadBadge);
            }

            top.append(topLeft, topRight);

            const last = document.createElement('div');
            last.className = 'dm-room-last';
            last.textContent = room.lastMessage || 'No collaboration messages yet.';

            item.append(top, last);
            item.addEventListener('click', async () => {
                await selectRoom(room.roomId, true);
            });
            roomListEl.appendChild(item);
        });
    }

    function renderEmptyRoom() {
        closeSocket();
        emptyStateEl.style.display = 'block';
        emptyStateEl.textContent = rooms.length ? 'Select a collaborator to continue.' : 'There are no active collaboration rooms yet.';
        messageState = new Map();
        hasMoreMessages = false;
        oldestMessageId = null;
        lastReadMessageId = 0;
        messageListEl.innerHTML = '';
        ensureHistoryLoader();
        peerAvatarEl.style.backgroundImage = '';
        peerNameEl.textContent = 'Select a collaborator to continue.';
        statusMessageEl.textContent = 'Real-time collaboration updates appear here.';
        syncConversationChrome(null);
        sendBtn.disabled = true;
    }

    function clearMessages() {
        messageListEl.innerHTML = '';
        ensureHistoryLoader();
    }

    function createMessageRow(message, options = {}) {
        const row = document.createElement('div');
        row.className = `dm-message-row${message.isMine ? ' mine' : ''}`;
        row.dataset.messageId = options.pending ? `pending:${message.clientMessageId}` : String(message.messageId);
        if (options.pending) {
            row.dataset.clientMessageId = message.clientMessageId;
            row.classList.add('pending');
        }

        const avatar = document.createElement('div');
        avatar.className = 'dm-bubble-avatar';
        if (message.senderProfileImage) {
            avatar.style.backgroundImage = `url(${message.senderProfileImage})`;
        }

        const body = document.createElement('div');
        body.className = 'dm-message-body';

        const name = document.createElement('div');
        name.className = 'dm-bubble-name';
        name.textContent = message.isMine ? 'You' : (message.senderNickname || 'Anonymous');

        const bubble = document.createElement('div');
        bubble.className = 'dm-bubble';
        bubble.textContent = message.content || '';

        const meta = document.createElement('div');
        meta.className = 'dm-bubble-meta';

        const time = document.createElement('div');
        time.className = 'dm-bubble-time';
        time.textContent = formatMessageTime(message.createdAt);
        meta.append(time);

        if (message.isMine) {
            const read = document.createElement('span');
            read.className = 'dm-bubble-read';
            if (options.pending) {
                read.textContent = 'Sending';
            } else {
                read.textContent = message.readByOther ? 'Read' : '';
            }
            meta.append(read);
        }

        body.append(name, bubble, meta);
        row.append(avatar, body);
        return row;
    }

    function getMessageInsertAnchor() {
        return historyLoaderEl.nextSibling;
    }

    function appendPendingMessage(pendingMessage) {
        const existing = messageListEl.querySelector(`.dm-message-row[data-client-message-id="${pendingMessage.clientMessageId}"]`);
        if (existing) {
            existing.remove();
        }
        const row = createMessageRow(pendingMessage, { pending: true });
        messageListEl.appendChild(row);
    }

    function queuePendingMessage(content) {
        const clientMessageId = generateClientMessageId();
        const pendingMessage = {
            clientMessageId,
            roomId: currentRoomId,
            senderNickname: currentUser && currentUser.nickname ? currentUser.nickname : 'You',
            senderProfileImage: currentUser && currentUser.profileImage ? currentUser.profileImage : '',
            content,
            createdAt: new Date().toISOString(),
            isMine: true,
            readByOther: false,
        };
        pendingMessages.set(clientMessageId, pendingMessage);
        appendPendingMessage(pendingMessage);
        updateRoomSummary(currentRoomId, (room) => {
            room.lastMessage = content;
            room.lastMessageAt = pendingMessage.createdAt;
            room.unreadCount = 0;
        });
        scrollToBottom();
        return pendingMessage;
    }

    function flushPendingMessage(pendingMessage) {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            return false;
        }
        socket.send(JSON.stringify({
            type: 'send_message',
            content: pendingMessage.content,
            clientMessageId: pendingMessage.clientMessageId,
        }));
        return true;
    }

    function appendMessage(message) {
        const normalizedMessage = {
            ...message,
            messageId: Number(message.messageId),
            readByOther: Boolean(message.readByOther),
        };
        messageState.set(normalizedMessage.messageId, normalizedMessage);

        const existing = messageListEl.querySelector(`.dm-message-row[data-message-id="${normalizedMessage.messageId}"]`);
        if (existing) {
            existing.remove();
        }

        const pending = normalizedMessage.clientMessageId
            ? messageListEl.querySelector(`.dm-message-row[data-client-message-id="${normalizedMessage.clientMessageId}"]`)
            : null;
        if (pending) {
            pending.remove();
            pendingMessages.delete(normalizedMessage.clientMessageId);
        }

        const row = createMessageRow(normalizedMessage);
        messageListEl.appendChild(row);
    }

    function prependMessages(messages) {
        if (!messages.length) {
            return;
        }
        const fragment = document.createDocumentFragment();
        messages.forEach((message) => {
            const normalizedMessage = {
                ...message,
                messageId: Number(message.messageId),
                readByOther: Boolean(message.readByOther),
            };
            if (messageState.has(normalizedMessage.messageId)) {
                return;
            }
            messageState.set(normalizedMessage.messageId, normalizedMessage);
            fragment.appendChild(createMessageRow(normalizedMessage));
        });
        messageListEl.insertBefore(fragment, getMessageInsertAnchor());
    }

    function renderMessages(messages) {
        clearMessages();
        messageState = new Map();
        emptyStateEl.textContent = 'There are no collaboration messages yet.';
        emptyStateEl.style.display = messages.length ? 'none' : 'block';
        messages.forEach((message) => appendMessage(message));
        reconcilePendingMessagesForCurrentRoom(messages);
        scrollToBottom();
    }

    function scrollToBottom() {
        messageListEl.scrollTop = messageListEl.scrollHeight;
    }

    function getLatestActualMessageId() {
        let latest = 0;
        messageState.forEach((message) => {
            latest = Math.max(latest, Number(message.messageId || 0));
        });
        return latest;
    }

    function canMarkReadNow() {
        return Boolean(
            currentRoomId &&
            socket &&
            socket.readyState === WebSocket.OPEN &&
            isWindowFocused &&
            isPageVisible &&
            isNearBottom()
        );
    }

    function applyReadReceipt(lastReadId, readerUserId) {
        if (!lastReadId) {
            return;
        }

        const normalizedReaderId = String(readerUserId || '');
        const isCurrentUserReader = currentUser && String(currentUser.userId) === normalizedReaderId;
        if (isCurrentUserReader) {
            lastReadMessageId = Math.max(lastReadMessageId, Number(lastReadId));
            updateRoomSummary(currentRoomId, (room) => {
                room.unreadCount = 0;
            });
            return;
        }

        messageState.forEach((message, messageId) => {
            if (!message.isMine || Number(messageId) > Number(lastReadId)) {
                return;
            }
            message.readByOther = true;
            const receipt = messageListEl.querySelector(`.dm-message-row[data-message-id="${messageId}"] .dm-bubble-read`);
            if (receipt) {
                receipt.textContent = 'Read';
            }
        });
    }

    function updateStatusMessage(text) {
        statusMessageEl.textContent = text;
        if (sideStatusEl) {
            sideStatusEl.textContent = text;
        }
    }

    function markCurrentRoomRead(lastReadId) {
        const targetMessageId = Number(lastReadId || getLatestActualMessageId() || 0);
        if (!targetMessageId || targetMessageId <= lastReadMessageId) {
            return;
        }
        if (!canMarkReadNow()) {
            return;
        }
        socket.send(JSON.stringify({
            type: 'mark_read',
            lastReadMessageId: targetMessageId,
        }));
        lastReadMessageId = targetMessageId;
        updateRoomSummary(currentRoomId, (room) => {
            room.unreadCount = 0;
        });
    }

    function maybeMarkCurrentRoomAsRead(lastReadId) {
        if (!currentRoomId || !socket || socket.readyState !== WebSocket.OPEN) {
            return;
        }
        if (!canMarkReadNow()) {
            return;
        }
        markCurrentRoomRead(lastReadId);
    }

    async function fetchMessages(roomId, options = {}) {
        const reset = options.reset !== false;
        const beforeMessageId = options.beforeMessageId || null;
        const query = new URLSearchParams({ limit: String(PAGE_SIZE) });
        if (beforeMessageId) {
            query.set('beforeMessageId', String(beforeMessageId));
        }

        const response = await fetch(`${API_BASE_URL}/v1/dm/rooms/${roomId}/messages?${query.toString()}`, { credentials: 'include' });
        const result = await window.parseApiResponseSafe(response);
        if (!response.ok) {
            throw new Error(result.message || 'Failed to load collaboration messages.');
        }
        const data = result.data || {};
        const messages = Array.isArray(data.messages) ? data.messages : [];
        hasMoreMessages = Boolean(data.hasMore);
        oldestMessageId = data.oldestMessageId ? Number(data.oldestMessageId) : null;

        if (reset) {
            lastReadMessageId = 0;
            renderMessages(messages);
            return;
        }

        const previousScrollHeight = messageListEl.scrollHeight;
        const previousScrollTop = messageListEl.scrollTop;
        prependMessages(messages);
        const newScrollHeight = messageListEl.scrollHeight;
        messageListEl.scrollTop = previousScrollTop + (newScrollHeight - previousScrollHeight);
    }

    function reconcilePendingMessagesForCurrentRoom(serverMessages) {
        const serverMessageIds = new Set((serverMessages || []).map((message) => message.clientMessageId).filter(Boolean));
        [...pendingMessages.values()].forEach((pendingMessage) => {
            if (Number(pendingMessage.roomId) !== Number(currentRoomId)) {
                return;
            }
            if (serverMessageIds.has(pendingMessage.clientMessageId)) {
                pendingMessages.delete(pendingMessage.clientMessageId);
                return;
            }
            appendPendingMessage(pendingMessage);
        });
    }

    async function loadOlderMessages() {
        if (!currentRoomId || !hasMoreMessages || !oldestMessageId || isLoadingOlderMessages) {
            return;
        }
        isLoadingOlderMessages = true;
        historyLoaderEl.style.display = 'block';
        try {
            await fetchMessages(currentRoomId, { reset: false, beforeMessageId: oldestMessageId });
        } catch (error) {
            console.error('older message load failed', error);
        } finally {
            isLoadingOlderMessages = false;
            historyLoaderEl.style.display = 'none';
        }
    }

    async function selectRoom(roomId, pushHistory) {
        currentRoomId = Number(roomId);
        renderRooms();
        const room = rooms.find((item) => Number(item.roomId) === currentRoomId);
        if (!room) {
            renderEmptyRoom();
            return;
        }

        if (pushHistory) {
            const nextUrl = new URL(window.location.href);
            nextUrl.searchParams.set('roomId', String(currentRoomId));
            window.history.replaceState({}, '', nextUrl.toString());
        }

        peerNameEl.textContent = room.partner && room.partner.nickname ? room.partner.nickname : 'Unknown collaborator';
        updateStatusMessage(room.lastMessageAt ? `Latest activity · ${formatDate(room.lastMessageAt)}` : 'No collaboration messages yet.');
        peerAvatarEl.style.backgroundImage = room.partner && room.partner.profileImage ? `url(${room.partner.profileImage})` : '';
        syncConversationChrome(room);
        sendBtn.disabled = false;

        if (isPreviewMode) {
            const previewMessages = (previewMessagesByRoom[currentRoomId] || []).map((message) => ({ ...message }));
            renderMessages(previewMessages);
            updateRoomSummary(currentRoomId, (targetRoom) => {
                targetRoom.unreadCount = 0;
            });
            return;
        }

        await fetchMessages(currentRoomId, { reset: true });
        connectSocket();
    }

    function resendPendingMessagesForCurrentRoom() {
        if (!socket || socket.readyState !== WebSocket.OPEN || !currentRoomId) {
            return;
        }
        [...pendingMessages.values()]
            .filter((message) => Number(message.roomId) === Number(currentRoomId))
            .forEach((pendingMessage) => {
                socket.send(JSON.stringify({
                    type: 'send_message',
                    content: pendingMessage.content,
                    clientMessageId: pendingMessage.clientMessageId,
                }));
            });
    }

    function connectSocket() {
        closeSocket();
        if (!currentRoomId) return;

        const roomIdAtConnect = currentRoomId;
        const apiUrl = API_BASE_URL ? new URL(API_BASE_URL, window.location.origin) : new URL(window.location.origin);
        const wsProtocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${apiUrl.host}/ws/dm/${roomIdAtConnect}`;
        updateStatusMessage('Connecting in real time...');
        const nextSocket = new WebSocket(wsUrl);
        socket = nextSocket;

        nextSocket.addEventListener('open', () => {
            if (socket !== nextSocket) return;
            reconnectAttempts = 0;
            updateStatusMessage('Real-time collaboration is connected.');
            startHeartbeat();
            resendPendingMessagesForCurrentRoom();
            maybeMarkCurrentRoomAsRead();
        });

        nextSocket.addEventListener('message', (event) => {
            if (socket !== nextSocket) return;
            try {
                const payload = JSON.parse(event.data);
                if (payload.type === 'message_created' && payload.data) {
                    const shouldStickToBottom = payload.data.isMine || isNearBottom();
                    appendMessage(payload.data);
                    emptyStateEl.style.display = 'none';
                    if (shouldStickToBottom) {
                        scrollToBottom();
                    }
                    updateRoomSummary(roomIdAtConnect, (room) => {
                        room.lastMessage = payload.data.content;
                        room.lastMessageAt = payload.data.createdAt;
                        if (payload.data.isMine) {
                            room.unreadCount = 0;
                        } else if (canMarkReadNow()) {
                            room.unreadCount = 0;
                        } else {
                            room.unreadCount = Number(room.unreadCount || 0) + 1;
                        }
                    });
                    if (!payload.data.isMine) {
                        maybeMarkCurrentRoomAsRead(payload.data.messageId);
                    }
                } else if (payload.type === 'messages_read' && payload.data) {
                    applyReadReceipt(payload.data.lastReadMessageId, payload.data.readerUserId);
                } else if (payload.type === 'error') {
                    showCustomModal(payload.message || 'Failed to connect the collaboration chat.');
                }
            } catch (error) {
                console.error('ws message parse error', error);
            }
        });

        nextSocket.addEventListener('close', () => {
            if (socket === nextSocket) {
                socket = null;
            }
            stopHeartbeat();

            if (nextSocket.__intentionalClose || currentRoomId !== roomIdAtConnect) {
                return;
            }

            if (reconnectAttempts < 2 && currentRoomId) {
                reconnectAttempts += 1;
                updateStatusMessage('Retrying the real-time connection...');
                reconnectTimer = window.setTimeout(() => {
                    reconnectTimer = null;
                    if (!socket && currentRoomId === roomIdAtConnect) {
                        connectSocket();
                    }
                }, 1000 * reconnectAttempts);
                return;
            }
            updateStatusMessage('The real-time connection was lost.');
        });
    }

    async function sendMessage(event) {
        event.preventDefault();
        if (isComposing) {
            return;
        }

        const rawContent = inputEl.value.replace(/\r\n/g, '\n');
        if (!rawContent.trim() || !currentRoomId) {
            return;
        }

        if (isPreviewMode) {
            const previewMessage = {
                messageId: Date.now(),
                roomId: currentRoomId,
                senderNickname: currentUser && currentUser.nickname ? currentUser.nickname : 'You',
                senderProfileImage: currentUser && currentUser.profileImage ? currentUser.profileImage : '',
                content: rawContent,
                createdAt: new Date().toISOString(),
                isMine: true,
                readByOther: false,
            };
            previewMessagesByRoom[currentRoomId] = [...(previewMessagesByRoom[currentRoomId] || []), previewMessage];
            appendMessage(previewMessage);
            emptyStateEl.style.display = 'none';
            inputEl.value = '';
            updateRoomSummary(currentRoomId, (room) => {
                room.lastMessage = rawContent;
                room.lastMessageAt = previewMessage.createdAt;
                room.unreadCount = 0;
            });
            scrollToBottom();
            return;
        }

        const pendingMessage = queuePendingMessage(rawContent);
        inputEl.value = '';

        if (socket && socket.readyState === WebSocket.OPEN) {
            flushPendingMessage(pendingMessage);
            return;
        }

        updateStatusMessage('Connecting in real time... waiting to send your message.');
        if (!socket || socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) {
            connectSocket();
        }
    }

    function handleComposerKeydown(event) {
        if (event.isComposing || isComposing || event.keyCode === 229) {
            return;
        }

        if (event.key !== 'Enter' || event.shiftKey) {
            return;
        }

        event.preventDefault();
        composerEl.requestSubmit();
    }

    async function refreshRoomsSilently() {
        if (isPreviewMode) {
            return;
        }
        try {
            await fetchRooms({ preserveSelection: true });
            if (currentRoomId) {
                maybeMarkCurrentRoomAsRead();
            }
        } catch (error) {
            console.error('room refresh failed', error);
        }
    }

    function startRoomRefreshPolling() {
        if (isPreviewMode) {
            return;
        }
        if (roomRefreshTimer) {
            window.clearInterval(roomRefreshTimer);
        }
        roomRefreshTimer = window.setInterval(refreshRoomsSilently, ROOM_REFRESH_INTERVAL_MS);
    }

    async function logout() {
        await fetch(`${API_BASE_URL}/v1/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        localStorage.removeItem('user');
        localStorage.removeItem('userId');
        localStorage.removeItem('nickname');
        localStorage.removeItem('email');
        localStorage.removeItem('profileImage');
        window.location.href = 'login.html';
    }

    if (profileIcon) {
        profileIcon.addEventListener('click', (event) => {
            event.stopPropagation();
            profileDropdown.classList.toggle('show');
        });
    }

    document.addEventListener('click', (event) => {
        if (profileDropdown && !profileDropdown.contains(event.target) && event.target !== profileIcon) {
            profileDropdown.classList.remove('show');
        }
    });

    logoutBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        await logout();
    });
    if (pushToggleBtn) {
        pushToggleBtn.addEventListener('click', async () => {
            await toggleWebPush();
        });
    }
    composerEl.addEventListener('submit', sendMessage);
    inputEl.addEventListener('keydown', handleComposerKeydown);
    inputEl.addEventListener('compositionstart', () => {
        isComposing = true;
    });
    inputEl.addEventListener('compositionend', () => {
        isComposing = false;
    });
    messageListEl.addEventListener('scroll', () => {
        if (messageListEl.scrollTop <= 60) {
            loadOlderMessages();
        }
        maybeMarkCurrentRoomAsRead();
    });
    window.addEventListener('focus', () => {
        isWindowFocused = true;
        refreshRoomsSilently();
        maybeMarkCurrentRoomAsRead();
    });
    window.addEventListener('blur', () => {
        isWindowFocused = false;
    });
    document.addEventListener('visibilitychange', () => {
        isPageVisible = document.visibilityState === 'visible';
        if (isPageVisible) {
            refreshRoomsSilently();
            maybeMarkCurrentRoomAsRead();
        }
    });
    window.addEventListener('beforeunload', () => {
        closeSocket();
    });

    (async () => {
        try {
            ensureHistoryLoader();
            if (isPreviewMode) {
                currentUser = previewCurrentUser;
                rooms = previewRooms.map((room) => ({ ...room, partner: { ...room.partner } }));
                sortRooms();
                if (!currentRoomId && rooms.length > 0) {
                    currentRoomId = rooms[0].roomId;
                }
                if (profileIcon) {
                    profileIcon.textContent = 'A';
                }
                if (pushToggleBtn) {
                    pushToggleBtn.textContent = 'Preview';
                    pushToggleBtn.disabled = true;
                }
                setPushHint('Real-time updates and browser alerts are disabled in preview mode.');
                renderRooms();
                syncUnreadBadge();
                if (currentRoomId) {
                    await selectRoom(currentRoomId, false);
                } else {
                    renderEmptyRoom();
                }
                return;
            }
            await fetchCurrentUser();
            await fetchWebPushStatus();
            await fetchRooms({ preserveSelection: false });
            startRoomRefreshPolling();
        } catch (error) {
            console.error('dm init failed', error);
        }
    })();
});
