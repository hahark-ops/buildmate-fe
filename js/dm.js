
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

    const params = new URLSearchParams(window.location.search);
    let currentRoomId = params.get('roomId') ? Number(params.get('roomId')) : null;
    let currentUser = window.getStoredCurrentUser ? window.getStoredCurrentUser() : null;
    let rooms = [];
    let socket = null;
    let reconnectAttempts = 0;

    function formatMessageTime(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        return `${hh}:${mm}`;
    }

    function closeSocket() {
        if (socket) {
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

    async function fetchRooms() {
        const response = await fetch(`${API_BASE_URL}/v1/dm/rooms`, { credentials: 'include' });
        const result = await window.parseApiResponseSafe(response);
        if (!response.ok) {
            throw new Error(result.message || '채팅방 목록을 불러오지 못했습니다.');
        }
        rooms = result.data && Array.isArray(result.data.rooms) ? result.data.rooms : [];
        renderRooms();

        if (!currentRoomId && rooms.length > 0) {
            currentRoomId = rooms[0].roomId;
        }

        if (currentRoomId) {
            await selectRoom(currentRoomId, false);
        } else {
            renderEmptyRoom();
        }
    }

    function renderRooms() {
        roomListEl.innerHTML = '';
        if (!rooms.length) {
            const empty = document.createElement('div');
            empty.className = 'dm-room-last';
            empty.textContent = '대화방이 없습니다.';
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
            meta.append(name, time);
            top.append(avatar, meta);

            const last = document.createElement('div');
            last.className = 'dm-room-last';
            last.textContent = room.lastMessage || '아직 메시지가 없습니다.';

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
        messageListEl.innerHTML = '';
        peerAvatarEl.style.backgroundImage = '';
        peerNameEl.textContent = '대화 상대를 선택해주세요.';
        statusMessageEl.textContent = '실시간 1:1 대화를 지원합니다.';
        sendBtn.disabled = true;
    }

    function renderMessages(messages) {
        messageListEl.innerHTML = '';
        emptyStateEl.style.display = messages.length ? 'none' : 'block';
        messages.forEach((message) => appendMessage(message));
        scrollToBottom();
    }

    function appendMessage(message) {
        const row = document.createElement('div');
        row.className = `dm-message-row${message.isMine ? ' mine' : ''}`;

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

        const time = document.createElement('div');
        time.className = 'dm-bubble-time';
        time.textContent = formatMessageTime(message.createdAt);

        body.append(name, bubble, time);
        row.append(avatar, body);
        messageListEl.appendChild(row);
    }

    function scrollToBottom() {
        messageListEl.scrollTop = messageListEl.scrollHeight;
    }

    async function fetchMessages(roomId) {
        const response = await fetch(`${API_BASE_URL}/v1/dm/rooms/${roomId}/messages?limit=50`, { credentials: 'include' });
        const result = await window.parseApiResponseSafe(response);
        if (!response.ok) {
            throw new Error(result.message || '메시지를 불러오지 못했습니다.');
        }
        const data = result.data || {};
        renderMessages(Array.isArray(data.messages) ? data.messages : []);
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
        statusMessageEl.textContent = room.lastMessageAt ? `${formatDate(room.lastMessageAt)} 기준 최근 활동` : '메시지를 시작해보세요.';
        peerAvatarEl.style.backgroundImage = room.partner && room.partner.profileImage ? `url(${room.partner.profileImage})` : '';
        sendBtn.disabled = false;

        await fetchMessages(currentRoomId);
        connectSocket();
    }

    function connectSocket() {
        closeSocket();
        if (!currentRoomId) return;
        const apiUrl = API_BASE_URL ? new URL(API_BASE_URL, window.location.origin) : new URL(window.location.origin);
        const wsProtocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${apiUrl.host}/ws/dm/${currentRoomId}`;
        socket = new WebSocket(wsUrl);

        socket.addEventListener('open', () => {
            reconnectAttempts = 0;
            statusMessageEl.textContent = '실시간 연결됨';
        });

        socket.addEventListener('message', (event) => {
            try {
                const payload = JSON.parse(event.data);
                if (payload.type === 'message_created' && payload.data) {
                    appendMessage(payload.data);
                    emptyStateEl.style.display = 'none';
                    scrollToBottom();
                    const room = rooms.find((item) => Number(item.roomId) === currentRoomId);
                    if (room) {
                        room.lastMessage = payload.data.content;
                        room.lastMessageAt = payload.data.createdAt;
                        renderRooms();
                    }
                } else if (payload.type === 'error') {
                    showCustomModal(payload.message || '채팅 연결에 실패했습니다.');
                }
            } catch (error) {
                console.error('ws message parse error', error);
            }
        });

        socket.addEventListener('close', () => {
            if (reconnectAttempts < 2 && currentRoomId) {
                reconnectAttempts += 1;
                statusMessageEl.textContent = '실시간 연결이 끊어졌습니다. 재연결 중...';
                window.setTimeout(connectSocket, 1000 * reconnectAttempts);
                return;
            }
            statusMessageEl.textContent = '실시간 연결이 끊어졌습니다.';
        });
    }

    async function sendMessage(event) {
        event.preventDefault();
        const content = inputEl.value.trim();
        if (!content || !socket || socket.readyState !== WebSocket.OPEN) {
            return;
        }
        socket.send(JSON.stringify({ type: 'send_message', content }));
        inputEl.value = '';
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
    composerEl.addEventListener('submit', sendMessage);

    (async () => {
        try {
            await fetchCurrentUser();
            await fetchRooms();
        } catch (error) {
            console.error('dm init failed', error);
        }
    })();
});
