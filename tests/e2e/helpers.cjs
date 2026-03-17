const { expect } = require('@playwright/test');

function uniqueSeed(prefix = 'ci') {
  const now = Date.now();
  const rand = Math.floor(Math.random() * 10000);
  return `${prefix}${now}${rand}`;
}

async function closeModal(page) {
  const confirmButton = page.getByRole('button', { name: '확인' });
  if (await confirmButton.count()) {
    await confirmButton.last().click();
  }
}

async function signup(page, { email, password, nickname }) {
  await page.goto('/signup.html');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#passwordConfirm').fill(password);
  await page.locator('#nickname').fill(nickname);
  await page.locator('#nickname').press('Tab');
  await expect(page.locator('#signupBtn')).toBeEnabled();
  await page.locator('#signupBtn').click();
  await expect(page.getByText('회원가입이 완료되었습니다.')).toBeVisible();
  await closeModal(page);
  await page.waitForURL(/login\.html$/);
}

async function login(page, { email, password }) {
  await page.goto('/login.html');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await expect(page.locator('#loginBtn')).toBeEnabled();
  await page.locator('#loginBtn').click();
  await page.waitForURL(/index\.html$/);
}

async function logout(page) {
  await page.locator('#profileIcon').click();
  await page.locator('#logoutBtn').click();
  await page.waitForURL(/login\.html$/);
}

async function createPost(page, { title, content }) {
  await page.goto('/post_write.html');
  await page.locator('#title').fill(title);
  await page.locator('#content').fill(content);
  await expect(page.locator('#submitBtn')).toBeEnabled();
  await page.locator('#submitBtn').click();
  await expect(page.getByText('프로젝트 모집글이 등록되었습니다.')).toBeVisible();
  await closeModal(page);
  await page.waitForURL(/index\.html$/);
}

module.exports = {
  uniqueSeed,
  signup,
  login,
  logout,
  createPost,
  closeModal,
};
