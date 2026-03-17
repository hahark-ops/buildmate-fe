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

    const PAGE_SIZE = 50;
    const AUTO_SCROLL_THRESHOLD = 80;
    const ROOM_REFRESH_INTERVAL_MS = 15000;
    const HEARTBEAT_INTERVAL_MS = 20000;

    const params = new URLSearchParams(window.location.search);
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

    const historyLoaderEl = document.createElement('div');
    historyLoaderEl.className = 'dm-history-loader';
    historyLoaderEl.style.display = 'none';
    historyLoaderEl.textContent = '이전 협업 메시지를 불러오는 중...';

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

    function isWebPushSupported() {
        return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    }

    async function ensurePushRegistration() {
        if (!isWebPushSupported()) {
            throw new Error('이 브라우저는 웹푸시를 지원하지 않습니다.');
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
            pushToggleBtn.textContent = '알림 미지원';
            pushToggleBtn.disabled = true;
            setPushHint('이 브라우저는 웹푸시를 지원하지 않습니다.');
            return;
        }

        if (!webPushStatus.enabled) {
            pushToggleBtn.textContent = '알림 비활성';
            pushToggleBtn.disabled = true;
            setPushHint('서버에서 브라우저 알림이 비활성화되어 있습니다.');
            return;
        }

        pushToggleBtn.disabled = false;
        let subscription = null;
        try {
            subscription = await getBrowserPushSubscription();
        } catch (error) {
            console.error('push registration init failed', error);
            pushToggleBtn.textContent = '알림 사용 불가';
            pushToggleBtn.disabled = true;
            setPushHint('브라우저 알림 초기화에 실패했습니다. 새로고침 후 다시 시도해주세요.');
            return;
        }
        const permission = Notification.permission;

        if (permission === 'denied') {
            pushToggleBtn.textContent = '알림 차단됨';
            setPushHint('브라우저 설정에서 알림을 허용해야 프로젝트 관련 새 메시지를 받을 수 있습니다.');
            return;
        }

        if (subscription && webPushStatus.subscribed) {
            pushToggleBtn.textContent = '알림 끄기';
            setPushHint('프로젝트 관련 새 메시지를 브라우저 알림으로 받을 수 있습니다.');
            return;
        }

        pushToggleBtn.textContent = '알림 켜기';
        setPushHint('프로젝트 관련 새 메시지를 브라우저 알림으로 받을 수 있습니다.');
    }

    async function fetchWebPushStatus() {
        const response = await fetch(`${API_BASE_URL}/v1/notifications/webpush/status`, { credentials: 'include' });
        const result = await window.parseApiResponseSafe(response);
        if (!response.ok) {
            throw new Error(result.message || '웹푸시 상태를 불러오지 못했습니다.');
        }
        webPushStatus = result.data || webPushStatus;
        await syncPushToggleState();
        return webPushStatus;
    }

    async function subscribeToWebPush() {
        if (!webPushStatus.enabled) {
            showCustomModal('서버에서 브라우저 알림이 비활성화되어 있습니다.');
            return;
        }

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            showCustomModal('브라우저 설정에서 알림을 허용해야 프로젝트 관련 새 메시지를 받을 수 있습니다.');
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
            throw new Error(result.message || '웹푸시 구독 등록에 실패했습니다.');
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
            throw new Error(result.message || '웹푸시 구독 해제에 실패했습니다.');
        }

        await subscription.unsubscribe().catch(() => undefined);
        await fetchWebPushStatus();
    }

    async function toggleWebPush() {
        if (!isWebPushSupported()) {
            showCustomModal('이 브라우저는 웹푸시를 지원하지 않습니다.');
            return;
        }

        if (Notification.permission === 'denied') {
            showCustomModal('브라우저 설정에서 알림을 허용해야 프로젝트 관련 새 메시지를 받을 수 있습니다.');
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
            showCustomModal(error.message || '브라우저 알림 설정에 실패했습니다.');
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
            showCustomModal('로그인이 필요합니다.', () => {
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
            throw new Error(result.message || '협업 채팅방 목록을 불러오지 못했습니다.');
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
                peerNameEl.textContent = activeRoom.partner && activeRoom.partner.nickname ? activeRoom.partner.nickname : '알 수 없는 사용자';
                peerAvatarEl.style.backgroundImage = activeRoom.partner && activeRoom.partner.profileImage ? `url(${activeRoom.partner.profileImage})` : '';
                statusMessageEl.textContent = activeRoom.lastMessageAt ? `${formatDate(activeRoom.lastMessageAt)} 기준 최근 활동` : '아직 협업 메시지가 없습니다.';
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
            empty.textContent = '아직 참여 중인 협업 채팅방이 없습니다.';
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
            const name = document.createElement('div');
            name.className = 'dm-room-name';
            name.textContent = room.partner && room.partner.nickname ? room.partner.nickname : '알 수 없는 사용자';
            const time = document.createElement('div');
            time.className = 'dm-room-time';
            time.textContent = formatDate(room.lastMessageAt || '');
            meta.append(name);
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
            last.textContent = room.lastMessage || '아직 협업 메시지가 없습니다.';

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
        emptyStateEl.textContent = rooms.length ? '협업할 메이트를 선택해주세요.' : '아직 참여 중인 협업 채팅방이 없습니다.';
        messageState = new Map();
        hasMoreMessages = false;
        oldestMessageId = null;
        lastReadMessageId = 0;
        messageListEl.innerHTML = '';
        ensureHistoryLoader();
        peerAvatarEl.style.backgroundImage = '';
        peerNameEl.textContent = '협업할 메이트를 선택해주세요.';
        statusMessageEl.textContent = '프로젝트 논의를 위한 실시간 협업 채팅을 지원합니다.';
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
        name.textContent = message.isMine ? '나' : (message.senderNickname || '익명');

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
                read.textContent = '전송 중';
            } else {
                read.textContent = message.readByOther ? '읽음' : '';
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
            senderNickname: currentUser && currentUser.nickname ? currentUser.nickname : '나',
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
        emptyStateEl.textContent = '아직 협업 메시지가 없습니다.';
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
                receipt.textContent = '읽음';
            }
        });
    }

    function updateStatusMessage(text) {
        statusMessageEl.textContent = text;
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
            throw new Error(result.message || '협업 메시지를 불러오지 못했습니다.');
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

        peerNameEl.textContent = room.partner && room.partner.nickname ? room.partner.nickname : '알 수 없는 사용자';
        updateStatusMessage(room.lastMessageAt ? `${formatDate(room.lastMessageAt)} 기준 최근 활동` : '아직 협업 메시지가 없습니다.');
        peerAvatarEl.style.backgroundImage = room.partner && room.partner.profileImage ? `url(${room.partner.profileImage})` : '';
        sendBtn.disabled = false;

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
        updateStatusMessage('실시간 연결 중...');
        const nextSocket = new WebSocket(wsUrl);
        socket = nextSocket;

        nextSocket.addEventListener('open', () => {
            if (socket !== nextSocket) return;
            reconnectAttempts = 0;
            updateStatusMessage('실시간 협업 채팅이 연결되었습니다.');
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
                    showCustomModal(payload.message || '협업 채팅 연결에 실패했습니다.');
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
                updateStatusMessage('실시간 연결을 다시 시도하고 있습니다.');
                reconnectTimer = window.setTimeout(() => {
                    reconnectTimer = null;
                    if (!socket && currentRoomId === roomIdAtConnect) {
                        connectSocket();
                    }
                }, 1000 * reconnectAttempts);
                return;
            }
            updateStatusMessage('실시간 연결이 끊어졌습니다.');
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

        const pendingMessage = queuePendingMessage(rawContent);
        inputEl.value = '';

        if (socket && socket.readyState === WebSocket.OPEN) {
            flushPendingMessage(pendingMessage);
            return;
        }

        updateStatusMessage('실시간 연결 중... 메시지 전송을 대기하고 있습니다.');
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
            await fetchCurrentUser();
            await fetchWebPushStatus();
            await fetchRooms({ preserveSelection: false });
            startRoomRefreshPolling();
        } catch (error) {
            console.error('dm init failed', error);
        }
    })();
});
