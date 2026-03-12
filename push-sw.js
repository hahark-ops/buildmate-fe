self.addEventListener('push', (event) => {
    let payload = {};
    try {
        payload = event.data ? event.data.json() : {};
    } catch (error) {
        payload = {};
    }

    const roomId = payload.roomId;
    const senderNickname = payload.senderNickname || '새 메시지';
    const messagePreview = payload.messagePreview || '새 DM 메시지가 도착했습니다.';
    const targetUrl = roomId ? `/dm.html?roomId=${roomId}` : '/dm.html';

    event.waitUntil(
        self.registration.showNotification(`${senderNickname}님의 새 메시지`, {
            body: messagePreview,
            tag: roomId ? `dm-room-${roomId}` : 'dm-message',
            data: { url: targetUrl, roomId },
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = new URL((event.notification.data && event.notification.data.url) || '/dm.html', self.location.origin).href;

    event.waitUntil((async () => {
        const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of allClients) {
            try {
                const clientUrl = new URL(client.url);
                if (clientUrl.pathname.endsWith('/dm.html') || clientUrl.pathname === '/dm.html') {
                    if ('focus' in client) {
                        await client.navigate(targetUrl);
                        return client.focus();
                    }
                }
            } catch (error) {
                // no-op
            }
        }

        if (clients.openWindow) {
            return clients.openWindow(targetUrl);
        }
    })());
});
