const { test, expect } = require('@playwright/test');
const { uniqueSeed, signup, login, createPost, closeModal } = require('./helpers.cjs');

test('게시글, 댓글, 좋아요, DM, unread 흐름', async ({ browser }) => {
  const seed = uniqueSeed('dm');
  const password = 'Qa!12345Aa';
  const userA = {
    email: `${seed}a@example.com`,
    nickname: `작성자${seed.slice(-4)}`,
  };
  const userB = {
    email: `${seed}b@example.com`,
    nickname: `독자${seed.slice(-4)}`,
  };
  const postTitle = `테스트 글 ${seed}`;
  const postContent = 'Playwright가 만든 게시글입니다.';
  const commentContent = 'Playwright 댓글입니다.';
  const dmMessage = `DM-${seed}`;
  const replyMessage = `답장-${seed}`;

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await signup(pageA, { ...userA, password });
  await login(pageA, { email: userA.email, password });
  await createPost(pageA, { title: postTitle, content: postContent });
  await expect(pageA.locator('.post-card-title').first()).toHaveText(postTitle);

  await signup(pageB, { ...userB, password });
  await login(pageB, { email: userB.email, password });

  await pageB.goto('/index.html');
  await pageB.getByText(postTitle).click();
  await pageB.waitForURL(/post_detail\.html\?id=/);
  await pageB.locator('#likeBtn').click();
  await expect(pageB.locator('#likeBtn')).toHaveClass(/liked/);
  await pageB.locator('#commentInput').fill(commentContent);
  const commentResponsePromise = pageB.waitForResponse((response) =>
    response.url().includes('/comments') && response.request().method() === 'POST'
  );
  await pageB.locator('#commentSubmitBtn').click();
  const commentResponse = await commentResponsePromise;
  expect(commentResponse.ok()).toBeTruthy();
  await expect(pageB.locator('.comment-item')).toHaveCount(1, { timeout: 15000 });
  await expect(pageB.locator('.comment-content').first()).toHaveText(commentContent, { timeout: 15000 });

  await pageB.locator('.author-info').click();
  await pageB.getByRole('button', { name: '채팅하기' }).click();
  await pageB.waitForURL(/dm\.html\?roomId=/);
  await pageB.locator('#dmInput').fill(dmMessage);
  await pageB.locator('#dmSendBtn').click();
  await expect(pageB.locator('#dmMessageList')).toContainText(dmMessage);

  await pageA.bringToFront();
  await pageA.goto('/index.html');
  await expect(pageA.locator('.dm-unread-badge')).toHaveText('1');
  await pageA.locator('.dm-icon-btn').click();
  await pageA.waitForURL(/dm\.html/);
  await expect(pageA.locator('#dmMessageList')).toContainText(dmMessage);
  await pageA.locator('#dmInput').fill(replyMessage);
  await pageA.locator('#dmSendBtn').click();
  await expect(pageA.locator('#dmMessageList')).toContainText(replyMessage);

  await pageB.bringToFront();
  await expect(pageB.locator('#dmMessageList')).toContainText(replyMessage);

  await contextA.close();
  await contextB.close();
});
