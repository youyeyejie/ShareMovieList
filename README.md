# 片刻放映室

GitHub Pages 展示公开仓库里的观影清单。主页每次打开或刷新时查询 main 的最新提交，从该版本读取影片 JSON。仅修改 lists/ 不触发 Pages 部署。封面由浏览器按文件中记录的链接加载。

## 清单目录

```text
lists/
  With Sensuschung/
    .gitkeep
    星球大战.json
    星际穿越/
      movie.json
```

每个一级目录是一份片单。影片可以是直接放入其中的 JSON 文件，也可以使用子目录中的 movie.json。网页新建作品使用 UUID 文件名，因此改片名不需要移动文件。删除子目录中的作品仅删除 movie.json，其他附件保留。

```json
{
  "title": "星际穿越",
  "type": "movie",
  "year": "2014",
  "url": "https://www.themoviedb.org/movie/157336",
  "tmdb": "movie/157336",
  "cover": "",
  "overview": "",
  "rating": "",
  "ratingSource": "",
  "watched": false,
  "note": ""
}
```

网页保存时记录 createdBy、createdAt 和 updatedAt。后续编辑保留原添加者。直接提交的文件若缺少添加者，页面读取该路径最早的提交记录。文件重命名后建议保留 createdBy。大头针按添加者账号生成稳定色相，卡片下方显示账号，颜色可能相近。

## 浏览与编辑

公开浏览无需凭证。切换清单后可直接分享地址栏中的链接。连接设置中使用自己的 GitHub 个人访问令牌，验证账号以及目标仓库的 push 权限。建议将细粒度令牌限定到该仓库，授予 Contents 读写权限。验证成功后 GitHub 令牌保存在当前浏览器，下次打开自动验证。断开连接会清除令牌。GitHub 最终执行令牌权限和分支保护规则检查。曾经贡献过代码不会自动获得写入权。

保存、移除、标记已看或恢复作品都会通过 GitHub Contents API 向 main 提交一次改动。修改需要当前文件的 blob SHA；版本发生冲突时应先刷新再编辑。Git 历史保留此前版本。作品可先留空创建，页面显示“未命名作品”。

## 资料来源

在连接设置中填写 TMDB API Read Access Token 并点击「保存 TMDB 设置」。浏览器直接请求 TMDB 搜索与详情接口，令牌保存在当前站点的 localStorage。清空输入后再次保存即可移除。令牌只发送到对应服务，建议使用自己的设备。已有的仓库 TMDB_TOKEN Secret 可自行移除。

检索与刷新只更新编辑草稿。保存影片、修改观看状态或移除影片时，页面向 GitHub 提交改动。新建清单在保存第一部作品时一起创建目录。只修改 lists/ 时不会触发部署。

## 本地预览

运行 npm run dev 后打开 http://localhost:5173/ 。本地预览连接配置仓库，已验证的账号保存作品会提交到 main。

运行 npm test 与 npm run check 验证改动。Pages 发布 src/ 的内容。页面、数据脚本及部署配置位于本仓库，部署源选择 GitHub Actions。
