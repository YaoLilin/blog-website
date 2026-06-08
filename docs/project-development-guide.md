# 博客网站项目开发说明

## 1. 项目概述

本项目是一个前后端分离的个人博客系统。前台负责文章展示、分类浏览、全文搜索、最近文章、项目展示、个人介绍和 SEO 页面；后台负责文章管理、分类管理、站点设置、项目管理、阅读统计、文件上传和 Git 同步。

整体架构：

- 前端：React + TypeScript + Vite 单页应用。
- 后端：Spring Boot + Spring Data JPA REST API。
- 数据库：MySQL / MariaDB。
- 可选缓存：Redis。
- 部署：Nginx 承载前端静态文件，并反向代理 `/api` 到后端。
- 内容来源：数据库内容 + 服务器文档目录 `docs` + 静态资源目录 `static/images`、`static/attachments`。

## 2. 前端架构

### 2.1 技术栈

- React 19
- TypeScript
- Vite
- React Router
- Zustand
- shadcn/ui + Radix UI
- Tailwind CSS
- lucide-react
- react-markdown + remark-gfm + rehype-highlight
- Vditor
- recharts
- react-helmet-async
- sonner

### 2.2 目录结构

| 路径 | 说明 |
| --- | --- |
| `frontend/src/App.tsx` | 路由入口，定义前台和后台页面结构 |
| `frontend/src/api/index.ts` | API 客户端，统一处理 `/api` 请求、JWT、错误和登录过期 |
| `frontend/src/pages/` | 前台页面 |
| `frontend/src/pages/admin/` | 后台管理页面 |
| `frontend/src/components/` | 通用业务组件 |
| `frontend/src/components/ui/` | UI 基础组件 |
| `frontend/src/stores/` | Zustand 状态 |
| `frontend/src/types/` | 前端数据类型 |
| `frontend/src/config/site.ts` | 站点基础信息 |
| `frontend/src/lib/` | 工具函数 |
| `frontend/public/` | 公共静态资源 |

### 2.3 路由结构

前台路由：

| 路由 | 页面 | 功能 |
| --- | --- | --- |
| `/` | `WelcomePage` | 首页，展示封面、推荐分类、推荐文章、最近文章、项目、个人介绍 |
| `/categories` | `CategoryPage` | 全部分类 |
| `/categories/:id` | `CategoryPage` | 分类详情和分类下文章 |
| `/articles/:id` | `ArticlePage` | 按文章 ID 查看文章 |
| `/articles/view?path=...` | `ArticlePage` | 按文档路径查看服务器管理文章 |
| `/search` | `SearchPage` | 搜索文章 |
| `/recent` | `RecentPage` | 最近文章 |
| `/about` | `Navigate` | 重定向到首页 |

后台路由：

| 路由 | 页面 | 功能 |
| --- | --- | --- |
| `/admin/login` | `AdminLoginPage` | 管理员登录 |
| `/admin` | `AdminDashboard` | 后台首页 |
| `/admin/articles` | `ArticleManagement` | 文章和分类管理 |
| `/admin/stats` | `StatsPage` | 阅读和访问统计 |
| `/admin/settings` | `SettingsPage` | 首页推荐、座右铭、附件存储等设置 |
| `/admin/git` | `GitPage` | Git 状态、提交、拉取、推送、远程仓库管理 |
| `/admin/projects` | `ProjectPage` | 项目展示内容管理 |
| `/admin/profile` | `ProfilePage` | 个人介绍配置 |

### 2.4 状态和数据流

- 前端 API 基础路径固定为 `/api`。
- `api/index.ts` 为所有页面提供统一请求封装。
- JWT 存储在 `localStorage.auth_token`。
- 请求自动附带 `Authorization: Bearer <token>`。
- 后端返回 `401` 时，前端清理登录状态并跳转 `/admin/login`。
- 首页、分类、搜索、最近文章等页面使用 React Router loader 预取数据。
- 主题由 `ThemeProvider` 管理，支持浅色、深色和系统主题。
- `HelmetProvider` 管理页面标题和 SEO meta。

### 2.5 主要前端组件

| 组件 | 功能 |
| --- | --- |
| `Navbar` | 顶部导航、分类菜单、搜索入口、主题切换 |
| `SiteFooter` | 页脚 |
| `CategoryCover` | 分类封面图和默认图标展示 |
| `VditorEditor` | 后台 Markdown 编辑器 |
| `ArticleEditor` | 文章编辑表单 |
| `AdminLayout` | 后台布局和导航 |

## 3. 后端架构

### 3.1 技术栈

- Java 17
- Spring Boot 3.2.0
- Spring Web
- Spring Data JPA
- Spring Security
- MySQL Connector/J
- Spring Data Redis
- JJWT
- JGit
- Commons IO
- Lombok

### 3.2 分层结构

