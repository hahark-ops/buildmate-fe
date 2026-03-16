const { test, expect } = require('@playwright/test');
const { uniqueSeed, signup, login, logout, closeModal } = require('./helpers.cjs');

test('회원가입, 로그인, 프로필 수정, 로그아웃', async ({ page }) => {
  const seed = uniqueSeed('auth');
  const email = `${seed}@example.com`;
  const password = 'Qa!12345Aa';
  const nickname = `닉${seed.slice(-6)}`;
  const updatedNickname = `수정${seed.slice(-5)}`;

  await signup(page, { email, password, nickname });
  await login(page, { email, password });

  await page.goto('/profile.html');
  await expect(page.locator('#emailDisplay')).toHaveText(email);
  await page.locator('#nickname').fill(updatedNickname);
  await page.locator('#submitBtn').click();
  await expect(page.locator('#toast')).toHaveText('수정 완료');

  await logout(page);
});

test('탈퇴 후 같은 이메일과 닉네임으로 재가입 가능', async ({ page }) => {
  const seed = uniqueSeed('rejoin');
  const email = `${seed}@example.com`;
  const password = 'Qa!12345Aa';
  const nickname = `재가입${seed.slice(-4)}`;

  await signup(page, { email, password, nickname });
  await login(page, { email, password });

  await page.goto('/profile.html');
  await page.locator('#withdrawBtn').click();
  await expect(page.locator('#withdrawModal')).toBeVisible();
  await page.locator('#modalConfirmBtn').click();
  await expect(page.getByText('회원 탈퇴가 완료되었습니다. 계정과 관련 데이터가 영구 삭제되었습니다.')).toBeVisible();
  await closeModal(page);
  await page.waitForURL(/login\.html$/);

  await signup(page, { email, password, nickname });
  await login(page, { email, password });
  await expect(page).toHaveURL(/index\.html$/);
});
