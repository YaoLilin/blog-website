# 博客系统

一个完整的前后端分离博客系统，包含前台展示、后台管理、文章分类、Markdown 编辑、统计分析等功能。

## 项目结构

```
myblog/
├── frontend/          # React + Vite + shadcn/ui
├── server/            # Spring Boot + Spring Data
├── nginx/             # Nginx 配置
└── docs/              # 文档目录（服务器管理的文件）
```

## 技术栈

### 前端
- **框架**: React 19
- **语言**: TypeScript
- **构建工具**: Vite
- **UI 组件**: shadcn/ui
- **状态管理**: Zustand 或 Context API
- **路由**: React Router
- **Markdown**: react-markdown
- **图表**: recharts
- **主题**: 深色/浅色切换（默认深色）

### 后端
- **框架**: Spring Boot 3.2.0
- **持久层**: Spring Data JPA
- **数据库**: MySQL 8.0
- **缓存**: Redis
- **认证**: JWT (7天有效期)
- **文件监听**: Apache Commons IO
- **Git 集成**: Eclipse JGit

### 基础设施
- **反向代理**: Nginx
- **配置管理**: application.yml

## 快速开始

### 前置要求

1. **Node.js**: >= 22.12.0
2. **npm**: >= 10.0.0

### 后端要求

1. **Java**: JDK 17 或更高
2. **Maven**: 3.6+
3. **MySQL**: 8.0+
4. **Redis**: 6.0+（可选；启用阅读统计去重/缓存相关能力时使用）

### 安装步骤

#### 1. 安装前端依赖

```bash
cd frontend
npm install
```

#### 2. 配置 MySQL

创建数据库：

```sql
CREATE DATABASE blog_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

导入初始化 SQL：

```bash
mysql -u root -p blog_db < server/src/main/resources/schema.sql
```

#### 3. 配置 Redis

确保 Redis 服务正在运行：

```bash
redis-server
```

或使用 Docker：

```bash
docker run -d -p 6379:6379 redis:alpine
```

#### 4. 配置后端

编辑 `server/src/main/resources/application.yml`：

```yaml
server:
  port: 8081
  servlet:
    context-path: /api

spring:
  data:
    redis:
      host: localhost
      port: 6379

app:
  datasource:
    master:
      url: jdbc:mysql://localhost:3306/blog_db?useSSL=false&serverTimezone=UTC
      username: your_mysql_username
      password: your_mysql_password
      driver-class-name: com.mysql.cj.jdbc.Driver
    replica:
      url: jdbc:mysql://localhost:3306/blog_db?useSSL=false&serverTimezone=UTC
      username: your_mysql_username
      password: your_mysql_password
      driver-class-name: com.mysql.cj.jdbc.Driver
  jwt:
    secret: your-secret-key-here
  admin:
    password: $2a$10$MqoKK/5vKGk91GKHOB.2wu0D1LT871T8Kae7jWlAybkE9NbpHKHoq
  site:
    base-url: https://your-domain.com
  index-now:
    enabled: true
    key: your-indexnow-key
  docs:
    path: /path/to/your/docs
  image:
    storage:
      path: /path/to/static/images
  attachment:
    storage:
      path: /path/to/static/attachments
  frontend:
    dist:
      path: /path/to/frontend/dist
```

数据源说明：

- `app.datasource.master`：写库，适合指向主数据库
- `app.datasource.replica`：读库，适合指向当前节点本地只读副本
- 如果当前环境不做主从分离，可以先把 `master` 和 `replica` 都配置成同一个数据库地址

这里保存的是管理员密码的 BCrypt 哈希值，不是明文密码。修改时请先用 `BCryptPasswordEncoder` 重新生成哈希，再替换这里的值。

如果启用 `IndexNow`：

- `app.site.base-url` 填站点公开访问地址，例如 `https://yaolilin.com`
- `app.index-now.key` 填你申请或生成的 key
- 后端启动后会自动在 `app.frontend.dist.path` 根目录写入 `{key}.txt`
- 文章新增、编辑、删除，以及后台“同步文章”完成后，后端会自动向 Bing 的 `IndexNow` 接口提交文章 URL

