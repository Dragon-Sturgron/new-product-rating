import { getStorage } from '../../_shared/storage.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

export async function onRequestDelete({ request, env }) {
  try {
    const url = new URL(request.url);
    const storage = getStorage(env);
    const scores = await storage.listScores({
      search: url.searchParams.get('search') || '',
      date_from: url.searchParams.get('date_from') || '',
      date_to: url.searchParams.get('date_to') || '',
      limit: url.searchParams.get('limit') || '10000'
    });
    const ids = Array.from(new Set((scores || []).map(row => row && row.id).filter(Boolean).map(String)));
    for (const id of ids) {
      await storage.deleteScore(id);
    }
    return json({ ok: true, deleted_count: ids.length });
  } catch (error) {
    return json({ ok: false, message: error.message || '全部删除评分结果失败' }, error.status || 500);
  }
}
