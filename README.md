# 等空一起看

和朋友共享一份观影清单。想看的电影、剧集和番剧放在「片单墙」，看完的作品收进「一起看过」。[打开观影清单](https://youyeyejie.github.io/ShareMovieList/)

## 浏览片单

公开片单无需登录。用软木板顶部的菜单切换清单，按类型筛选或输入片名搜索。点击照片或便笺可以查看详情，复制当前网址即可把这份清单发给朋友。

## 添加和编辑作品

1. 在网站的「连接设置」中填入自己的 GitHub 令牌，点击「验证 GitHub 身份」。
    - 仓库所有者：创建细粒度令牌（Fine-grained token），在 **Only select repositories** 中选中自己的片单仓库，将 **Contents** 设为 **Read and write**。
    - 受邀协作者（Collaborator）：接受仓库邀请后，用自己的账号创建 **Tokens (classic)**，勾选 **`public_repo`**。 
2. 选择目标清单，点击「添加作品」。可以手动填写片名和备注，其他资料留空；也可以使用下方两种导入方式。
    - **用 TMDB 搜片**：在「连接设置」填入自己的 TMDB API Read Access Token，点击「保存 TMDB 设置」。添加作品时输入片名，点击「查询 TMDB」，从结果中选中对应的作品。
    - **从豆瓣导入**：[下载](https://youyeyejie.github.io/ShareMovieList/downloads/douban-import.zip)并解压扩展，在 Chrome 或 Edge 的扩展管理页开启「开发者模式」，选择「加载已解压的扩展程序」，载入包含 `manifest.json` 的目录。之后打开豆瓣作品详情页，点击扩展图标，选择「导入到片单」。网站会自动打开「添加作品」并填入草稿。如果尚未验证 GitHub 身份，先完成连接；如果仓库里还没有片单，先为新清单起名。保存时封面会随影片资料一起写入仓库；如需替换，可点击「选择图片」上传本地封面。

3. 核对后点击「保存并提交」。片单墙会立即更新，并在后台提交到 GitHub。看完后点击「收进相册」，想重看时可以从相册中「钉回片单墙」。

## Fork 一份自己的片单

以 GitHub 用户 `alice`、仓库名 `ShareMovieList` 为例。请把下面的用户名和仓库名换成自己的。

1. 点击仓库右上角 **Fork**，创建自己的公开仓库。保留默认分支 `main`。
2. 在 fork 的 **Actions** 页面启用工作流，然后到 **Settings → Pages → Build and deployment**，把 **Source** 设为 **GitHub Actions**。
3. 编辑 [src/config.js](src/config.js)，将 `repository` 改为 `alice/ShareMovieList`，保留 `branch: 'main'`。提交到 `main` 后会触发部署。等 **Deploy cinema to Pages** 成功，即可访问 `https://alice.github.io/ShareMovieList/`。
4. 打开自己的站点，在「连接设置」中验证只授权给自己仓库的 GitHub 令牌。Fork 会带上原有的 `lists/` 数据，可以从清单菜单创建自己的清单。要与朋友一起编辑，请在 fork 的 **Settings → Collaborators** 邀请他们。朋友接受后，按上方「受邀协作者」一行配置自己的令牌。
5. **需要豆瓣扩展时**，编辑 [extension/manifest.json](extension/manifest.json)，将 `content_scripts[0].matches[0]` 改为 `https://alice.github.io/ShareMovieList/*`。提交并等部署完成后，从自己站点的 `downloads/douban-import.zip` 下载并安装扩展，导入就会打开自己的站点。

使用 TMDB 搜索时，在自己的站点保存 TMDB 长令牌。日常修改片单只提交数据文件，页面会直接读取最新内容。

## 本地预览

在装有 npm 和 Python 3 的电脑上，进入项目目录运行 `npm run dev`，再打开[本地片单墙](http://127.0.0.1:5173/)。本地预览连接同一个共享仓库，保存作品也会产生真实提交。