#### 5. 配置 Nginx

复制 Nginx 配置：

```bash
sudo cp nginx/blog.conf /etc/nginx/sites-available/blog
sudo ln -s /etc/nginx/sites-available/blog /etc/nginx/sites-enabled/blog
sudo nginx -t
sudo systemctl reload nginx
```

### 启动项目

#### 启动后端

```bash
cd server
./mvnw spring-boot:run
```

或使用 Maven：

```bash
cd server
mvn spring-boot:run
```

后端将在 `http://localhost:8081/api` 启动。

#### 启动前端

```bash
cd frontend
npm run dev
```

前端将在 `http://localhost:5173` 启动。

开发环境下，Vite 会把 `/api`、`/robots.txt`、`/sitemap.xml`、`/docs-static` 等请求代理到后端地址，默认是 `http://localhost:8081`，因此后端需要先启动并保持运行。

如果你的后端地址不是 `http://localhost:8081`，请修改 `frontend/vite.config.ts` 顶部的 `BACKEND_URL` 常量，把它改成实际的后端地址即可。所有开发代理都会复用这个常量。

### 访问应用

访问 `http://localhost:5173` 查看博客。

默认管理员密码：`admin`

## 主要功能

### 前台功能

- **导航栏**: 多级分类菜单、搜索、主题切换、GitHub 链接
- **欢迎页面**: 座右铭、推荐分类、推荐文章、最近文章
- **文章分类**: 图标模式和树形模式
- **文章页面**: 三栏布局（目录/内容/下级标题）、Markdown 渲染、编辑功能

### 后台功能

- **登录系统**: JWT 认证（7天会话）
- **文章管理**: 分类树、文章列表、CRUD 操作
- **设置页面**: 座右铭配置、附件存储位置配置
- **统计页面**: 总阅读数、趋势图、排行榜
- **Git 同步**: 检测、提交、拉取、冲突处理

### 核心功能

- **图片上传**: 粘贴上传（复制图片 → 粘贴到编辑器）
- **附件管理**: 简化版，像 Obsidian 一样（复制文件 → 粘贴 → 自动上传）
- **文件系统同步**: 双向同步（数据库 ↔ 服务器文件）
- **阅读数统计**: 去重统计，同一浏览器一天只算一次

## 开发说明

### 前端开发

```bash
cd frontend
npm run dev    # 启动开发服务器
npm run build  # 构建生产版本
npm run lint   # 运行 ESLint
npm run test   # 运行测试
```

### 后端开发

```bash
cd server
./mvnw spring-boot:run    # 启动开发服务器
./mvnw clean package   # 构建生产版本
./mvnw test            # 运行测试
```

## 部署说明

### 生产环境部署

推荐服务器目录约定：

- 项目部署根目录：`/opt/myblog`
- 前端静态目录：`/opt/myblog/dist`
- 服务器文档目录：`/opt/myblog/docs`
- 图片目录：`/opt/myblog/static/images`
- 附件目录：`/opt/myblog/static/attachments`
- 后端 JAR：`/opt/myblog/app.jar`
- 后端配置：`/opt/myblog/application.yml`
- 后端日志：`/opt/myblog/app.log`
- 后端 API：`http://127.0.0.1:8081/api`

生产配置变量：

