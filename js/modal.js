/**
 * Buildmate modal system.
 * 공용 alert 대체 모달을 Stitch 톤으로 렌더링합니다.
 */

function showCustomModal(message, onConfirm) {
    const escapeHandler = (event) => {
        if (event.key !== 'Escape') {
            return;
        }
        closeModal();
        if (onConfirm) onConfirm();
    };

    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: rgba(15, 23, 42, 0.42);
        backdrop-filter: blur(14px);
        z-index: 9999;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
        width: min(100%, 380px);
        padding: 30px 28px 24px;
        border-radius: 24px;
        background: #ffffff;
        border: 1px solid rgba(226, 232, 240, 0.9);
        box-shadow: 0 28px 60px rgba(15, 23, 42, 0.18);
        text-align: center;
        font-family: Inter, Pretendard, sans-serif;
        color: #0f172a;
    `;

    const badge = document.createElement('div');
    badge.style.cssText = `
        width: 52px;
        height: 52px;
        margin: 0 auto 18px;
        border-radius: 999px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(42, 140, 239, 0.10);
        color: #2a8cef;
        font-size: 22px;
        font-weight: 700;
    `;
    badge.textContent = 'i';

    const msg = document.createElement('p');
    msg.textContent = message;
    msg.style.cssText = `
        margin: 0 0 22px;
        font-size: 15px;
        line-height: 1.7;
        white-space: pre-line;
        letter-spacing: -0.01em;
    `;

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.textContent = '확인';
    confirmBtn.style.cssText = `
        width: 100%;
        min-height: 52px;
        border: none;
        border-radius: 14px;
        background: #2a8cef;
        color: #ffffff;
        font-family: Inter, Pretendard, sans-serif;
        font-size: 15px;
        font-weight: 800;
        letter-spacing: -0.02em;
        cursor: pointer;
        box-shadow: 0 18px 34px rgba(42, 140, 239, 0.20);
    `;

    function closeModal() {
        document.removeEventListener('keydown', escapeHandler);
        if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
    }

    confirmBtn.addEventListener('click', () => {
        closeModal();
        if (onConfirm) onConfirm();
    });

    overlay.addEventListener('click', (event) => {
        if (event.target !== overlay) {
            return;
        }
        closeModal();
        if (onConfirm) onConfirm();
    });

    document.addEventListener('keydown', escapeHandler);

    modal.append(badge, msg, confirmBtn);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    confirmBtn.focus();
}

window.showCustomModal = showCustomModal;