| 包 | 说明 |
| --- | --- |
| `controller` | REST API 控制器 |
| `service` | 业务逻辑 |
| `repository` | JPA 数据访问 |
| `entity` | 数据库实体 |
| `dto` | 前后端传输对象 |
| `config` | Spring Security、静态资源映射等配置 |
| `security` | JWT 生成和认证过滤器 |
| `util` | 浏览器请求识别等工具 |

### 3.3 核心配置

| 配置 | 说明 |
| --- | --- |
| `server.port=8081` | 后端端口 |
| `server.servlet.context-path=/api` | API 前缀 |
| `spring.datasource.*` | 数据库连接 |
| `spring.data.redis.*` | Redis 连接 |
| `app.jwt.secret` | JWT 签名密钥 |
| `app.jwt.expiration` | JWT 有效期 |
| `app.admin.password` | 管理员密码 BCrypt 哈希 |
| `app.docs.path` | 文档目录 |
| `app.image.storage.path` | 图片存储目录 |
| `app.attachment.storage.path` | 附件存储目录 |
| `app.frontend.dist.path` | 前端构建目录 |

### 3.4 安全模型

- 后端使用无状态 JWT 认证。
- `/auth/login` 允许匿名访问。
- GET 类公共接口允许匿名访问，例如分类、文章、设置、统计、项目、SEO。
- 阅读计数 `/articles/{id}/view` 和站点访问 `/stats/visit` 允许匿名访问。
- 图片、附件、文档静态资源允许匿名访问。
- 文章创建/修改/删除、分类创建/修改/删除、设置修改、上传、Git 操作等需要管理员 JWT。
- 管理员密码使用 BCrypt 哈希保存，不保存明文。

### 3.5 静态资源映射

`WebConfig` 将服务器目录映射为 HTTP 资源：

| URL | 本地目录 |
| --- | --- |
| `/static/images/**` | `app.image.storage.path` |
| `/static/attachments/**` | `app.attachment.storage.path` |
| `/docs-static/**` | `app.docs.path` |

### 3.6 后端 API 模块

| 模块 | 路径 | 功能 |
| --- | --- | --- |
| Auth | `/auth` | 管理员登录，返回 JWT |
| Category | `/categories` | 分类 CRUD、分类树、首页推荐分类、移动分类、文件同步 |
| Article | `/articles` | 文章 CRUD、分页、推荐、最近、搜索、按路径读取、阅读统计 |
| Upload | `/upload` | 图片和附件上传 |
| Settings | `/settings` | 座右铭、首页推荐、个人介绍、附件存储配置 |
| Stats | `/stats` | 总阅读数、访问数、趋势、热门文章、访问记录 |
| Git | `/git` | 仓库状态、commit、pull、push、remote、clone |
| Projects | `/projects` | 项目展示 CRUD |
| SEO | `/robots.txt`、`/sitemap.xml`、`/seo/articles/**` | SEO 文件和服务端渲染文章 HTML |

## 4. 页面功能说明

### 4.1 首页

首页由 `WelcomePage` 实现，主要功能：

- 顶部大图展示。
- 泛微开发知识入口，跳转服务器文档文章。
- 推荐分类卡片。
- 推荐文章按一级分类分组展示。
- 最近文章列表。
- 项目展示列表和项目详情弹窗。
- 个人介绍区域，支持图片和 Markdown 内容。
- 页面 meta 信息通过 `Helmet` 设置。

### 4.2 分类页

分类页由 `CategoryPage` 实现，主要功能：

- 展示全部分类树。
- 支持进入指定分类 `/categories/:id`。
- 展示分类下文章列表。
- 支持服务器管理分类和普通分类。
- 使用分类封面图增强展示。

### 4.3 文章页

文章页由 `ArticlePage` 实现，主要功能：

- 支持按文章 ID 读取：`/articles/:id`。
- 支持按文档路径读取：`/articles/view?path=...`。
- Markdown 渲染，支持 GFM、代码高亮和原始 HTML。
- 自动生成目录。
- 支持文章内部文档链接跳转。
- 记录真实浏览器阅读数，管理员和非浏览器请求不计数。
- 服务器管理文章可显示 Git 远程仓库链接。

### 4.4 搜索页

搜索页由 `SearchPage` 实现，主要功能：

- 通过关键词搜索文章。
- 支持标题搜索和全文搜索。
- 展示匹配文章列表。

### 4.5 最近文章页

最近文章页由 `RecentPage` 实现，主要功能：

- 展示最近更新或创建的文章。
- 支持进入文章详情。

### 4.6 后台登录页

后台登录页由 `AdminLoginPage` 实现，主要功能：

- 管理员密码登录。
- 登录成功后保存 JWT。
- 登录过期自动回到登录页。

### 4.7 后台首页

后台首页由 `AdminDashboard` 实现，主要功能：