| 配置项 | 默认值 | 用途 |
| --- | --- | --- |
| `APP_ROOT` | `/opt/myblog` | 部署根目录 |
| `FRONTEND_DIST` | `/opt/myblog/dist` | Nginx 前端 `root` |
| `BACKEND_PORT` | `8081` | Spring Boot 服务端口 |
| `BACKEND_UPSTREAM` | `http://127.0.0.1:8081` | Nginx 反向代理上游 |
| `BACKEND_CONTEXT_PATH` | `/api` | 后端 API 前缀 |
| `APP_JAR` | `/opt/myblog/app.jar` | 后端 JAR 路径 |
| `APP_CONFIG` | `/opt/myblog/application.yml` | 后端配置文件 |
| `APP_LOG` | `/opt/myblog/app.log` | 后端日志文件 |
| `DOCS_DIR` | `/opt/myblog/docs` | 管理文档目录，映射 `/api/docs-static/**` 和 `/docs-static/**` |
| `IMAGE_DIR` | `/opt/myblog/static/images` | 图片静态资源目录 |
| `ATTACHMENT_DIR` | `/opt/myblog/static/attachments` | 附件静态资源目录 |

对应后端 `application.yml`：

```yaml
server:
  port: 8081
  servlet:
    context-path: /api

app:
  datasource:
    master:
      url: jdbc:mysql://127.0.0.1:3306/blog_db?useSSL=false&serverTimezone=UTC
      username: root
      password: your-master-password
      driver-class-name: com.mysql.cj.jdbc.Driver
    replica:
      url: jdbc:mysql://127.0.0.1:3306/blog_db?useSSL=false&serverTimezone=UTC
      username: root
      password: your-replica-password
      driver-class-name: com.mysql.cj.jdbc.Driver
  docs:
    path: /opt/myblog/docs
  image:
    storage:
      path: /opt/myblog/static/images
  attachment:
    storage:
      path: /opt/myblog/static/attachments
  frontend:
    dist:
      path: /opt/myblog/dist
  site:
    base-url: https://your-domain.com
  index-now:
    enabled: true
    key: your-indexnow-key
```

如果部署的是单机版博客，没有单独的从库，可以让 `app.datasource.master` 和 `app.datasource.replica` 指向同一个数据库。

如果部署的是“国内主库 + 国外从库”：

- 国内节点：`master`、`replica` 都可以指向国内数据库，或后续再拆分
- 国外节点：`master` 指向国内主库，`replica` 指向国外本地 MariaDB 从库

#### 1. 构建前端

```bash
cd frontend
npm run build
```

#### 2. 构建后端

```bash
cd server
./mvnw clean package -DskipTests
```

#### 3. 部署前端

将 `frontend/dist` 目录部署到服务器：

```bash
scp -r frontend/dist/* root@<server-ip>:/opt/myblog/dist/
```

#### 4. 部署后端

将 `server/target/*.jar` 部署到服务器：

```bash
scp server/target/myblog-server-1.0.0.jar root@<server-ip>:/opt/myblog/app.jar.new
```

#### 5. 启动后端服务

登录服务器后执行：

```bash
cd /opt/myblog
mv app.jar app.jar.old 2>/dev/null || true
mv app.jar.new app.jar
pkill -f 'java.*app.jar' 2>/dev/null || true
LANG=C.UTF-8 LC_ALL=C.UTF-8 nohup java -Dfile.encoding=UTF-8 -jar app.jar --spring.config.location=/opt/myblog/application.yml > /opt/myblog/app.log 2>&1 &
```

或使用 systemd 服务：

```ini
[Unit]
Description=My Blog Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/myblog
ExecStart=/usr/bin/java -Dfile.encoding=UTF-8 -jar /opt/myblog/app.jar --spring.config.location=/opt/myblog/application.yml
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### 6. 配置 Nginx

确保 Nginx 配置正确指向生产路径：

- 前端根目录：`root /opt/myblog/dist`
- 后端代理：`proxy_pass http://127.0.0.1:8081`
- 图片目录：`alias /opt/myblog/static/images/`
- 附件目录：`alias /opt/myblog/static/attachments/`
- 文档目录：`alias /opt/myblog/docs/`
- `/api/docs-static/` 和 `/docs-static/` 应直接用 Nginx `alias` 暴露文档目录，避免大文件经后端代理触发 Nginx proxy 临时目录权限或缓冲问题。

```bash
nginx -t
nginx -s reload
```

#### 7. 部署后检查

