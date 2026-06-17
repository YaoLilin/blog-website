# 如何让搜索引擎搜索到网站内容（文章）

以当前博客站点 `https://yaolilin.com` 为例，搜索引擎能搜索到文章，核心不是“页面能被人打开”就够了，而是要让搜索引擎完成三件事：

1. 能发现文章 URL
2. 能抓取文章页面
3. 能在 HTML 中直接读到文章内容

## 一、搜索引擎如何发现网站和文章

搜索引擎通常通过以下方式发现页面：

- 外部链接：其它网站链接到你的站点或文章。
- 内部链接：首页、分类页、文章列表页链接到文章详情页。
- Sitemap：站点主动提供所有重要页面的 URL 清单。
- 手动提交：在 Google Search Console、百度搜索资源平台、Bing Webmaster Tools 中提交网站或 sitemap。

对于新网站来说，最可靠的方式是：

- 网站首页能正常访问。
- 首页和分类页能链接到文章页。
- 提供 `sitemap.xml`。
- 在搜索引擎站长平台提交 `sitemap.xml`。

当前博客的 sitemap 地址是：

```text
https://yaolilin.com/sitemap.xml
```

其中应该包含文章 URL，例如：

```text
https://yaolilin.com/articles/98
https://yaolilin.com/articles/105
```

## 二、robots.txt：告诉搜索引擎哪些能抓、哪些不能抓

`robots.txt` 放在网站根路径：

```text
https://yaolilin.com/robots.txt
```

当前博客的规则类似：

```txt
User-agent: *
Allow: /
Disallow: /login
Disallow: /admin/

Sitemap: https://yaolilin.com/sitemap.xml
```

含义：

- 允许搜索引擎抓取网站大部分内容。
- 禁止抓取登录页 `/login`。
- 禁止抓取后台 `/admin/`。
- 告诉搜索引擎 sitemap 的地址。

注意：`robots.txt` 不是让页面被收录的保证，它只是抓取规则。真正要被收录，还需要页面内容质量、可访问性、HTML 内容和搜索引擎处理时间。

## 三、sitemap.xml：告诉搜索引擎站点有哪些页面

`sitemap.xml` 是一个 XML 文件，用来列出网站希望搜索引擎发现的页面。

当前博客的 sitemap 应包含：

- 首页：`https://yaolilin.com/`
- 分类页：`https://yaolilin.com/categories`
- 最近文章页：`https://yaolilin.com/recent`
- 文章详情页：`https://yaolilin.com/articles/{id}`

示例：

```xml
<url>
  <loc>https://yaolilin.com/articles/98</loc>
  <lastmod>2026-06-06</lastmod>
  <changefreq>monthly</changefreq>
  <priority>0.9</priority>
</url>
```

sitemap 的重点：

- URL 必须是公开可访问的正式地址。
- 不要出现 `127.0.0.1`、`localhost` 或内网地址。
- 文章 URL 返回状态码应为 `200`。
- 页面不应被 `robots.txt` 禁止。
- 页面不应带错误 canonical。

## 四、SPA 网站为什么容易搜索不到文章

当前博客前端是 Vite + React，属于单页应用 SPA。

传统 SPA 的问题是：浏览器访问文章页时，服务器可能只返回一个空壳 HTML：

```html
<div id="root"></div>
<script src="/assets/index.js"></script>
```

文章标题和正文需要浏览器执行 JavaScript 后才显示。

普通用户访问没问题，但搜索引擎抓取时可能遇到这些问题：

- 抓到的 HTML 没有正文。
- 标题、描述、canonical 不准确。
- 依赖 JavaScript 渲染，抓取和收录更慢。
- 有些搜索引擎对 JavaScript 渲染支持较弱。

所以博客文章页更理想的做法是：**文章页首屏 HTML 由后端直接返回正文，前端 React 再接管交互。**

## 五、文章页服务端 HTML 的做法

当前博客采用的方案是：

用户和搜索引擎访问：

```text
https://yaolilin.com/articles/98
```

nginx 不再直接返回前端 `index.html`，而是转发给后端 SEO 接口：

```text
http://127.0.0.1:8081/api/seo/articles/98
```

后端读取文章数据后，返回带正文的 HTML，例如：

```html
<title>README - 个人博客</title>
<meta name="description" content="文章摘要..." />
<link rel="canonical" href="https://yaolilin.com/articles/98" />

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "README"
}
</script>

<div id="root">
  <main class="seo-article">
    <article>
      <h1>README</h1>
      <div class="seo-article-content">
        文章正文...
      </div>
    </article>
  </main>
</div>
```

这样搜索引擎即使不执行 JavaScript，也能直接读到文章标题、摘要、正文和结构化数据。

## 六、nginx 需要怎么配

文章页 SEO 的关键是 nginx 路由。

当前博客生产环境需要把 `/articles/` 转发给后端 SEO 接口：

