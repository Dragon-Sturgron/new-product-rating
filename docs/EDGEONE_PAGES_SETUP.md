# EdgeOne Pages 部署

## 构建配置

```text
Framework: None
Build command: 留空或 echo no build needed
Output directory: public
```

## Functions

项目保留：

```text
functions/
```

用于：

```text
/api/*
```

## KV

EdgeOne Pages 环境变量：

```text
STORAGE_DRIVER=edgeone-kv
EDGEONE_KV_NAMESPACE=product_review
```

在 EdgeOne Pages 控制台绑定 KV 命名空间后使用。

## Cloudflare Pages

仍支持：

```text
STORAGE_DRIVER=d1
DB=D1 Binding
```
