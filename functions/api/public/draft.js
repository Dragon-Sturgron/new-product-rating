import { getStorage } from '../../_shared/storage.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

function reviewerFromRequest(request) {
  const url = new URL(request.url);
  return String(url.searchParams.get('reviewer') || '').trim();
}

export async function onRequestGet({ request, env }) {
  try {
    const reviewer = reviewerFromRequest(request);
    if (!reviewer) return json({ ok: false, message: '评分人姓名不能为空' }, 400);
    const storage = getStorage(env);
    if (typeof storage.getPublicDraft !== 'function') return json({ ok: true, draft: null });
    const draft = await storage.getPublicDraft(reviewer);
    return json({ ok: true, draft: draft || null });
  } catch (e) {
    return json({ ok: false, message: e.message || '读取评分草稿失败' }, e.status || 400);
  }
}

export async function onRequestPut({ request, env }) {
  try {
    const storage = getStorage(env);
    if (typeof storage.savePublicDraft !== 'function') return json({ ok: true, draft: null });
    const payload = await request.json();
    const draft = await storage.savePublicDraft(payload);
    return json({ ok: true, draft });
  } catch (e) {
    return json({ ok: false, message: e.message || '保存评分草稿失败' }, e.status || 400);
  }
}

export async function onRequestPost(context) {
  return onRequestPut(context);
}

export async function onRequestDelete({ request, env }) {
  try {
    const reviewer = reviewerFromRequest(request);
    if (!reviewer) return json({ ok: false, message: '评分人姓名不能为空' }, 400);
    const storage = getStorage(env);
    if (typeof storage.deletePublicDraft === 'function') await storage.deletePublicDraft(reviewer);
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, message: e.message || '删除评分草稿失败' }, e.status || 400);
  }
}
