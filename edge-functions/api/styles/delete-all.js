import { getStorage } from '../../_shared/storage.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

export async function onRequestDelete({ request, env }) {
  try {
    const url = new URL(request.url);
    const storage = getStorage(env);
    const styles = await storage.listStyles({
      search: url.searchParams.get('search') || ''
    });
    const ids = Array.from(new Set((styles || []).map(row => row && row.id).filter(Boolean).map(String)));
    for (const id of ids) {
      await storage.deleteStyle(id);
    }
    return json({ ok: true, deleted_count: ids.length });
  } catch (error) {
    return json({ ok: false, message: error.message || '全部删除款式失败' }, error.status || 500);
  }
}
