function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

function readOnly() {
  return json({ ok: false, message: '评分结果仅允许查看，不能编辑、删除或修改。' }, 405);
}

export async function onRequestPut() {
  return readOnly();
}

export async function onRequestDelete() {
  return readOnly();
}
