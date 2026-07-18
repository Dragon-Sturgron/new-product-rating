import { getStorage, imageSettingsFromEnv, normalizeImageSettings } from '../../_shared/storage.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

export async function onRequestGet({ env }) {
  try {
    const storage = getStorage(env);
    const styles = await storage.listStyles({ activeOnly: true });
    const scoreTypes = storage.getScoreTypes ? await storage.getScoreTypes() : [];
    const scoreFields = await storage.getScoreFields();
    const gradeRules = storage.getGradeRules ? await storage.getGradeRules() : null;
    const rawImageSettings = storage.getImageSettings ? await storage.getImageSettings() : {};
    const imageSettings = normalizeImageSettings(rawImageSettings, imageSettingsFromEnv(env));
    const publicImageSettings = {
      image_key_prefix: imageSettings.image_key_prefix || 'review-images',
      public_image_base_url: imageSettings.public_image_base_url || '',
      public_image_path_prefix: imageSettings.public_image_path_prefix || '',
      s3_endpoint: imageSettings.s3_endpoint || '',
      s3_bucket: imageSettings.s3_bucket || ''
    };
    return json({ ok: true, styles, score_types: scoreTypes, score_fields: scoreFields, grade_rules: gradeRules, image_settings: publicImageSettings });
  } catch (e) {
    return json({ ok: false, message: e.message || '读取评分款式失败' }, e.status || 500);
  }
}
