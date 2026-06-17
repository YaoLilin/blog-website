#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/myblog}"
FRONTEND_DIST="${FRONTEND_DIST:-$APP_ROOT/dist}"
DOCS_DIR="${DOCS_DIR:-$APP_ROOT/docs}"
IMAGE_DIR="${IMAGE_DIR:-$APP_ROOT/static/images}"
ATTACHMENT_DIR="${ATTACHMENT_DIR:-$APP_ROOT/static/attachments}"
APP_JAR="${APP_JAR:-$APP_ROOT/app.jar}"
APP_CONFIG="${APP_CONFIG:-$APP_ROOT/application.properties}"
APP_LOG="${APP_LOG:-$APP_ROOT/app.log}"
BACKEND_PORT="${BACKEND_PORT:-8081}"
BACKEND_CONTEXT_PATH="${BACKEND_CONTEXT_PATH:-/api}"
SERVICE_NAME="${SERVICE_NAME:-myblog}"
SERVER_NAME="${SERVER_NAME:-_}"
NGINX_CONF="${NGINX_CONF:-/etc/nginx/conf.d/myblog.conf}"
NGINX_BIN="${NGINX_BIN:-nginx}"
SKIP_BUILD="${SKIP_BUILD:-0}"
SKIP_NGINX="${SKIP_NGINX:-0}"
SKIP_DOCS="${SKIP_DOCS:-0}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$REPO_ROOT/frontend"
SERVER_DIR="$REPO_ROOT/server"
BUILT_JAR="$SERVER_DIR/target/myblog-server-1.0.0.jar"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing command: $1" >&2
    exit 1
  }
}

