# 新品评审评分系统部署说明

本文档适用于当前 **V12** 版本，主要说明如何将项目部署到 **腾讯云 EdgeOne Pages**，包括框架选择、构建配置、EdgeOne KV、环境变量、首次登录、后台初始化，以及部署完成后的图片存储配置。

> 本项目不允许评分人员直接访问系统根域名。评分人员必须通过管理员在后台生成的有效评分链接进入。

---

## 目录

1. [项目介绍](#1-项目介绍)
2. [技术架构](#2-技术架构)
3. [项目目录说明](#3-项目目录说明)
4. [部署前准备](#4-部署前准备)
5. [创建 EdgeOne KV](#5-创建-edgeone-kv)
6. [创建 EdgeOne Pages 项目](#6-创建-edgeone-pages-项目)
7. [框架与构建配置](#7-框架与构建配置)
8. [配置 KV 资源绑定](#8-配置-kv-资源绑定)
9. [配置环境变量](#9-配置环境变量)
10. [部署并验证后台](#10-部署并验证后台)
11. [部署后的后台初始化](#11-部署后的后台初始化)
12. [图片存储配置](#12-图片存储配置)
13. [七牛云配置示例](#13-七牛云配置示例)
14. [阿里云 OSS 配置示例](#14-阿里云-oss-配置示例)
15. [腾讯云 COS 配置示例](#15-腾讯云-cos-配置示例)
16. [MinIO 或其他 S3 配置](#16-minio-或其他-s3-配置)
17. [完整业务使用流程](#17-完整业务使用流程)
18. [环境变量修改说明](#18-环境变量修改说明)
19. [常见问题排查](#19-常见问题排查)
20. [安全建议](#20-安全建议)
21. [版本更新与重新部署](#21-版本更新与重新部署)

---

## 1. 项目介绍

这是一个适合手机和电脑使用的新品评审评分系统，主要功能包括：

- 管理员后台登录。
- 自定义后台访问路径。
- 新增、编辑、导入和删除评分款式。
- 配置产品图、款式编码、季节、基本售价和备注。
- 自定义评分类型、评分项和每项满分。
- 选择指定款式生成独立评分链接。
- 设置评分链接名称、备注和有效期。
- 修改评分链接包含的款式和有效期。
- 评分链接到期后自动禁止访问和提交。
- 同一个评分人可以通过不同评分链接分别提交。
- 评分结果关联对应评分链接。
- 按评分链接、评分人、日期等条件筛选结果。
- 勾选导出评分结果；未勾选时导出当前筛选结果。
- 使用 EdgeOne KV 保存款式、评分配置、评分链接、草稿和评分结果。
- 使用七牛云、阿里云 OSS、腾讯云 COS、MinIO 等 S3 兼容存储保存图片。

系统访问规则：

- 直接访问根域名：显示“无法进入评分”。
- 管理员后台：访问环境变量 `ADMIN_PATH` 对应的路径。
- 评分人员：访问后台生成的 `域名/随机链接码`。

---

## 2. 技术架构

### 2.1 前端

- 原生 HTML。
- 原生 CSS。
- 原生 JavaScript。
- 无 React、Vue、Angular 等前端框架。
- 不需要前端打包编译。

### 2.2 服务端

- EdgeOne Edge Functions。
- JavaScript ES Module。
- API 路径位于：

```text
/api/*
```

### 2.3 数据存储

EdgeOne Pages 部署时使用：

```text
EdgeOne KV
```

KV 中保存的主要数据包括：

- 款式资料。
- 评分类型和评分项。
- 前端说明文字。
- 评分链接。
- 评分草稿。
- 评分结果。
- 图片存储配置。

### 2.4 图片存储

EdgeOne Pages 推荐使用以下任一种 S3 兼容存储：

- 七牛云 Kodo。
- 阿里云 OSS。
- 腾讯云 COS。
- MinIO。
- 其他支持 AWS S3 API 的对象存储。

也可以不启用上传功能，只粘贴已有的图片链接。

### 2.5 构建方式

项目是静态项目，不需要真正执行构建：

```json
{
  "scripts": {
    "build": "echo no build needed"
  }
}
```

输出目录为：

```text
public
```

---

## 3. 项目目录说明

```text
项目根目录/
├─ public/                      静态页面和前端资源
│  ├─ index.html                公共评分页面入口
│  └─ assets/
│     ├─ admin.js               管理后台逻辑
│     ├─ rating.js              评分页面逻辑
│     └─ style.css              全局样式
│
├─ edge-functions/              EdgeOne Pages 使用的边缘函数
│  ├─ [[path]].js               动态路由、后台页面、评分页面
│  ├─ api/                      API 接口
│  └─ _shared/                  KV 和图片存储公共逻辑
│
├─ functions/                   兼容性函数目录
│  ├─ [[path]].js
│  ├─ api/
│  └─ _shared/
│
├─ migrations/                  Cloudflare D1 兼容脚本
├─ edgeone.json                 EdgeOne 构建配置
├─ package.json                 项目信息和本地开发脚本
└─ README.md                    当前部署说明
```

部署 EdgeOne Pages 时，请保留完整目录结构，不要删除：

```text
edge-functions/
functions/
public/
```

其中 `edge-functions/` 是 EdgeOne 动态页面和 API 的关键目录。

---

## 4. 部署前准备

需要准备：

1. 一个腾讯云账号。
2. 已开通 EdgeOne Pages。
3. 一个 Git 仓库，例如 GitHub、GitCode 或 Gitee。
4. 将当前项目完整上传到仓库根目录。
5. 一个用于保存系统数据的 EdgeOne KV 命名空间。
6. 可选：一个用于保存产品图的七牛云、阿里云 OSS、腾讯云 COS 或 MinIO 存储空间。

上传代码前确认仓库根目录中可以直接看到：

```text
public
edge-functions
functions
package.json
edgeone.json
```

不要把整个项目再套一层无关文件夹，否则输出目录可能无法正确找到。

---

## 5. 创建 EdgeOne KV

EdgeOne KV 用来保存系统的业务数据。

### 5.1 创建命名空间

在 EdgeOne 控制台找到 KV 存储相关功能，创建一个新的命名空间。

推荐命名：

```text
product_review
```

命名空间名称可以修改，但后续绑定时必须选择你实际创建的命名空间。

### 5.2 KV 里会保存什么

系统会自动保存：

- 已配置款式。
- 评分配置。
- 评分链接。
- 评分结果。
- 当天未完成的评分草稿。
- 后台图片存储设置。

EdgeOne KV 版本不需要手动执行 `migrations` 目录中的 SQL 文件。

> `migrations` 目录主要用于 Cloudflare D1 兼容部署，EdgeOne KV 部署不执行 SQL。

---

## 6. 创建 EdgeOne Pages 项目

1. 进入 EdgeOne Pages 控制台。
2. 创建新项目。
3. 选择从 Git 仓库导入。
4. 授权并选择项目仓库。
5. 选择需要部署的分支，例如：

```text
main
```

6. 进入构建配置页面。

---

## 7. 框架与构建配置

请按照以下内容填写。

### 7.1 框架预设

选择：

```text
None
```

某些控制台界面可能显示为：

```text
无框架
其他
静态站点
```

不要选择 Vue、React、Next.js 或 Vite。

### 7.2 根目录

仓库根目录就是项目根目录时，保持默认或填写：

```text
/
```

### 7.3 安装命令

项目不需要安装生产依赖，可以留空。

```text
留空
```

如果平台强制要求，可以使用：

```text
npm install
```

但正常情况下没有必要。

### 7.4 构建命令

推荐留空。

```text
留空
```

如果控制台必须填写命令，可填写：

```text
echo no build needed
```

也可以填写：

```text
npm run build
```

项目中的 `npm run build` 只会输出提示，不会编译代码。

### 7.5 输出目录

必须填写：

```text
public
```

### 7.6 推荐配置汇总

```text
框架预设：None
根目录：/
安装命令：留空
构建命令：留空，或 echo no build needed
输出目录：public
```

---

## 8. 配置 KV 资源绑定

### 8.1 绑定变量名

将前面创建的 KV 命名空间绑定到当前 EdgeOne Pages 项目。

绑定变量名推荐并默认使用：

```text
EDGEONE_KV
```

这是一个 **KV 资源绑定变量**，不是普通文本环境变量。

正确做法：

```text
绑定类型：KV
绑定变量名：EDGEONE_KV
绑定资源：product_review
```

错误做法：

```text
普通环境变量 EDGEONE_KV=product_review
```

普通文本变量不能替代 KV 资源绑定。

### 8.2 使用其他绑定变量名

如果你必须使用其他绑定变量名，例如：

```text
MY_REVIEW_KV
```

则需要额外添加普通环境变量：

```text
EDGEONE_KV_BINDING=MY_REVIEW_KV
```

推荐保持默认：

```text
EDGEONE_KV
```

这样不需要额外配置 `EDGEONE_KV_BINDING`。

---

## 9. 配置环境变量

环境变量修改后，需要重新部署才会生效。

### 9.1 推荐环境变量

```text
ADMIN_PATH=review-admin-2026
ADMIN_USERNAME=admin
ADMIN_PASSWORD=请填写高强度后台密码
SESSION_SECRET=请填写与后台密码不同的长随机字符串
SESSION_IDLE_MINUTES=120
STORAGE_DRIVER=edgeone-kv
EDGEONE_KV_NAMESPACE=product_review
TIMEZONE=Asia/Shanghai
```

### 9.2 环境变量详细说明

| 变量名 | 是否必填 | 推荐值 | 说明 |
|---|---:|---|---|
| `ADMIN_PATH` | 否 | `review-admin-2026` | 后台路径。删除后默认是 `/admin`。 |
| `ADMIN_USERNAME` | 否 | `admin` 或自定义账号 | 后台登录账号。删除后默认是 `admin`。 |
| `ADMIN_PASSWORD` | 是 | 高强度密码 | 后台登录密码。缺少时无法登录。 |
| `SESSION_SECRET` | 强烈建议 | 长随机字符串 | 用于签名后台登录会话。修改后旧会话全部失效。 |
| `SESSION_IDLE_MINUTES` | 否 | `120` | 后台闲置多少分钟后重新登录，默认 120 分钟。 |
| `STORAGE_DRIVER` | 是 | `edgeone-kv` | 明确指定使用 EdgeOne KV。 |
| `EDGEONE_KV_NAMESPACE` | 建议保留 | `product_review` | 兼容旧版 EdgeKV 命名空间模式；应与实际 KV 命名空间对应。 |
| `EDGEONE_KV_BINDING` | 否 | `EDGEONE_KV` | 只有 KV 绑定变量名不是 `EDGEONE_KV` 时才需要。 |
| `TIMEZONE` | 否 | `Asia/Shanghai` | 草稿日期和提交日期时区，默认也是 `Asia/Shanghai`。 |

### 9.3 `ADMIN_PATH`

例如：

```text
ADMIN_PATH=review-admin-2026
```

后台地址就是：

```text
https://你的域名/review-admin-2026
```

填写以下三种形式效果相同：

```text
review-admin-2026
/review-admin-2026
/review-admin-2026/
```

建议只使用：

- 英文字母。
- 数字。
- 短横线。
- 下划线。

不建议使用：

```text
api
assets
```

也不建议使用中文、空格或复杂特殊符号。

删除 `ADMIN_PATH` 后，后台路径恢复为：

```text
/admin
```

### 9.4 `ADMIN_USERNAME`

例如：

```text
ADMIN_USERNAME=review-manager
```

重新部署后，登录后台时必须输入：

```text
review-manager
```

账号区分大小写。

删除该变量后，默认账号为：

```text
admin
```

### 9.5 `ADMIN_PASSWORD`

必须配置。

不要使用：

```text
123456
admin
password
```

推荐至少包含：

- 12 个以上字符。
- 大写字母。
- 小写字母。
- 数字。
- 特殊符号。

示例仅用于格式说明，不要直接照抄：

```text
Review@2026-Long-Random-Password
```

### 9.6 `SESSION_SECRET`

推荐使用 32 位以上随机字符串，并且不能与 `ADMIN_PASSWORD` 相同。

示例仅用于格式说明：

```text
rating-session-2026-random-7Kp9xQ3mL8vN2sR6
```

修改 `SESSION_SECRET` 后：

- 所有设备上的旧登录会话立即失效。
- 所有管理员需要重新登录。

### 9.7 `SESSION_IDLE_MINUTES`

例如：

```text
SESSION_IDLE_MINUTES=30
```

表示后台连续闲置 30 分钟后需要重新登录。

删除后默认：

```text
120
```

### 9.8 `STORAGE_DRIVER`

EdgeOne Pages 必须填写：

```text
STORAGE_DRIVER=edgeone-kv
```

不要在 EdgeOne 部署时填写：

```text
STORAGE_DRIVER=d1
```

否则系统会尝试读取 Cloudflare D1 绑定并报错。

### 9.9 环境变量与图片配置的关系

当前版本的图片存储配置保存在后台页面和 KV 中，正常情况下不需要在 EdgeOne 环境变量中配置以下内容：

```text
IMAGE_STORAGE_DRIVER
IMAGE_MAX_SIZE_MB
IMAGE_KEY_PREFIX
PUBLIC_IMAGE_BASE_URL
PUBLIC_IMAGE_PATH_PREFIX
S3_ENDPOINT
S3_BUCKET
S3_REGION
S3_ACCESS_KEY_ID
S3_SECRET_ACCESS_KEY
S3_FORCE_PATH_STYLE
```

这些内容应在部署完成后，通过后台“图片存储配置”页面填写。

---

## 10. 部署并验证后台

### 10.1 开始部署

完成以下内容后开始部署：

- 框架配置正确。
- 输出目录为 `public`。
- 已绑定 `EDGEONE_KV`。
- 已配置环境变量。

等待部署完成并获得访问域名，例如：

```text
https://example.edgeone.app
```

### 10.2 验证根域名

访问：

```text
https://你的域名/
```

正常情况下不会进入评分页面，而是显示：

```text
无法进入评分
访问地址有问题，请联系管理员获取正确的评分链接。
```

这是正常的访问控制效果。

### 10.3 验证后台路径

假设环境变量是：

```text
ADMIN_PATH=review-admin-2026
```

访问：

```text
https://你的域名/review-admin-2026
```

应该看到后台登录页面。

### 10.4 后台登录

使用：

```text
账号：ADMIN_USERNAME
密码：ADMIN_PASSWORD
```

如果未配置 `ADMIN_USERNAME`，默认账号是：

```text
admin
```

---

## 11. 部署后的后台初始化

第一次部署完成后，建议按以下顺序配置。

### 11.1 登录后台

访问自定义后台路径并登录。

### 11.2 配置图片存储

进入：

```text
设置 → 图片存储配置
```

详细步骤见后面的“图片存储配置”。

### 11.3 配置前端说明文字

进入：

```text
设置 → 前端说明文字
```

填写评分页面顶部需要展示的说明，例如：

```text
评分项和满分由后台配置；80%以上大单，60%以上中单，40%以上小单试水，40%以下建议不下
```

### 11.4 配置评分类型

进入：

```text
设置 → 评分项配置
```

可以配置多个独立评分体系，例如：

```text
综合评分
独立评分
A 类评分
B 类评分
```

每个评分类型会单独累计总分。

### 11.5 配置评分项

为每个评分项设置：

- 评分项名称。
- 所属评分类型。
- 满分。

例如：

```text
外观设计：10 分
材质触感：20 分
工艺细节：10 分
容量收纳：10 分
背负舒适度：10 分
```

保存后，评分页面会按照最新配置展示。

### 11.6 添加款式

进入：

```text
款式配置
```

填写：

- 产品图。
- 款式编码。
- 季节。
- 基本售价。
- 是否启用评分。
- 款式备注。

支持：

- 点击选择图片。
- 拖拽图片。
- 复制图片后按 `Ctrl + V` 粘贴。
- 粘贴已有图片链接。
- Excel 导入款式。

### 11.7 生成评分链接

1. 在“已配置款式”左侧勾选需要评分的款式。
2. 点击“生成评分链接”。
3. 填写链接名称。
4. 设置有效期。
5. 填写备注。
6. 确认生成。

生成后的链接格式：

```text
https://你的域名/随机链接码
```

评分人员只能看到该链接包含的款式。

---

## 12. 图片存储配置

进入后台：

```text
设置 → 图片存储配置
```

当前版本提供三种图片模式。

### 12.1 只粘贴图片链接

选择：

```text
只粘贴图片链接
```

适用于：

- 图片已经存储在其他网站。
- 不需要系统上传图片。
- 只想填写公开图片 URL。

这种模式下，点击或拖拽上传会提示当前未启用图片上传。

### 12.2 国内 OSS / S3 兼容存储

EdgeOne Pages 推荐选择：

```text
国内OSS / S3兼容：七牛云、阿里云OSS、腾讯云COS
```

需要填写：

| 字段 | 说明 |
|---|---|
| 国内 OSS 服务商 | 七牛云、阿里云、腾讯云、MinIO 或自定义 S3。 |
| 上传大小上限 MB | 允许上传的单张图片最大大小，范围 1–50 MB。 |
| 文件名前缀 | 系统生成对象名称时使用的前缀，推荐 `review-images`。 |
| 图片公开访问域名 / CDN 域名 | 用于前端展示图片的公开 HTTPS 域名。 |
| 公开访问路径前缀 | 公开域名后额外需要拼接的目录，不需要时留空。 |
| S3 Endpoint | 对象存储的 S3 API 地址。 |
| Bucket / 空间名 | 对象存储空间名称。 |
| Region / 区域 | Bucket 所在区域。 |
| AccessKey ID | 对象存储访问密钥 ID。 |
| SecretKey | 对象存储密钥。 |
| Path Style | 控制对象 URL 使用路径模式还是子域名模式。 |

### 12.3 Cloudflare R2

页面中仍保留：

```text
Cloudflare R2（仅 Cloudflare Pages 使用）
```

EdgeOne Pages 部署不要选择 R2，因为 EdgeOne 没有 Cloudflare R2 的 `IMAGE_BUCKET` 绑定。

EdgeOne Pages 应选择：

```text
国内 OSS / S3 兼容
```

---

## 13. 七牛云配置示例

### 13.1 七牛云准备工作

在七牛云创建 Kodo 空间，并准备：

- 空间名称。
- 区域。
- S3 Endpoint。
- AccessKey。
- SecretKey。
- 公开访问域名或自定义 CDN 域名。

建议为系统单独创建密钥或限制权限，不要长期使用主账号最高权限密钥。

### 13.2 后台填写方式

图片存储方式：

```text
国内OSS / S3兼容
```

国内 OSS 服务商：

```text
七牛云 Kodo
```

示例：

```text
上传大小上限MB：10
文件名前缀：review-images
S3 Endpoint：https://s3-cn-east-1.qiniucs.com
Bucket / 空间名：你的七牛空间名
Region / 区域：cn-east-1
AccessKey ID：你的 AccessKey
SecretKey：你的 SecretKey
Path Style：勾选
```

> Endpoint 和 Region 必须根据你实际创建的七牛空间区域填写，页面自动带出的值只作为示例。

### 13.3 图片公开访问域名

推荐使用 HTTPS 自定义域名，例如：

```text
https://img.example.com
```

填写到：

```text
图片公开访问域名 / CDN域名
```

不要在末尾重复填写 `/`，系统会自动处理。

### 13.4 公开访问路径前缀

如果七牛云实际图片路径类似：

```text
https://img.example.com/xianglupiju/review-images-xxxx.png
```

则填写：

```text
图片公开访问域名：https://img.example.com
公开访问路径前缀：xianglupiju
```

系统最终拼接：

```text
https://img.example.com/xianglupiju/文件名
```

如果图片直接位于域名根路径：

```text
https://img.example.com/review-images-xxxx.png
```

则：

```text
公开访问路径前缀：留空
```

不要重复填写路径，例如错误配置：

```text
图片公开访问域名：https://img.example.com/xianglupiju
公开访问路径前缀：xianglupiju
```

这会导致路径重复。

### 13.5 七牛云 Path Style

七牛云 S3 兼容接口通常选择：

```text
Path Style：勾选
```

生成的 S3 API 上传地址类似：

```text
https://s3-endpoint/空间名/对象名
```

### 13.6 测试上传

1. 保存图片配置。
2. 返回“款式配置”。
3. 新增一个测试款式。
4. 选择一张较小的 JPG 或 PNG。
5. 确认可以预览。
6. 点击“保存款式”。
7. 检查七牛云空间中是否出现对象。
8. 检查后台和评分页面是否都能显示图片。

### 13.7 SecretKey 保存后的显示

保存后重新打开设置时，SecretKey 输入框可能显示为空，这是正常的安全处理。

规则：

- SecretKey 不会从后台接口明文返回。
- 输入框留空再保存，表示继续保留原 SecretKey。
- 只有填写新 SecretKey 时才会替换旧值。

---

## 14. 阿里云 OSS 配置示例

图片存储方式：

```text
国内OSS / S3兼容
```

服务商：

```text
阿里云 OSS
```

以广州区域为示例：

```text
上传大小上限MB：10
文件名前缀：review-images
S3 Endpoint：https://oss-cn-guangzhou.aliyuncs.com
Bucket / 空间名：你的 Bucket 名称
Region / 区域：oss-cn-guangzhou
AccessKey ID：你的 AccessKey ID
SecretKey：你的 AccessKey Secret
Path Style：不勾选
图片公开访问域名：https://你的 OSS 或 CDN 域名
公开访问路径前缀：通常留空
```

必须根据实际 Bucket 区域替换 Endpoint 和 Region。

推荐使用 RAM 子账号，并只授予目标 Bucket 的上传、读取和删除权限。

---

## 15. 腾讯云 COS 配置示例

图片存储方式：

```text
国内OSS / S3兼容
```

服务商：

```text
腾讯云 COS
```

以广州区域为示例：

```text
上传大小上限MB：10
文件名前缀：review-images
S3 Endpoint：https://cos.ap-guangzhou.myqcloud.com
Bucket / 空间名：完整 Bucket 名称
Region / 区域：ap-guangzhou
AccessKey ID：SecretId
SecretKey：SecretKey
Path Style：不勾选
图片公开访问域名：https://你的 COS 或 CDN 域名
公开访问路径前缀：通常留空
```

腾讯云 COS 的 Bucket 名称通常包含 APPID，请填写控制台显示的完整名称。

---

## 16. MinIO 或其他 S3 配置

选择：

```text
MinIO / 其他 S3
```

示例：

```text
S3 Endpoint：https://minio.example.com
Bucket / 空间名：product-review
Region / 区域：us-east-1
AccessKey ID：你的 AccessKey
SecretKey：你的 SecretKey
Path Style：通常勾选
图片公开访问域名：https://img.example.com
公开访问路径前缀：按实际情况填写
```

需要保证 EdgeOne Edge Functions 可以从公网访问该 Endpoint。

局域网地址不能被 EdgeOne 访问，例如：

```text
http://192.168.1.10:9000
http://localhost:9000
```

必须使用公网可访问地址。

---

## 17. 完整业务使用流程

### 17.1 管理员配置

1. 登录后台。
2. 配置图片存储。
3. 配置前端说明文字。
4. 配置评分类型。
5. 配置评分项和满分。
6. 添加或导入款式。
7. 勾选需要评分的款式。
8. 生成评分链接。
9. 将评分链接发送给评分人员。

### 17.2 评分人员操作

1. 打开管理员发送的有效评分链接。
2. 输入评分人姓名。
3. 按顺序逐款评分。
4. 当前款评分未完成时不能进入下一款。
5. 最后一款完成后提交。
6. 提交成功后写入评分结果。

### 17.3 管理员查看结果

进入：

```text
评分结果
```

可以：

- 按关键字查询。
- 按评分链接筛选。
- 按开始日期和结束日期筛选。
- 展开查看本次提交的全部款式明细。
- 勾选删除指定结果。
- 勾选后导出指定结果。
- 未勾选时导出当前筛选条件下的全部结果。

评分结果会显示对应的：

```text
评分链接名称 + 链接码
```

新版本提交的评分会正确关联评分链接。

---

## 18. 环境变量修改说明

### 18.1 修改 `ADMIN_PATH`

修改后，后台地址会变化。

例如从：

```text
ADMIN_PATH=admin
```

改为：

```text
ADMIN_PATH=review-control
```

重新部署后后台地址从：

```text
https://你的域名/admin
```

变成：

```text
https://你的域名/review-control
```

### 18.2 修改 `ADMIN_USERNAME`

修改后，后台账号会变化。

例如：

```text
ADMIN_USERNAME=manager
```

重新部署后必须使用 `manager` 登录。

### 18.3 修改 `ADMIN_PASSWORD`

重新部署后必须使用新密码登录。

如果没有同时修改 `SESSION_SECRET`，旧会话可能在过期前仍然有效。

### 18.4 修改 `SESSION_SECRET`

修改后所有旧登录会话立即失效，是强制所有管理员重新登录的推荐方法。

### 18.5 修改 KV 绑定

如果更换了 KV 命名空间，系统会读取新的空数据空间，表现为：

- 款式为空。
- 评分配置恢复默认。
- 评分链接为空。
- 评分结果为空。

原数据仍在旧 KV 中，不会自动迁移。

---

## 19. 常见问题排查

### 19.1 直接访问域名无法进入评分

这是正常设计。

评分人员必须使用：

```text
https://你的域名/评分链接码
```

管理员必须使用：

```text
https://你的域名/ADMIN_PATH
```

### 19.2 后台路径打不开

检查：

1. `ADMIN_PATH` 是否填写正确。
2. 修改环境变量后是否重新部署。
3. 地址是否多写了其他路径。
4. 是否仍在访问旧后台路径。

### 19.3 后台提示账号或密码错误

检查：

- `ADMIN_USERNAME` 是否区分大小写。
- `ADMIN_PASSWORD` 是否包含前后空格。
- 修改环境变量后是否重新部署。
- 浏览器是否自动填入了旧密码。

### 19.4 提示未配置 `ADMIN_PASSWORD`

说明环境变量没有生效。

检查：

- 变量名必须是：

```text
ADMIN_PASSWORD
```

- 是否配置在当前部署环境。
- 配置后是否重新部署。

### 19.5 提示未找到 EdgeOne KV 绑定对象

检查：

1. 是否创建了 KV 命名空间。
2. 是否把 KV 绑定到当前 Pages 项目。
3. 绑定变量名是否为：

```text
EDGEONE_KV
```

4. 是否错误地只创建了普通文本环境变量。
5. 如果用了其他绑定名，是否配置：

```text
EDGEONE_KV_BINDING=你的绑定变量名
```

### 19.6 部署后数据全部为空

常见原因：

- 绑定了新的 KV 命名空间。
- KV 绑定到了错误的环境。
- `STORAGE_DRIVER` 不再是 `edgeone-kv`。
- 生产环境和预览环境使用了不同 KV。

### 19.7 图片上传失败，提示缺少 Endpoint 或密钥

检查后台图片配置中的：

- S3 Endpoint。
- Bucket。
- Region。
- AccessKey ID。
- SecretKey。

SecretKey 保存后输入框为空不代表密钥被删除。

### 19.8 图片上传返回 403

常见原因：

- AccessKey 或 SecretKey 错误。
- 密钥没有 Bucket 写入权限。
- Endpoint 与 Bucket 区域不匹配。
- Region 填错。
- Path Style 选择错误。
- 对象存储服务没有启用 S3 兼容接口。

### 19.9 上传成功但图片不显示

检查：

1. 图片公开访问域名是否可以直接在浏览器打开。
2. 域名是否使用 HTTPS。
3. 公开访问路径前缀是否缺失。
4. 路径前缀是否重复。
5. Bucket 是否为私有且没有可公开读取方式。
6. CDN 域名是否已正确绑定 Bucket。

### 19.10 七牛云路径缺少目录前缀

如果真实地址需要：

```text
/xianglupiju/
```

则后台填写：

```text
公开访问路径前缀：xianglupiju
```

不要填写前后斜杠，系统会自动处理。

### 19.11 评分链接显示过期

检查后台“评分链接管理”中的有效期。

可以点击“修改”延长有效期，不需要重新生成链接。

### 19.12 按钮点击后仍需要等待

V12 已增加即时加载反馈和批量接口优化，但以下操作仍取决于外部网络：

- 图片上传。
- 大量 Excel 导入。
- 大量评分记录导出。
- OSS 删除大量图片。
- EdgeOne KV 节点响应。

按钮会立即显示处理中状态，但服务器实际完成时间可能超过 1 秒。

### 19.13 修改配置后页面仍显示旧内容

按：

```text
Ctrl + F5
```

强制刷新浏览器缓存。

也可以使用无痕窗口重新访问。

---

## 20. 安全建议

### 20.1 不要把密钥提交到 Git

不要把以下内容写入代码或上传到公开仓库：

```text
ADMIN_PASSWORD
SESSION_SECRET
AccessKey ID
SecretKey
```

### 20.2 使用独立后台路径

不建议长期使用：

```text
/admin
```

推荐使用不容易猜到的路径，例如：

```text
/review-admin-2026-x7k9
```

后台路径不是密码，仍必须配置高强度账号和密码。

### 20.3 定期更换密码

建议定期更换：

- `ADMIN_PASSWORD`。
- `SESSION_SECRET`。
- OSS AccessKey 和 SecretKey。

### 20.4 使用最小权限密钥

对象存储密钥只应拥有目标 Bucket 所需权限，例如：

- 上传对象。
- 读取对象。
- 删除系统管理的对象。

不要使用全账号最高权限密钥。

### 20.5 使用 HTTPS 图片域名

系统页面运行在 HTTPS 下，图片公开域名也应使用 HTTPS。

虽然系统对部分 HTTP 图片提供同源代理兼容，但正式使用仍推荐 HTTPS。

### 20.6 妥善保存 KV

删除 KV 命名空间或更换绑定会导致系统无法读取原数据。

执行重大修改前建议：

- 导出评分结果。
- 记录环境变量。
- 记录 KV 命名空间和绑定变量名。
- 记录图片存储配置。

---

## 21. 版本更新与重新部署

更新代码时：

1. 备份当前仓库。
2. 用新版本文件覆盖仓库。
3. 保留原环境变量。
4. 保留原 KV 绑定。
5. 提交并推送到 Git。
6. 等待 EdgeOne 自动部署，或手动触发重新部署。
7. 部署完成后按 `Ctrl + F5` 强制刷新。

正常更新代码不会清空 KV 数据。

不要随意修改以下内容：

```text
STORAGE_DRIVER
EDGEONE_KV 资源绑定
EDGEONE_KV_NAMESPACE
```

否则可能读取到新的空数据空间。

---

## 快速部署检查清单

### EdgeOne Pages

```text
[ ] 框架选择 None
[ ] 构建命令留空或 echo no build needed
[ ] 输出目录填写 public
[ ] 保留 edge-functions 目录
[ ] 创建 EdgeOne KV 命名空间
[ ] KV 资源绑定变量名为 EDGEONE_KV
[ ] STORAGE_DRIVER=edgeone-kv
[ ] 配置 ADMIN_PASSWORD
[ ] 配置 SESSION_SECRET
[ ] 修改环境变量后重新部署
```

### 部署后

```text
[ ] 根域名显示无法进入评分
[ ] 自定义后台路径可以打开
[ ] 后台账号密码可以登录
[ ] 图片存储配置已保存
[ ] 测试图片可以上传和显示
[ ] 评分类型和评分项已配置
[ ] 已添加测试款式
[ ] 已生成测试评分链接
[ ] 测试评分可以提交
[ ] 评分结果能关联评分链接
[ ] 导出功能正常
```

---

## 推荐环境变量模板

```text
ADMIN_PATH=review-admin-2026-x7k9
ADMIN_USERNAME=admin
ADMIN_PASSWORD=替换为高强度后台密码
SESSION_SECRET=替换为32位以上随机字符串
SESSION_IDLE_MINUTES=120
STORAGE_DRIVER=edgeone-kv
EDGEONE_KV_NAMESPACE=product_review
TIMEZONE=Asia/Shanghai
```

KV 资源绑定：

```text
变量名：EDGEONE_KV
资源：product_review
```

图片配置请在部署后的后台页面填写，不要把 SecretKey 写入仓库。
