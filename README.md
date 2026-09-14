# 俞总和小吴的图像生成工作站

当前分支已适配 **Vercel + Supabase**。旧的 chatgpt.site 网站独立运行，不会因为本仓库更新而迁移数据。

## 已保留的功能
- 独立创作任务、文字生图、上传修图、多轮修改。
- 历史记录、下载、删除与恢复。
- 俞总通过专属链接免登录，拥有全部网站管理功能。
- 只有工作电脑使用管理密钥连接接单程序；ChatGPT 仍在这台电脑的 Chrome 中登录。
- 图片私有存储，10 MB 上传直接到 Supabase，不经过 Vercel 请求体；下载使用短时签名链接。

## 首次部署
1. 在 Supabase 创建项目。保存数据库密码；选择适合双方的地区，并实际测试国内连通性。
2. 在 SQL Editor 执行 `supabase/schema.sql`。脚本建立任务表并开启 RLS，创建私有 bucket `studio-private`，不创建匿名读取策略。
3. 在 Vercel 导入此 GitHub 仓库，Framework 选 Next.js。项目根目录为仓库根目录。安装命令 `npm ci`，构建命令 `npm run build`，Output Directory 保持默认。
4. 按 `deployment.env.example` 配置五个服务端环境变量。数据库使用项目 Connect 页面提供的 transaction pooler 连接串，密码内特殊字符需要 URL 编码；使用 TLS 验证，不要设置 rejectUnauthorized=false。Service Role Key 仅留在服务端，绝不能加 NEXT_PUBLIC_。
5. 使用 `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` 在自己的电脑生成管理密钥，保存到 Vercel 的 ADMIN_ACCESS_TOKEN。不要提交或分享这个密钥。
6. 重新部署。工作电脑打开 `https://你的新域名/manage`，输入管理密钥。然后在网站顶部生成俞总的专属免登录链接。
7. 运行 `node scripts/configure-extension.mjs https://你的新域名`。将 `companion/extension` 作为独立的新扩展文件夹加载到 Chrome；关闭旧接单台，再在新站开始接单。不要在新站验证前覆盖旧站正在使用的扩展。
8. 如果 Vercel 的 Deployment Protection 要求访问者登录 Vercel，在 Production 的访问设置中关闭该平台登录要求，保留应用自身的专属链接保护。

## 数据迁移与切换
本仓库不包含旧站的图片、数据库、会话或秘密链接。创建 Supabase 项目后，仍需从旧站授权导出 projects、assets、versions、edit_jobs 的数据和原始图片，保留 UUID 与父版本关系，再导入新库/私有 bucket。旧的 companion 心跳不要迁入；未完成的生成任务先在旧站处理完毕。新站必须重新生成专属链接，不能复用旧域名的浏览器登录状态。

正式切换前验证：原始图片、文生图、修改图、6–10 MB 上传/下载、历史恢复、电脑接单与回传；让俞总在实际手机和 Wi-Fi 网络测试。当前只完成源码适配和本地测试，未配置真实 Supabase 项目，尚未完成真实出图验收。Vercel/Supabase 不保证中国大陆网络可达性。

## 开发与验证
`npm ci` → 配置 `.env.local` → `npm run dev`。
- `npm run build`：生产构建与 TypeScript 检查。
- `node tests/vercel.mjs`：真实 Postgres 引擎（PGlite）任务流程、事务回滚、签名和大图片回执。
- `node tests/guest-access.mjs`：免登录与共同管理权限。
- `node tests/text-generation.mjs`：文字生成/多轮编辑流程。

其他历史测试及 `.openai`、`drizzle` 配置保留用于旧站迁移参考；Vercel 运行不使用 Cloudflare 绑定。不要在 Vercel 上执行旧的 SQLite migrations。

## 临时上传清理
未完成确认的图片可能保留在私有 bucket 的 staging/ 目录。可在 Supabase Storage 中定期删除该目录内一天以前的对象；不要删除 images/ 或 private/。这不影响已保存版本。
