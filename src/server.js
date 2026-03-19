const express = require('express');
const app = express();
const path = require('path');
const projectRoot = path.join(__dirname, '..');

const port = Number(process.env.PORT || 3000);
const backendTarget = process.env.BACKEND_TARGET || 'http://127.0.0.1:8000';

// 정적 파일(CSS, JS 등)을 제공하기 위한 설정 (나중에 필요함)
const { createProxyMiddleware } = require('http-proxy-middleware');

// 0. 로깅 미들웨어 (가장 먼저!)
app.use((req, res, next) => {
    console.log(`[Request] ${req.method} ${req.url}`);
    next();
});

// 1. 프록시 설정 (정적 파일보다 먼저 설정!)
console.log(`Setting up proxy to: ${backendTarget}`);

// http-proxy-middleware v3: context 인자가 사라지고 pathFilter 옵션으로 변경됨
const backendProxy = createProxyMiddleware({
    target: backendTarget,
    changeOrigin: true,
    xfwd: true,
    ws: true,
    pathFilter: ['/v1', '/uploads', '/ws'], // 로컬 검증 시 DM websocket까지 프록시
    logger: console,
    onProxyReq: (proxyReq, req, res) => {
        console.log(`[Proxy] Proxying ${req.method} ${req.url} -> Backend`);
    },
    onProxyRes: (proxyRes, req, res) => {
        console.log(`[Proxy] Response from Backend: ${proxyRes.statusCode}`);
    },
    onError: (err, req, res) => {
        console.error('[Proxy] Error:', err);
        res.status(500).send('Proxy Error');
    }
});

app.use(backendProxy);

// 2. 정적 파일 설정
app.use(express.static(projectRoot, { index: false }));

// 3. 루트 및 페이지 라우트
app.get('/', (req, res) => {
    res.sendFile(path.join(projectRoot, 'login.html'));
});

app.get('/posts', (req, res) => {
    res.sendFile(path.join(projectRoot, 'index.html'));
});

// 4. Fallback (404) 핸들러
app.use((req, res, next) => {
    console.log(`[Fallback] 404 Not Found for: ${req.url}`);
    res.status(404).send('Not Found via Express');
});

const server = app.listen(port, () => {
    console.log(`서버가 실행되었습니다!`);
    console.log(`접속 주소: http://localhost:${port}`);
});

server.on('upgrade', backendProxy.upgrade);
