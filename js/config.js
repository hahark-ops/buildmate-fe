// 배포 환경별 API 서버 주소를 이 파일에서 관리합니다.
// EC2 FE 프록시 경유 배포에서는 빈 문자열("")을 유지해 상대경로(/v1)를 사용합니다.
window.RUNTIME_CONFIG = window.RUNTIME_CONFIG || {};
window.RUNTIME_CONFIG.API_BASE_URL = "";
window.RUNTIME_CONFIG.UPLOAD_API_BASE_URL = "";
