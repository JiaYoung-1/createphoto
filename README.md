# 两人建筑工作室

当前推荐使用 companion/extension 中的 Chrome 接单扩展，安装步骤见该目录的“使用说明.txt”。独立 Node 浏览器程序保留供排错，不应与扩展同时运行。扩展需在已登录的普通 Chrome 中加载，只在负责出图的电脑开启接单台；另一台电脑只访问网站即可。网站目前仍仅所有者可访问，并使用 ChatGPT 登录。

2026-09-14 已通过 Chrome 扩展 1.0.3 的真实单图任务验收：网站提交 → 自动上传主图 → 自动填写并发送 → ChatGPT 生成 → 自动保存网站 V3（基于 V0）。任务 f9ee82d2-c954-45fb-ad2f-9c9e63ce0d9a，测试将道路图片右下方围挡改成深蓝色，无手动导入结果。多参考图与跨电脑提交尚未完成真实验收。

私人建筑图像编辑网站，仅所有者可访问。D1 保存草稿、任务和版本关系，R2 私有保存图片。

## ChatGPT 网页接单

网站提交任务，本机 companion/run.mjs 用独立 Chrome（或 Edge）窗口操作已登录的 ChatGPT 网页，下载页面实际显示的生成图片并保存回网站。没有调用 OpenAI 或百炼 API，也不读取其他浏览器的登录信息。此模式依赖网页界面，界面变化可能需要更新程序；不是官方会员额度 API。

本机需要 Node.js 和 Chrome 或 Edge。在 companion 目录安装 package-lock.json 对应依赖后运行 node run.mjs。首次在程序打开的两个标签页分别登录工作室和 ChatGPT。登录保存在被 Git 忽略的 companion/.state/browser，仅保留在本机。不要分享该目录。关闭浏览器会停止接单；电脑与程序须保持运行和联网，且能访问 ChatGPT。

网站一次只处理一个任务，主图加最多两张参考图，每张最多 10 MB，修改要求最多 2000 字。发送之前先记录任务状态；断网、重启或结果不确定时不自动重发，避免重复消耗额度。可取消尚未领取的任务；已发送任务需检查 ChatGPT 后结束等待，这不会撤回 ChatGPT 的生成。

登录失效、验证码、额度不足或页面变化时需要人工处理。已下载的结果保存在 companion/.state/jobs，可重试保存；尚未下载的结果可从 ChatGPT 手动下载，再使用网站“导入修改图”。会员自身的额度和限制继续适用，不保证指定区域以外的像素完全不变。

## 验证

- node tests/companion.mjs：仅 localhost，验证鉴权、队列、设备互斥、状态转移、结果回存和取消，不调用 ChatGPT。
- node tests/workflow.mjs：仅 localhost，验证上传、草稿冲突、版本分支、下载和同源写入。
- node --check companion/run.mjs 和 TypeScript 检查；Sites 构建生成 Cloudflare Worker。

drizzle 中的既有迁移保持不变；0002 增加任务阶段及本机在线状态。历史版本与图片继续保留。上述真实验收针对 Chrome 扩展；旧 Node 浏览器程序未完成同等验收。
