# 片刻放映室

纯静态、零构建依赖的共享观影清单。暖灰纸张、绳子、木夹和照片墙，已看作品收进相册。适配手机，支持键盘操作及减少动画偏好。

## 运行

需要 Python 3；测试需要 Node.js 18+。

```sh
npm run dev
```

打开 http://localhost:5173 。`?demo=1` 体验本机演示；示例 SVG 是原创抽象示意图，不是真实海报，示例不附虚构评分。演示的所有修改仅保存到当前浏览器。

```sh
npm test
npm run check
```

## GitHub Pages

1. 将本目录推送到公开仓库 `youyeyejie/ShareMovieList` 的 `main`。
2. 仓库 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**。
3. 在 Actions 中运行 **Deploy cinema to Pages**（或再次推送）。工作流测试后发布公开文件。
4. 访问 https://youyeyejie.github.io/ShareMovieList/ 。仓库 Settings → General → Features 中启用 Issues。

换仓库时修改 `config.js` 中的 `repository`。站点设置中的本机覆盖优先于配置。默认公开访问实时清单；只有访问者主动选择演示时才使用本机示例。

## 页面内协作

每部作品对应一条含 `shared-cinema:v1` 标记的 GitHub Issue。页面每次打开都请求 Issues，包含分页；搜索和分类在本地完成。刷新按钮重新同步，切回页面也会同步（编辑弹窗打开期间除外）。已打开的多人页面不实时推送，双方可手动刷新；同时编辑同一作品时最后保存者覆盖。

- 添加 / 查看 / 修改 / 移除 / 标记已看 / 从相册恢复，均有页面入口。
- GitHub 设置 → Developer settings → Personal access tokens → Fine-grained tokens：只选择该仓库，给予 **Issues: Read and write**；在网站右上角设置中粘贴。Token 对应的账号也必须拥有操作目标 Issue 的权限。通常需要仓库协作者权限，才能修改和关闭他人创建的 Issue。
- Token 只存在当前 JS 页面内存，不存储、不写入仓库、不传给第三方。刷新后重新连接。不要把 GitHub Token 写进 `config.js`。
- 没有 Token 仍可公开读取；添加可跳转到预填 GitHub Issue，编辑等入口会提示连接 Token。纯静态站无法安全保存 OAuth client secret，因此这里采用用户主动连接；如需一键 GitHub OAuth 登录，则需要额外认证服务。
- 标记已看：Issue 以 `completed` 关闭；恢复：重新打开；移除：以 `not_planned` 关闭，页面不再列出。移除是逻辑删除，可在 GitHub 重新打开恢复。
- 讨论入口链接到对应 Issue 评论区，所有作品有独立讨论串。
- 现有普通 Issue / PR 不会被当作作品。修改作品元数据时请保留生成的 JSON 标记结构。
- 未登录 GitHub REST API 的公共读取存在速率限制；失败会显示提示并保留当前内容，不会伪装成空清单。

## 封面和评分

填入豆瓣作品链接后点击“检索作品资料”，页面尝试直接读取作品 HTML。跨域、反爬或防盗链可能导致失败；此时不填充封面和评分，可手动补充。没有使用第三方跨域代理。

也可在设置里配置 TMDB API Key（保存在本机）或在 `config.js` 设置公开客户端 Key，输入片名后检索并选择候选作品。评分明确标注 TMDB，不冒充豆瓣评分；有有效评分投票才展示。TMDB Key 在纯前端中可被访问者看到，不能当作私密凭证。使用 TMDB 数据时请遵循其使用条款和署名要求。本产品使用 TMDB API，但未经 TMDB 认可或认证。

封面加载失败时替换成文字照片卡；无评分隐藏评分，无链接隐藏跳转入口。外部封面使用 no-referrer；跨站可用性依赖图片提供方。可以使用有权使用的图片托管地址。

参考：[GitHub Issues API](https://docs.github.com/en/rest/issues/issues)、[GitHub CORS](https://docs.github.com/en/rest/using-the-rest-api/using-cors-and-jsonp-to-make-cross-origin-requests)、[TMDB 认证](https://developer.themoviedb.org/docs/authentication-application)。
