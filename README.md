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
- **配置管理**: application.properties

## 快速开始

### 前置要求

1. **Node.js**: >= 22.12.0
2. **npm**: >= 10.0.0

### 后端要求

1. **Java**: JDK 17 或更高
2. **Maven**: 3.6+
3. **MySQL**: 8.0+
4. **Redis**: 6.0+

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

编辑 `server/src/main/resources/application.properties`：

```properties
# 修改数据库连接信息

spring.datasource.url=jdbc:mysql://localhost:3306/blog_db
spring.datasource.username=your_mysql_username
spring.datasource.password=your_mysql_password

# 修改 Redis 连接信息

spring.data.redis.host=localhost
spring.data.redis.port=6379

# 修改 JWT 密钥（生产环境请使用强密钥）

app.jwt.secret=your-secret-key-here

# 修改管理员密码（BCrypt 加密）

app.admin.password=$2a$10$MqoKK/5vKGk91GKHOB.2wu0D1LT871T8Kae7jWlAybkE9NbpHKHoq

这里保存的是管理员密码的 BCrypt 哈希值，不是明文密码。修改时请先用 `BCryptPasswordEncoder` 重新生成哈希，再替换这里的值。

# 修改文档路径

app.docs.path=/path/to/your/docs
```

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

后端将在 `http://localhost:8080` 启动。

#### 启动前端

```bash
cd frontend
npm run dev
```

前端将在 `http://localhost:5173` 启动。

开发环境下，Vite 会把以 `/api` 开头的请求代理到后端地址，默认是 `http://localhost:8081`，因此后端需要先启动并保持运行。

如果你的后端地址不是 `http://localhost:8081`，请修改 `frontend/vite.config.ts` 里的 `server.proxy['/api'].target`，把它改成实际的后端地址即可。

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

将 `frontend/dist` 目录部署到 Nginx：

```bash
sudo cp -r frontend/dist/* /var/www/blog/frontend/
```

#### 4. 部署后端

将 `server/target/*.jar` 部署到服务器：

```bash
sudo cp server/target/myblog-server-1.0.0.jar /var/www/blog/
```

#### 5. 启动后端服务

```bash
sudo java -jar /var/www/blog/myblog-server-1.0.0.jar
```

或使用 systemd 服务：

```ini
[Unit]
Description=My Blog Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/blog
ExecStart=/usr/bin/java -jar /var/www/blog/myblog-server-1.0.0.jar
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### 6. 配置 Nginx

确保 Nginx 配置正确指向生产路径。

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
   - 检查后端日志：`logs/` 目录
   - 检查 Nginx 日志：`/var/log/nginx/`

## 许可证

MIT License

## 联系方式

如有问题，请联系项目维护者。
