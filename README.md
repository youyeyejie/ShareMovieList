# 片刻放映室

纯前端、零构建依赖的个人观影清单，部署于 GitHub Pages。每位用户自行配置 TMDB，作品检索与清单存储完全使用 TMDB；没有后端，也不使用 GitHub Issues/Discussions 保存数据。

## 使用

访问 https://youyeyejie.github.io/ShareMovieList/ ，点击右上角设置：

1. 从 TMDB 账号设置 → API 复制 **API Read Access Token**（长令牌）。无需填写短 API Key。应用凭证用于检索与读取，不等于用户编辑授权。
2. 点击“登录 TMDB 并授权”，在 TMDB 登录并批准应用，然后返回网站。
3. 点击“选择我的清单”或“创建共享清单”。新建清单默认公开，支持电影与剧集混合存储。
4. 在页面搜索 TMDB 并选择作品，添加留言与分类后收藏到照片墙。照片可查看详情、修改留言与分类、移除、标记已看；相册支持恢复。

名称、海报、年份和评分来自 TMDB，不能在此伪造修改。评分无投票或封面获取失败时不展示对应内容。动画剧集会尝试自动归为番剧，也可在页面编辑分类。

每次打开都重新获取清单，支持分页。刷新按钮或切回无弹窗的页面也会同步。多人同时编辑同一条备注时，最后一次保存生效；没有实时推送或冲突合并。

## 与信得过的人共用

TMDB 的 guest session 不是自定义清单的协作者权限，不能用于此需求。本项目采用纯前端的完整账号授权共享：

- **复制完整权限共享链接**：需要先完成 TMDB 用户授权并选择清单。链接将应用读取令牌、用户令牌、账号 ID 和清单 ID 放在 URL fragment（`#access=...`）中。它是编码，不是加密。接收者确认后即可共用所有者的清单，无需自己申请应用。
- **权限相同**：接收者持有用户授权，能操作授权覆盖的 TMDB 账号资源，不限于当前清单。只发给完全信任的人，不要公开到论坛、公开仓库或公开聊天。
- 导入前地址栏移除 fragment；凭证不通过站点 URL 查询参数或 Referer 传送。网页只向 TMDB API 发送凭证。但分享所用的聊天/剪贴板服务仍可能保存链接，fragment 不能防止接收者或设备上的扩展读取它。
- 凭证存在当前标签页的 `sessionStorage`，刷新仍可继续使用，通常关闭标签页后结束（浏览器恢复会话可能恢复它）。不会写入公开代码，不使用 localStorage 持久保存令牌。所有者关闭自己的页面不会让已经分享的用户令牌失效。
- **断开此页面**：只清除当前标签页的用户授权，不影响其他人的链接。
- **撤销当前授权**：调用 TMDB 撤销用户令牌；共用同一令牌的朋友也会失效。重新登录并重新分享后才能继续编辑。
- **复制只读清单链接**：仅包含清单 ID，不携带任何凭证。访客填写自己的应用读取凭证后可浏览公开清单；私密清单需要所有者用户授权。

不能仅分享应用读取令牌就编辑同一份清单。若朋友用同一个应用读取令牌登录自己的 TMDB 账号，权限仍属于朋友自己的账号；要共用同一份清单，需要上述所有者用户授权。

## 数据格式

使用 TMDB v4 Lists：电影与电视共用一份清单，以 `movie:ID` / `tv:ID` 区分。TMDB per-item comment 保存：

```text
[shared-cinema:v2]{"note":"一起看","watched":false,"type":"anime"}
```

标记已看和恢复只更新 comment，不会在多份清单之间搬移。移除调用 TMDB 删除清单条目，可通过重新添加恢复作品，但旧留言不会自动恢复。普通 TMDB 备注会作为留言显示；编辑后转成本项目格式。在 TMDB 官网手动覆盖该格式会丢失对应条目的已看/分类元数据。

新增作品分为加入条目和写入备注两个请求。若备注保存失败，页面明确提示“作品已加入，但备注未保存”，刷新后编辑即可修复，避免误报成功。

## 开发和部署

本地预览需要 Python 3；测试需要 Node.js 18+。

```sh
npm run dev
npm test
npm run check
```

访问 http://localhost:5173/ ，`?demo=1` 为独立演示：原创示意封面，没有虚构评分，修改只存在本机当前标签页；演示不会调用 TMDB 写入接口。

默认 `config.js` 不包含任何凭证或默认个人清单。每位用户自行填写。公开仓库不应提交用户令牌或应用读取令牌。

推送到 `main` 后，`.github/workflows/pages.yml` 自动运行测试并部署。仓库 Settings → Pages → Source 选择 GitHub Actions。网站只发布 `index.html`、`config.js`、`src`、`assets`，不会发布测试、文档或本地预览截图。

## TMDB 来源

本产品使用 TMDB API，但未经 TMDB 认可或认证。页脚使用 TMDB 官方标志。

- [用户授权](https://developer.themoviedb.org/v4/docs/authentication-user)
- [访客权限](https://developer.themoviedb.org/docs/authentication-guest-sessions)
- [v4 Lists](https://developer.themoviedb.org/v4/reference/list-details)
- [更新清单备注](https://developer.themoviedb.org/v4/reference/list-update-items)
- [官方标志与署名](https://www.themoviedb.org/about/logos-attribution)

## 软木照片墙

保留 Comic Style 的粗墨线、硬边阴影与黄色强调色，使用本地程序纹理构造软木板。作品以小照片和大头钉呈现；允许适当重叠，悬停或键盘聚焦时置顶。

拖动大头钉改变照片位置，也可聚焦大头钉后使用方向键（Shift 加速）微调，Home 复位。位置限制在板内，按清单与响应式列数保存在当前浏览器 localStorage，不写入 TMDB，也不随共享链接传送。手机可从大头钉拖动，照片其余区域保持正常滚动。

相册使用规整的小照片，不在悬停时旋转。支持按作品名、留言、年份与类别搜索和分页（桌面每页 6 部、手机每页 4 部）；恢复作品后自动修正页码。

设置页仅显示连接、账号、清单、分享操作；凭证与权限说明移到“使用说明与权限”页面内弹窗。移除、分享、撤销与共享账号导入使用原生 dialog 元素构成的页面弹窗，不调用浏览器 alert/confirm/prompt。

所有修改先在本地预览，由用户审核后自行 push。