as_root() {
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

write_file_as_root() {
  local path="$1"
  local tmp
  tmp="$(mktemp)"
  cat > "$tmp"
  as_root install -m 0644 "$tmp" "$path"
  rm -f "$tmp"
}

sync_dir() {
  local src="$1"
  local dest="$2"
  as_root mkdir -p "$dest"
  if command -v rsync >/dev/null 2>&1; then
    as_root rsync -a --delete "$src"/ "$dest"/
  else
    as_root find "$dest" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
    as_root cp -a "$src"/. "$dest"/
  fi
}

build_artifacts() {
  if [[ "$SKIP_BUILD" == "1" ]]; then
    echo "Skip build"
    return
  fi

  require_cmd npm
  require_cmd mvn
  (cd "$FRONTEND_DIR" && npm run build)
  mvn clean package -DskipTests -q -f "$SERVER_DIR/pom.xml"
}

install_files() {
  [[ -f "$BUILT_JAR" ]] || {
    echo "Backend jar not found: $BUILT_JAR" >&2
    exit 1
  }

  as_root mkdir -p "$APP_ROOT" "$FRONTEND_DIST" "$DOCS_DIR" "$IMAGE_DIR" "$ATTACHMENT_DIR"
  sync_dir "$FRONTEND_DIR/dist" "$FRONTEND_DIST"
  if [[ "$SKIP_DOCS" != "1" && -d "$SERVER_DIR/docs" ]]; then
    sync_dir "$SERVER_DIR/docs" "$DOCS_DIR"
  fi
  if [[ -d "$SERVER_DIR/static/images" ]]; then
    sync_dir "$SERVER_DIR/static/images" "$IMAGE_DIR"
  fi
  if [[ -d "$SERVER_DIR/static/attachments" ]]; then
    sync_dir "$SERVER_DIR/static/attachments" "$ATTACHMENT_DIR"
  fi

  if [[ -f "$APP_JAR" ]]; then
    as_root cp "$APP_JAR" "$APP_JAR.bak"
  fi
  as_root install -m 0644 "$BUILT_JAR" "$APP_JAR"
}

ensure_app_config() {
  if [[ -f "$APP_CONFIG" ]]; then
    echo "Keep existing app config: $APP_CONFIG"
    return
  fi

  write_file_as_root "$APP_CONFIG" <<EOF_CONFIG
server.port=$BACKEND_PORT
server.servlet.context-path=$BACKEND_CONTEXT_PATH

spring.datasource.url=jdbc:mysql://localhost:3306/blog_db?useSSL=false&serverTimezone=UTC
spring.datasource.username=root
spring.datasource.password=change-me
spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver

spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=false
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.MySQLDialect

spring.data.redis.host=localhost
spring.data.redis.port=6379
spring.data.redis.database=0

app.jwt.secret=change-me
app.jwt.expiration=604800000
app.admin.password=change-me

app.site.name=博客
app.site.author=
app.docs.path=$DOCS_DIR
app.image.storage.path=$IMAGE_DIR
app.attachment.storage.path=$ATTACHMENT_DIR
app.frontend.dist.path=$FRONTEND_DIST
app.attachment.max.size=52428800
spring.servlet.multipart.max-file-size=50MB
spring.servlet.multipart.max-request-size=50MB

app.attachment.storage.location=CURRENT_FOLDER
app.attachment.subfolder.name=attachments
app.attachment.custom.path=
EOF_CONFIG

  echo "Created app config: $APP_CONFIG"
  echo "Edit database, JWT, and admin password values before exposing the site."
}

install_systemd_service() {
  local service_path="/etc/systemd/system/$SERVICE_NAME.service"
  write_file_as_root "$service_path" <<EOF_SERVICE
[Unit]
Description=My Blog Backend
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_ROOT
ExecStart=/usr/bin/java -Dfile.encoding=UTF-8 -jar $APP_JAR --spring.config.location=$APP_CONFIG
Restart=always
RestartSec=10
Environment=LANG=C.UTF-8
Environment=LC_ALL=C.UTF-8
StandardOutput=append:$APP_LOG
StandardError=append:$APP_LOG

[Install]
WantedBy=multi-user.target
EOF_SERVICE

  as_root systemctl daemon-reload
  as_root systemctl enable "$SERVICE_NAME.service"
  as_root systemctl restart "$SERVICE_NAME.service"
}

install_nginx_config() {
  if [[ "$SKIP_NGINX" == "1" ]]; then
    echo "Skip Nginx config"
    return
  fi

  local upstream="http://127.0.0.1:$BACKEND_PORT"
  write_file_as_root "$NGINX_CONF" <<EOF_NGINX
server {
    listen 80;
    server_name $SERVER_NAME;

    root $FRONTEND_DIST;
    index index.html;

    location = /robots.txt {
        proxy_pass $upstream$BACKEND_CONTEXT_PATH/robots.txt;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location = /sitemap.xml {
        proxy_pass $upstream$BACKEND_CONTEXT_PATH/sitemap.xml;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /articles/ {
        proxy_pass $upstream$BACKEND_CONTEXT_PATH/seo/articles/;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /api/static/images/ {
        alias $IMAGE_DIR/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location /api/static/attachments/ {
        alias $ATTACHMENT_DIR/;
    }

    location /api/docs-static/ {
        alias $DOCS_DIR/;
    }

    location /docs-static/ {
        alias $DOCS_DIR/;
    }

    location $BACKEND_CONTEXT_PATH/ {
        proxy_pass $upstream;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /static/images/ {
        alias $IMAGE_DIR/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location /static/attachments/ {
        alias $ATTACHMENT_DIR/;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF_NGINX

  as_root "$NGINX_BIN" -t
  as_root "$NGINX_BIN" -s reload
}

verify_deploy() {
  sleep 5
  as_root systemctl --no-pager --lines=20 status "$SERVICE_NAME.service" || true
  curl -fsS -o /dev/null "http://127.0.0.1:$BACKEND_PORT$BACKEND_CONTEXT_PATH/articles"
  echo "Deploy OK: http://127.0.0.1:$BACKEND_PORT$BACKEND_CONTEXT_PATH/articles"
}

main() {
  require_cmd java
  require_cmd curl
  build_artifacts
  install_files
  ensure_app_config
  install_systemd_service
  install_nginx_config
  verify_deploy
}

main "$@"
