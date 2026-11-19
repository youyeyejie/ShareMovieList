<p align="center"><img src="./src/assets/cinema-mark.svg" width="80" height="80" alt=""></p>
<h1 align="center">等空一起看</h1>
<p align="center">和朋友一起收藏想看的电影、剧集和番剧，看完后收进相册。</p>
<p align="center"><a href="https://youyeyejie.github.io/ShareMovieList/">观影清单</a> · <a href="https://youyeyejie.github.io/ShareMovieList/downloads/douban-import.zip">下载豆瓣扩展</a> · <a href="https://github.com/youyeyejie/ShareMovieList/fork">Fork 仓库</a></p>

## 使用

公开访客可以直接浏览、筛选和搜索片单。点击照片或便笺查看详情。「收进相册」标记已看，「钉回片单墙」恢复待看。照片可拖动，触屏设备拖动图钉调整位置。

编辑前在「连接设置」验证自己的 GitHub 令牌。仓库所有者可用选择该仓库并授予 **Discussions → Read and write** 的细粒度令牌，受邀协作者可用具有 **public_repo** 的 classic 令牌。只有账号本身有仓库写权限时，网页才提供保存操作。令牌保存在当前浏览器，清空后验证即可断开连接。

有仓库写权限的账号验证身份后，如果 `Movie Lists` 中缺少同名清单，网站会以 GitHub 用户名创建个人清单讨论。

添加作品可以手动填写，也可以保存自己的 TMDB 长令牌后按片名查询。豆瓣扩展需要在 Chrome 或 Edge 扩展管理页开启开发者模式，加载解压后的扩展目录。在豆瓣作品详情页点击扩展的「导入到片单」，网站会打开编辑草稿。

可以从其他清单添加已有影片，或在详情中将影片移到另一份清单。同一影片只有一条讨论，归属保存在 lists 数组里。观看状态、简介和备注在各归属清单之间共享。从当前清单移除作品时，只移除该归属；最后一个归属被移除时删除影片讨论。

## 讨论区存储

仓库启用 Discussions，并创建 **Movies** 和 **Movie Lists** 两个分类。Movies 中每条影片讨论保存扁平 JSON，Movie Lists 中每条清单讨论的标题为清单名，正文保存 {"list":"清单名"}。正文采用网站生成的标记和 JSON 代码块，请保留格式。

网页和公开快照仅采纳 **OWNER、MEMBER、COLLABORATOR** 作者创建的讨论，包括影片与清单。访客创建相同格式的讨论也会被过滤。新讨论创建后会取消创建者的自动点赞。

登录用户读取实时讨论。匿名访客读取 watchlist-snapshot 分支上的 watchlists.json。GitHub Actions 每 12 小时检查一次，只在数据变化时更新快照。需要立即同步时，可在 Actions 手动运行 Publish public watchlist snapshot。片单变化无需重新部署 Pages。

封面可以使用 TMDB 查询结果，或在「封面地址」填入现有的公开图片链接。封面地址留空时，作品会显示为便笺。

## Fork 部署

1. Fork 为自己的公开仓库，并启用 Actions 和 Discussions。
2. 创建 Movies 与 Movie Lists 分类。
3. 编辑 src/config.js 的 repository 和 defaultList。在 Settings → Pages 将发布源设为 GitHub Actions。
4. 提交后等待 Pages 部署和首次公开快照发布。站点地址通常是 https://用户名.github.io/仓库名/ 。
5. 使用豆瓣扩展时，将 extension/manifest.json 中 content_scripts[0].matches[0] 改成自己站点的地址模式，重新部署并下载扩展。
6. 邀请朋友成为仓库协作者，各自用自己的令牌连接网站。

## 本地预览

需要 npm 和 Python 3，运行 npm run dev，打开 http://127.0.0.1:5173/ 。连接真实账号后，保存会直接修改 GitHub Discussions。

匿名本地预览需要先导出公开快照，在当前终端设置 GH_TOKEN，运行 node src/scripts/discussions.mjs。快照仅用于发布与预览，已从 Git 跟踪中排除。运行 npm run check 检查语法。
