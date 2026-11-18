# 片刻放映室

GitHub Pages 展示公开仓库里的观影清单。主页每次打开或刷新时查询 main 的最新提交，从该版本读取影片 JSON。仅修改 lists/ 不触发 Pages 部署。封面由浏览器按文件中记录的链接加载。

## 清单目录

```text
lists/
  一起看/
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

公开浏览无需凭证。切换清单后可直接分享地址栏中的链接。连接设置中使用自己的 GitHub 个人访问令牌，验证账号以及目标仓库的 push 权限。建议将细粒度令牌限定到该仓库，授予 Contents 读写权限。查询外部资料还需 Actions 读写和 Checks 读取权限。令牌仅存在当前页面内存。GitHub 最终执行令牌权限和分支保护规则检查。曾经贡献过代码不会自动获得写入权。

保存、移除、标记已看或恢复作品都会通过 GitHub Contents API 向 main 提交一次改动。修改需要当前文件的 blob SHA；版本发生冲突时应先刷新再编辑。Git 历史保留此前版本。作品可先留空创建，页面显示“未命名作品”。

## 资料来源

在仓库 Settings → Secrets and variables → Actions → Repository secrets 新建 **TMDB_TOKEN**，值为 TMDB API Read Access Token。工作流必须先存在于默认分支，并允许工作流写入 Checks。认证后，按片名搜索 TMDB 或输入作品链接点击“更新来源资料”，选择候选条目后核对字段并保存。手填和清空均可。资料更新保留观看状态、留言与添加者。

查询通过 workflow_dispatch 排队。结果通过绑定请求编号的 GitHub check run 返回，查询结果与工作流记录在公开仓库可见。工作流只有 contents: read 与 checks: write 权限。TMDB 凭证只传给官方 API。查询失败、无匹配或超时后仍可手动提交。

豆瓣支持按 https://movie.douban.com/subject/编号/ 尝试读取公开网页的 JSON-LD；这是尽力导入，访问限制或页面结构变化可能导致失败。手工资料可独立保存。旧 TMDB 清单在原账号中保留，仓库初始片单为空，迁移不会自动复制旧账号数据。

## 本地预览

运行 npm run dev 后打开 http://localhost:5173/ 。正式模式连接配置仓库，使用可写令牌保存会产生真实 commit。使用 http://localhost:5173/?demo=1 可在当前标签页体验手动编辑、照片墙与相册，外部查询使用演示数据。

运行 npm test 与 npm run check 验证改动。Pages 只发布 index.html、config.js、src/ 和 assets/。页面、数据脚本及部署配置位于本仓库，部署源选择 GitHub Actions。
