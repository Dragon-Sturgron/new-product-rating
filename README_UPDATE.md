# 更新说明：评分结果只读 + 后台设置国内 OSS

本版本调整：

1. 后台“评分结果”只允许查看。
   - 列表操作只保留“查看/收起”。
   - 明细里不再显示编辑、历史、删除按钮。
   - 后端 `/api/scores/:id` 的 PUT/DELETE 会返回只读提示，避免旧缓存 JS 继续修改数据。

2. 图片存储配置集中到后台“设置 → 图片存储配置”。
   - 不再需要通过环境变量配置七牛云/阿里云 OSS/腾讯云 COS 参数。
   - 设置页新增“国内 OSS 服务商”选择，可选择七牛云、阿里云 OSS、腾讯云 COS、MinIO/其他 S3。
   - 选择服务商后会辅助填写常见 Endpoint/Region/Path Style，实际 Bucket、AccessKey、SecretKey、公开访问域名仍在页面里填写。

EdgeOne 仍需保留：

```text
STORAGE_DRIVER=edgeone-kv
EDGEONE_KV_NAMESPACE=product_review
```

KV 绑定仍保持：

```text
变量名：EDGEONE_KV
命名空间：product_review
```


## 2026-07-10 更新：评分等级说明和区间后台配置
- 后台“设置”新增“评分等级说明”。
- 可自定义前端顶部说明文字。
- 可配置大单/中单/小单试水/建议不下等等级名称和最低百分比区间。
- 每个评分体系按“该体系得分 ÷ 该体系满分 × 100%”单独判断等级。
- 未完成草稿和最终提交逻辑不变。