- 展示站点统计概览。
- 作为后台功能入口。

### 4.8 文章管理页

文章管理页由 `ArticleManagement` 和 `ArticleEditor` 实现，主要功能：

- 分类树管理。
- 文章列表管理。
- 新建、编辑、删除文章。
- Markdown 编辑。
- 推荐文章标记。
- 服务器文件同步。
- 分类移动。
- 图片和附件上传。

### 4.9 统计页

统计页由 `StatsPage` 实现，主要功能：

- 总阅读数。
- 总访问数。
- 180 天阅读趋势。
- 180 天访问趋势。
- 热门文章排行榜。

### 4.10 设置页

设置页由 `SettingsPage` 实现，主要功能：

- 配置首页座右铭。
- 配置首页推荐分类。
- 配置首页推荐文章。
- 配置附件存储位置。
- 管理系统设置键值。

### 4.11 Git 管理页

Git 管理页由 `GitPage` 实现，主要功能：

- 查看 Git 仓库状态。
- 查看远程仓库。
- 添加/删除 remote。
- commit、pull、push。
- clone 远程仓库到指定分类或自定义路径。
- 支持服务器管理分类对应仓库。

### 4.12 项目管理页

项目管理页由 `ProjectPage` 实现，主要功能：

- 管理首页展示的项目。
- 支持项目名称、短描述、详细描述、链接、封面图、排序。

### 4.13 个人介绍页

个人介绍页由 `ProfilePage` 实现，主要功能：

- 配置个人介绍图片。
- 配置个人介绍 Markdown 内容。
- 首页读取该配置展示。

## 5. 数据库表结构说明

数据库初始化脚本位于 `server/src/main/resources/schema.sql`。实体类位于 `server/src/main/java/com/blog/myblog/entity`。

### 5.1 `category` 分类表

保存文章分类，支持多级树结构和服务器文件目录映射。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | BIGINT | 主键 |
| `name` | VARCHAR(100) | 分类名称 |
| `parent_id` | BIGINT | 父分类 ID，空表示一级分类 |
| `cover_image` | VARCHAR(255/500) | 分类封面图 |
| `sort_order` | INT | 排序 |
| `is_server_managed` | BOOLEAN | 是否由服务器文件目录管理 |
| `file_path` | VARCHAR(1000) | 服务器文件目录相对路径，唯一 |
| `created_at` | TIMESTAMP / DATETIME | 创建时间 |
| `updated_at` | TIMESTAMP / DATETIME | 更新时间 |

索引和约束：

- `parent_id` 外键指向 `category.id`。
- 删除父分类时，子分类 `parent_id` 置空。
- `file_path` 唯一。
- `idx_parent_id` 加速分类树查询。

### 5.2 `article` 文章表

保存文章主体内容。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | BIGINT | 主键 |
| `title` | VARCHAR(200/500) | 文章标题 |
| `content` | LONGTEXT | Markdown 正文 |
| `category_id` | BIGINT | 所属分类 |
| `file_path` | VARCHAR(1000) | 服务器文件路径 |
| `view_count` | INT | 阅读数 |
| `is_recommended` | BOOLEAN | 是否首页推荐 |
| `is_server_managed` | BOOLEAN | 是否由服务器文件管理 |
| `created_at` | TIMESTAMP / DATETIME | 创建时间 |
| `updated_at` | TIMESTAMP / DATETIME | 更新时间 |

索引和约束：

- `category_id` 外键指向 `category.id`。
- 删除分类时级联删除文章。
- `idx_category_id` 加速分类文章查询。
- `idx_is_recommended` 加速推荐文章查询。
- `idx_created_at` 加速最近文章查询。

### 5.3 `image` 图片表

保存上传图片元数据。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | BIGINT | 主键 |
| `article_id` | BIGINT | 关联文章 ID，可为空 |
| `original_name` | VARCHAR(255) | 原始文件名 |
| `file_path` | VARCHAR(500) | 文件保存路径或访问路径 |
| `file_size` | BIGINT | 文件大小 |
| `mime_type` | VARCHAR(100) | MIME 类型 |
| `created_at` | TIMESTAMP / DATETIME | 上传时间 |

索引和约束：

- `article_id` 外键指向 `article.id`。
- 删除文章时图片关联置空。
- `idx_article_id` 加速按文章查图片。

### 5.4 `attachment` 附件表

保存上传附件元数据。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | BIGINT | 主键 |
| `article_id` | BIGINT | 关联文章 ID |
| `original_name` | VARCHAR(255) | 原始文件名 |
| `file_path` | VARCHAR(500) | 文件保存路径或访问路径 |
| `file_size` | BIGINT | 文件大小 |
| `mime_type` | VARCHAR(100) | MIME 类型 |
| `created_at` | TIMESTAMP / DATETIME | 上传时间 |

索引和约束：

