/**
 * common.js - 공용 유틸리티 모듈
 * 모든 페이지에서 공통으로 사용하는 상수와 함수를 정의합니다.
 */

// ===========================================
// 1. API 설정
// ===========================================
const API_BASE_URL = (window.RUNTIME_CONFIG && window.RUNTIME_CONFIG.API_BASE_URL
    ? String(window.RUNTIME_CONFIG.API_BASE_URL).replace(/\/+$/, '')
    : '');

const UPLOAD_API_BASE_URL = (window.RUNTIME_CONFIG && window.RUNTIME_CONFIG.UPLOAD_API_BASE_URL
    ? String(window.RUNTIME_CONFIG.UPLOAD_API_BASE_URL).replace(/\/+$/, '')
    : API_BASE_URL);

async function parseApiResponseSafe(response) {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        return await response.json();
    }
    const text = await response.text();
    return { message: text || `요청 처리에 실패했습니다. (HTTP ${response.status})` };
}

async function uploadFileViaPresigned(file, type = 'post') {
    if (!file) {
        throw new Error('업로드할 파일이 없습니다.');
    }

    const uploadType = type === 'profile' ? 'profile' : 'post';

    const uploadViaBackend = async () => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', uploadType);

        const directResponse = await fetch(`${API_BASE_URL}/v1/files/upload`, {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });

        const directData = await parseApiResponseSafe(directResponse);
        if (!directResponse.ok) {
            throw new Error(directData.message || directData.detail || `파일 업로드에 실패했습니다. (HTTP ${directResponse.status})`);
        }

        const directFileUrl =
            directData?.fileUrl ||
            directData?.url ||
            directData?.data?.fileUrl ||
            directData?.data?.filePath ||
            directData?.filePath;

        if (!directFileUrl) {
            throw new Error('파일 업로드 응답 형식이 올바르지 않습니다.');
        }

        return directFileUrl;
    };

    if (UPLOAD_API_BASE_URL) {
        try {
            const requestBody = {
                type: uploadType,
                filename: file.name || `${uploadType}.png`,
                contentType: file.type || 'application/octet-stream'
            };

            const presignResponse = await fetch(`${UPLOAD_API_BASE_URL}/v1/files/upload-url`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(requestBody)
            });

            const presignData = await parseApiResponseSafe(presignResponse);
            if (!presignResponse.ok) {
                throw new Error(presignData.message || presignData.detail || '업로드 URL 발급에 실패했습니다.');
            }

            const uploadUrl = presignData?.data?.uploadUrl || presignData?.uploadUrl;
            const fileUrl =
                presignData?.data?.fileUrl ||
                presignData?.data?.filePath ||
                presignData?.fileUrl ||
                presignData?.filePath;

            if (!uploadUrl || !fileUrl) {
                throw new Error('업로드 URL 응답 형식이 올바르지 않습니다.');
            }

            const uploadResponse = await fetch(uploadUrl, {
                method: 'PUT',
                headers: { 'Content-Type': file.type || 'application/octet-stream' },
                body: file
            });

            if (!uploadResponse.ok) {
                const uploadErrorText = await uploadResponse.text();
                throw new Error(uploadErrorText || `S3 업로드에 실패했습니다. (HTTP ${uploadResponse.status})`);
            }

            return fileUrl;
        } catch (e) {
            console.warn('Presigned upload failed. Falling back to backend upload.', e);
        }
    }

    return await uploadViaBackend();
}

window.parseApiResponseSafe = parseApiResponseSafe;
window.uploadFileViaPresigned = uploadFileViaPresigned;

// ===========================================
// 2. 프로필 이미지 즉시 로드 (깜빡임 방지)
// ===========================================
// DOMContentLoaded 전에 실행되도록 함수로 감싸지 않음
(function loadProfileImageImmediately() {
    const cachedProfileImage = localStorage.getItem('profileImage');
    if (cachedProfileImage) {
        // DOM이 준비되면 즉시 적용
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                const profileIcon = document.getElementById('profileIcon');
                if (profileIcon) {
                    profileIcon.style.backgroundImage = `url(${cachedProfileImage})`;
                }
            });
        } else {
            // 이미 DOM이 준비된 경우
            const profileIcon = document.getElementById('profileIcon');
            if (profileIcon) {
                profileIcon.style.backgroundImage = `url(${cachedProfileImage})`;
            }
        }
    }
})();

// ===========================================
// 2. 날짜 포맷 함수
// ===========================================
function formatDate(dateString) {
    if (!dateString) return '';
    const d = new Date(dateString);
    const pad = (n) => n.toString().padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

// ===========================================
// 3. 숫자 포맷 함수 (1000 -> 1k)
// ===========================================
function formatNumber(num) {
    if (!num) return '0';
    if (num >= 100000) return (num / 1000).toFixed(0) + 'k';
    if (num >= 10000) return (num / 1000).toFixed(0) + 'k';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return num.toString();
}

// ===========================================
// 4. 커스텀 모달 함수
// ===========================================
function showCustomModal(message, onConfirm) {
    // 오버레이 생성
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
    `;

    // 모달 박스 생성
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 10px;
        text-align: center;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        max-width: 300px;
    `;

    // 메시지
    const msg = document.createElement('p');
    msg.textContent = message;
    msg.style.cssText = `
        margin-bottom: 20px;
        font-size: 16px;
        color: #333;
        white-space: pre-line;
    `;

    // 확인 버튼
    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = '확인';
    confirmBtn.style.cssText = `
        padding: 10px 40px;
        background-color: #7F6AEE;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: bold;
    `;

    confirmBtn.addEventListener('click', () => {
        document.body.removeChild(overlay);
        if (onConfirm) onConfirm();
    });

    modal.appendChild(msg);
    modal.appendChild(confirmBtn);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}