```bash
ps aux | grep 'java.*app.jar' | grep -v grep
tail -f /opt/myblog/app.log
curl -s -o /dev/null -w 'API: HTTP %{http_code}\n' http://127.0.0.1:8081/api/articles
```

### Linux 服务器一键部署脚本

仓库提供通用脚本 `scripts/deploy-linux.sh`，用于在目标 Linux 服务器本机部署当前项目。脚本不包含任何服务器 IP、账号或密码；需要先把仓库代码放到目标服务器，再在服务器上执行。

默认部署到 `/opt/myblog`：

```bash
./scripts/deploy-linux.sh
```

可用环境变量覆盖默认配置：

```bash
APP_ROOT=/srv/myblog \
BACKEND_PORT=8081 \
SERVER_NAME="example.com www.example.com" \
SERVICE_NAME=myblog \
NGINX_CONF=/etc/nginx/conf.d/myblog.conf \
./scripts/deploy-linux.sh
```

常用变量：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `APP_ROOT` | `/opt/myblog` | 部署根目录 |
| `FRONTEND_DIST` | `$APP_ROOT/dist` | 前端静态文件目录 |
| `DOCS_DIR` | `$APP_ROOT/docs` | 管理文档目录 |
| `IMAGE_DIR` | `$APP_ROOT/static/images` | 图片目录 |
| `ATTACHMENT_DIR` | `$APP_ROOT/static/attachments` | 附件目录 |
| `APP_JAR` | `$APP_ROOT/app.jar` | 后端 JAR |
| `APP_CONFIG` | `$APP_ROOT/application.yml` | 后端配置 |
| `APP_LOG` | `$APP_ROOT/app.log` | 后端日志 |
| `BACKEND_PORT` | `8081` | 后端端口 |
| `BACKEND_CONTEXT_PATH` | `/api` | API 前缀 |
| `SERVICE_NAME` | `myblog` | systemd 服务名 |
| `SERVER_NAME` | `_` | Nginx `server_name` |
| `NGINX_CONF` | `/etc/nginx/conf.d/myblog.conf` | Nginx 配置输出路径 |
| `NGINX_BIN` | `nginx` | Nginx 命令，可改为 `/usr/sbin/aa_nginx` |
| `SKIP_BUILD` | `0` | 设为 `1` 时跳过构建 |
| `SKIP_NGINX` | `0` | 设为 `1` 时不写 Nginx 配置 |
| `SKIP_DOCS` | `0` | 设为 `1` 时不同步 `server/docs` |

脚本会执行：

1. 构建前端和后端。
2. 同步前端、文档、图片、附件到部署目录。
3. 安装或更新 systemd 服务，并使用 `-Dfile.encoding=UTF-8` 启动后端。
4. 生成 Nginx 配置，其中 `/api/docs-static/**` 和 `/docs-static/**` 直接 `alias` 到文档目录，适合大文件下载。
5. 执行 `nginx -t`、reload，并验证本机 API。

## 数据库设计

主要数据表：

- `category`: 分类表（支持多级分类）
- `article`: 文章表
- `image`: 图片表
- `attachment`: 附件表
- `view_record`: 阅读统计表
- `system_setting`: 系统设置表

详细表结构请查看 `server/src/main/resources/schema.sql`。

## 注意事项

1. **安全性**
   - 生产环境请修改默认密码和 JWT 密钥
   - 确保 MySQL 和 Redis 使用强密码
   - 配置防火墙规则

2. **性能**
   - 使用生产构建版本
   - 配置适当的 JVM 参数
   - 启用 Redis 缓存
   - 配置 Nginx 静态资源缓存

3. **备份**
   - 定期备份数据库
   - 备份文档目录（docs/）
   - 备份静态资源（images/ 和 attachments/）

4. **日志**
   - 检查后端日志：`/opt/myblog/app.log`
   - 检查 Nginx 日志：`/var/log/nginx/` 或服务器实际 Nginx 日志目录

## 许可证

MIT License

## 联系方式

如有问题，请联系项目维护者。