- `article_id` 外键指向 `article.id`。
- 删除文章时级联删除附件记录。
- `idx_article_id` 加速按文章查附件。

### 5.5 `view_record` 阅读记录表

用于文章阅读去重统计。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | BIGINT | 主键 |
| `article_id` | BIGINT | 文章 ID |
| `fingerprint` | VARCHAR(64) | 访问指纹 |
| `view_date` | DATE | 访问日期 |
| `created_at` | TIMESTAMP / DATETIME | 创建时间 |

索引和约束：

- `article_id` 外键指向 `article.id`。
- 删除文章时级联删除阅读记录。
- `idx_article_id` 加速按文章统计。
- `idx_view_date` 加速按日期统计。

### 5.6 `site_visit_record` 站点访问表

保存站点级访问记录，用于访问趋势统计。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | BIGINT | 主键 |
| `visit_date` | DATE | 访问日期 |
| `created_at` | TIMESTAMP / DATETIME | 创建时间 |

索引：

- `idx_visit_date` 加速按日期统计。

### 5.7 `system_setting` 系统设置表

保存站点配置项。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | BIGINT | 主键 |
| `setting_key` | VARCHAR(100) | 设置键，唯一 |
| `setting_value` | TEXT | 设置值 |
| `setting_type` | VARCHAR(50) | 设置类型 |
| `description` | VARCHAR(500) | 设置说明 |
| `created_at` | TIMESTAMP / DATETIME | 创建时间 |
| `updated_at` | TIMESTAMP / DATETIME | 更新时间 |

常用设置键：

| key | 说明 |
| --- | --- |
| `MOTTO` | 首页座右铭 |
| `BLOG_NAME` | 博客名称 |
| `ATTACHMENT_STORAGE_LOCATION` | 附件存储位置 |
| `ATTACHMENT_CUSTOM_PATH` | 附件自定义路径 |
| `HOME_RECOMMENDED_CATEGORY_IDS` | 首页推荐分类 ID 列表 |
| `HOME_RECOMMENDED_ARTICLE_IDS` | 首页推荐文章 ID 列表 |
| `PROFILE_IMAGE` | 个人介绍图片 |
| `PROFILE_CONTENT` | 个人介绍 Markdown 内容 |

### 5.8 `project` 项目表

保存首页项目展示内容。代码中已有 `Project` 实体、`ProjectRepository`、`ProjectService`、`ProjectController` 和后台项目管理页。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | BIGINT | 主键 |
| `name` | VARCHAR(200) | 项目名称 |
| `short_desc` | VARCHAR(500) | 短描述 |
| `description` | TEXT | 详细描述 |
| `link` | VARCHAR(1000) | 项目链接 |
| `cover_image` | VARCHAR(500) | 封面图 |
| `sort_order` | INT | 排序 |
| `created_at` | DATETIME | 创建时间 |
| `updated_at` | DATETIME | 更新时间 |

`schema.sql` 已包含该表的建表语句，并通过 `idx_sort_order` 支持按排序字段展示。

## 6. 内容同步和文件管理

### 6.1 服务器管理内容

分类和文章支持 `is_server_managed` 标记：

- `category.file_path` 记录服务器文档目录路径。
- `article.file_path` 记录文章文件路径。
- `/categories/sync` 触发 `FileWatcherService.fullSync()`，同步服务器文件和数据库。
- `/docs-static/**` 暴露文档静态访问。

### 6.2 上传文件

上传入口为 `/api/upload`：

- 图片默认存储到 `app.image.storage.path`。
- 附件默认存储到 `app.attachment.storage.path`。
- 上传结果返回 `url` 和 `originalName`。
- 前端编辑器可在文章编辑时插入上传后的资源链接。

## 7. SEO 实现

SEO 由后端和 Nginx 配合：

- `/api/robots.txt` 生成 robots 文件。
- `/api/sitemap.xml` 根据分类和文章生成站点地图。
- `/api/seo/articles/{id}` 按文章 ID 输出 HTML。
- `/api/seo/articles/view?path=...` 按文件路径输出 HTML。
- Nginx 可将 `/robots.txt`、`/sitemap.xml` 和 `/articles/**` 代理到后端 SEO 接口。
- 前端页面使用 `react-helmet-async` 设置标题和描述。

## 8. 开发注意事项

- 新增公开 GET 接口时，检查 `SecurityConfig` 是否需要放行。
- 新增需要管理员操作的接口时，保持默认认证保护。
- 新增数据库实体时，同步更新 `schema.sql` 和本开发说明。
- 新增页面时，在 `App.tsx` 注册路由，并在 `api/index.ts` 添加对应 API 封装。
- 修改文章/分类文件同步逻辑时，注意数据库内容和服务器文件路径的一致性。
- 修改上传逻辑时，注意图片、附件路径和 Nginx alias 配置同步。
