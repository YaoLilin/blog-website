-- 创建数据库
CREATE DATABASE IF NOT EXISTS blog_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE blog_db;

-- 分类表(支持多级分类)
CREATE TABLE IF NOT EXISTS category (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    parent_id BIGINT,
    cover_image VARCHAR(255),
    sort_order INT DEFAULT 0,
    is_server_managed BOOLEAN DEFAULT FALSE,
    file_path VARCHAR(1000) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES category(id) ON DELETE SET NULL,
    INDEX idx_parent_id (parent_id)
);

-- 文章表
CREATE TABLE IF NOT EXISTS article (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    content LONGTEXT NOT NULL,
    category_id BIGINT NOT NULL,
    file_path VARCHAR(1000),
    view_count INT DEFAULT 0,
    is_recommended BOOLEAN DEFAULT FALSE,
    is_server_managed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES category(id) ON DELETE CASCADE,
    INDEX idx_category_id (category_id),
    INDEX idx_is_recommended (is_recommended),
    INDEX idx_created_at (created_at)
);

-- 图片表
CREATE TABLE IF NOT EXISTS image (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    article_id BIGINT,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES article(id) ON DELETE SET NULL,
    INDEX idx_article_id (article_id)
);

-- 附件表
CREATE TABLE IF NOT EXISTS attachment (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    article_id BIGINT NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES article(id) ON DELETE CASCADE,
    INDEX idx_article_id (article_id)
);

-- 阅读统计表(去重统计)
CREATE TABLE IF NOT EXISTS view_record (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    article_id BIGINT NOT NULL,
    fingerprint VARCHAR(64) NOT NULL,
    view_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_view (article_id, fingerprint, view_date),
    FOREIGN KEY (article_id) REFERENCES article(id) ON DELETE CASCADE,
    INDEX idx_article_id (article_id),
    INDEX idx_view_date (view_date)
);

-- 系统设置表
CREATE TABLE IF NOT EXISTS system_setting (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT,
    setting_type VARCHAR(50) NOT NULL,
    description VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 插入默认座右铭
INSERT IGNORE INTO system_setting (setting_key, setting_value, setting_type, description)
VALUES ('MOTTO', '我们得为人类做点什么', 'STRING', '首页显示的座右铭');

-- 插入默认博客名称
INSERT IGNORE INTO system_setting (setting_key, setting_value, setting_type, description)
VALUES ('BLOG_NAME', '', 'STRING', '博客名称');

-- 插入默认附件存储位置设置
INSERT IGNORE INTO system_setting (setting_key, setting_value, setting_type, description)
VALUES ('ATTACHMENT_STORAGE_LOCATION', 'CURRENT_FOLDER', 'STRING', '附件存储位置配置');

INSERT IGNORE INTO system_setting (setting_key, setting_value, setting_type, description)
VALUES ('ATTACHMENT_CUSTOM_PATH', '', 'STRING', '附件自定义子路径配置');

INSERT IGNORE INTO system_setting (setting_key, setting_value, setting_type, description)
VALUES ('HOME_RECOMMENDED_CATEGORY_IDS', '', 'STRING', '首页推荐分类ID列表');

INSERT IGNORE INTO system_setting (setting_key, setting_value, setting_type, description)
VALUES ('HOME_RECOMMENDED_ARTICLE_IDS', '', 'STRING', '首页推荐文章ID列表');

INSERT IGNORE INTO system_setting (setting_key, setting_value, setting_type, description)
VALUES ('PROFILE_IMAGE', '', 'STRING', '个人介绍图片URL');

INSERT IGNORE INTO system_setting (setting_key, setting_value, setting_type, description)
VALUES ('PROFILE_CONTENT', '', 'STRING', '个人介绍内容（Markdown）');

-- 网站访问统计表
CREATE TABLE IF NOT EXISTS site_visit_record (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    visit_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_visit_date (visit_date)
);

-- 有帮助投票表
CREATE TABLE IF NOT EXISTS helpful_vote (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    article_id BIGINT NOT NULL,
    fingerprint VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_helpful_vote (article_id, fingerprint),
    FOREIGN KEY (article_id) REFERENCES article(id) ON DELETE CASCADE,
    INDEX idx_article_id (article_id)
);

ALTER TABLE article ADD COLUMN IF NOT EXISTS helpful_count INT DEFAULT 0;