```nginx
location /articles/ {
    proxy_pass http://127.0.0.1:8081/api/seo/articles/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

同时 sitemap 和 robots 也应转发给后端：

```nginx
location = /robots.txt {
    proxy_pass http://127.0.0.1:8081/api/robots.txt;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location = /sitemap.xml {
    proxy_pass http://127.0.0.1:8081/api/sitemap.xml;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

普通前端路由仍然可以回退到 SPA：

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

注意顺序：`location /articles/` 必须能优先命中文章页，不能让文章页落到 `location /` 的 `index.html` 空壳里。

## 七、如何验证搜索引擎能看到文章内容

不要只用浏览器看，因为浏览器会执行 JavaScript。应该用 `curl` 看服务器直接返回的 HTML。

验证文章页：

```bash
curl -s https://yaolilin.com/articles/98 | sed -n '1,120p'
```

应该能看到：

- `<title>` 是文章标题。
- `<meta name="description">` 是文章摘要。
- `<link rel="canonical">` 是正式文章 URL。
- `<script type="application/ld+json">` 结构化数据。
- `<div id="root">` 里面已有文章正文。

如果只看到：

```html
<div id="root"></div>
```

说明搜索引擎看到的还是 SPA 空壳，文章 SEO 路由没有生效。

验证 robots：

```bash
curl -s https://yaolilin.com/robots.txt
```

验证 sitemap：

```bash
curl -s https://yaolilin.com/sitemap.xml | sed -n '1,80p'
```

验证是否已经被收录：

```text
site:yaolilin.com
site:yaolilin.com/articles
```

## 八、提交到 Google

Google 使用 Search Console：

```text
https://search.google.com/search-console
```

流程：

1. 添加资源：`https://yaolilin.com`
2. 验证网站所有权。
3. 提交 sitemap：

```text
https://yaolilin.com/sitemap.xml
```

4. 对重要文章使用“网址检查”，请求编入索引。

当前博客已经在首页 `<head>` 中加入 Google 验证 meta：

```html
<meta name="google-site-verification" content="jLOnG83lRMKXDKsBC5nyMn0qTW2EGZUY3VU_jsh3xU4" />
```

## 九、提交到百度

百度使用百度搜索资源平台：

```text
https://ziyuan.baidu.com/
```

流程：

1. 登录百度账号。
2. 添加站点：`https://yaolilin.com`
3. 完成所有权验证。
4. 进入资源提交。
5. 提交 sitemap：

```text
https://yaolilin.com/sitemap.xml
```

6. 在普通收录中手动提交重要 URL：

```text
https://yaolilin.com/
https://yaolilin.com/articles/98
https://yaolilin.com/articles/105
```

提交不等于马上收录。它只是帮助百度更快发现链接，是否收录还取决于页面质量、可抓取性、站点权重和处理时间。

## 十、常见问题排查

### 1. sitemap 正常，但文章还是搜不到

检查文章页直接 HTML：

```bash
curl -s https://yaolilin.com/articles/98
```

如果没有文章正文，说明 nginx 没有把 `/articles/` 转发到后端 SEO 接口。

### 2. sitemap 里出现 localhost 或 127.0.0.1

说明后端生成 URL 时没有拿到正确域名。

检查 nginx 是否传了：

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
```

必要时可以在后端配置固定站点域名，例如：

```properties
app.site.url=https://yaolilin.com
```

### 3. robots 禁止了文章路径

检查：

```text
Disallow: /articles
```

如果存在这类规则，搜索引擎可能不会抓文章页。

当前博客只禁止：

```text
Disallow: /login
Disallow: /admin/
```

这是合理的。

### 4. 页面 canonical 指向错误地址

文章页 canonical 应该是：

```html
<link rel="canonical" href="https://yaolilin.com/articles/98" />
```

不能指向：

```text
http://127.0.0.1:8081/articles/98
http://localhost:8081/articles/98
```

### 5. 搜索引擎还没来抓

新网站即使配置正确，也不会立刻出现搜索结果。可以做：

- 提交 sitemap。
- 手动提交重要文章 URL。
- 增加站内链接。
- 从 GitHub、个人主页、技术社区等可信位置放一些外链。
- 保持文章稳定、可访问、内容有价值。

## 十一、当前博客的最终检查清单

当前博客要让文章被搜索引擎发现，需要满足：

- `https://yaolilin.com/robots.txt` 返回 200。
- `robots.txt` 允许抓取文章页。
- `robots.txt` 声明 `Sitemap: https://yaolilin.com/sitemap.xml`。
- `https://yaolilin.com/sitemap.xml` 返回 200。
- sitemap 中包含文章 URL。
- 文章 URL 是正式 HTTPS 域名。
- `https://yaolilin.com/articles/{id}` 返回 200。
- 文章页 HTML 中直接包含文章正文。
- 文章页有正确 title、description、canonical。
- 后台 `/admin/` 和登录页 `/login` 不被抓取。
- Google Search Console 已验证站点。
- 百度搜索资源平台已验证站点。
- sitemap 已提交到搜索引擎。

只要以上都满足，搜索引擎就具备发现和抓取文章的条件。剩下就是等待搜索引擎处理和提升内容质量。

