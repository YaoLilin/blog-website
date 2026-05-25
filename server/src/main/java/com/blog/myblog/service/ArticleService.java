package com.blog.myblog.service;

import com.blog.myblog.dto.ArticleDto;
import com.blog.myblog.entity.Article;
import com.blog.myblog.repository.ArticleRepository;
import com.blog.myblog.repository.CategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.net.URLDecoder;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.nio.file.attribute.BasicFileAttributes;
import java.nio.file.attribute.FileTime;

@Service
@RequiredArgsConstructor
public class ArticleService {

    // 匹配 Markdown 图片和链接：![alt](url) 或 [text](url "title")
    // group(1)=前缀方括号部分, group(2)=URL, group(3)=可选 title 及空白
    private static final Pattern MD_LINK_PATTERN = Pattern.compile(
            "(!?\\[[^\\]]*\\])\\(\\s*([^\\s)\"']+)((?:\\s+[\"'][^\"']*[\"'])?\\s*)\\)"
    );
    private static final String GENERATED_IMAGE_URL_PREFIX = "/api/static/images/generated/";

    @Value("${app.docs.path}")
    private String docsPath;

    @Value("${app.image.storage.path}")
    private String imageStoragePath;

    @Value("${app.attachment.storage.path}")
    private String attachmentStoragePath;

    private final ArticleRepository articleRepository;
    private final CategoryRepository categoryRepository;
    private final CategoryService categoryService;
    private final SystemSettingService systemSettingService;

    public Page<ArticleDto> getList(Long categoryId, int page, int size) {
        if (categoryId != null) {
            return articleRepository.findByCategoryId(categoryId, PageRequest.of(page, size)).map(this::toDto);
        }
        return articleRepository.findAll(PageRequest.of(page, size)).map(this::toDto);
    }

    public ArticleDto getById(Long id) {
        return toDto(articleRepository.findById(id).orElseThrow());
    }

    public ArticleDto getByFilePath(String path) {
        String filePath = resolveFilePath(path);
        return articleRepository.findByFilePath(filePath)
                .map(this::toDto)
                .orElseGet(() -> loadFromFile(filePath));
    }

    public List<ArticleDto> getRecommended() {
        String setting = systemSettingService.get("HOME_RECOMMENDED_ARTICLE_IDS", "").trim();
        if (!setting.isBlank()) {
            Map<Long, Article> map = articleRepository.findAll().stream()
                    .collect(Collectors.toMap(Article::getId, a -> a, (a, b) -> a, HashMap::new));
            List<ArticleDto> selected = new java.util.ArrayList<>();
            for (String part : setting.split(",")) {
                Long id = parseLongOrNull(part.trim());
                if (id == null) continue;
                Article article = map.get(id);
                if (article != null) {
                    selected.add(toDto(article));
                }
                if (selected.size() >= 30) break;
            }
            if (!selected.isEmpty()) {
                return selected;
            }
        }
        return articleRepository.findByIsRecommendedTrueOrderByCreatedAtDesc().stream()
                .map(this::toDto).limit(30).collect(Collectors.toList());
    }

    public List<ArticleDto> getRecent(int limit) {
        int safeLimit = Math.min(Math.max(limit, 1), 100);
        return articleRepository.findAll().stream()
                .map(this::toDto)
                .sorted((a, b) -> {
                    LocalDateTime left = a.getCreatedAt() != null ? a.getCreatedAt() : LocalDateTime.MIN;
                    LocalDateTime right = b.getCreatedAt() != null ? b.getCreatedAt() : LocalDateTime.MIN;
                    return right.compareTo(left);
                })
                .limit(safeLimit)
                .collect(Collectors.toList());
    }

    public List<ArticleDto> search(String keyword, boolean titleOnly) {
        List<Article> articles = titleOnly
                ? articleRepository.searchByTitle(keyword)
                : articleRepository.searchByTitleOrContent(keyword);
        return articles.stream()
                .map(this::toDto).collect(Collectors.toList());
    }

    @Transactional
    public ArticleDto create(ArticleDto dto) {
        Article article = new Article();
        article.setTitle(dto.getTitle());
        article.setContent(dto.getContent() != null ? dto.getContent() : "");
        article.setCategoryId(dto.getCategoryId());
        article.setIsRecommended(dto.getIsRecommended() != null ? dto.getIsRecommended() : false);
        article.setIsServerManaged(false);
        return toDto(articleRepository.save(article));
    }

    @Transactional
    public ArticleDto update(Long id, ArticleDto dto) {
        Article article = articleRepository.findById(id).orElseThrow();
        if (dto.getTitle() != null) {
            if (Boolean.TRUE.equals(article.getIsServerManaged()) && article.getFilePath() != null) {
                renameServerManagedFile(article, dto.getTitle());
            } else {
                article.setTitle(dto.getTitle());
            }
        }
        if (dto.getContent() != null) {
            if (Boolean.TRUE.equals(article.getIsServerManaged()) && article.getFilePath() != null) {
                String migratedContent = relocateServerManagedMedia(dto.getContent(), article.getFilePath());
                article.setContent(migratedContent);
                syncToFile(article);
            } else {
                article.setContent(dto.getContent());
            }
        }
        if (dto.getCategoryId() != null) article.setCategoryId(dto.getCategoryId());
        if (dto.getIsRecommended() != null) article.setIsRecommended(dto.getIsRecommended());
        return toDto(articleRepository.save(article));
    }

    @Transactional
    public void delete(Long id) {
        articleRepository.deleteById(id);
    }

    private void syncToFile(Article article) {
        try {
            java.io.File file = new java.io.File(article.getFilePath());
            if (file.getParentFile() != null) file.getParentFile().mkdirs();
            String content = revertDocsAbsolutePaths(article.getContent(), article.getFilePath());
            java.nio.file.Files.writeString(file.toPath(), content);
        } catch (Exception e) {
            // 同步失败不影响数据库操作
        }
    }

    /**
     * 把编辑态里上传到 /api/static/images 或 /api/static/attachments 的文件，
     * 迁移到服务器文档目录下，再把 markdown 链接改成相对路径。
     */
    private String relocateServerManagedMedia(String content, String filePath) {
        if (content == null || filePath == null) return content;

        Path articleDir = Path.of(filePath).getParent();
        if (articleDir == null) return content;

        Path targetDir = resolveAttachmentTargetDir(articleDir);
        if (targetDir == null) return content;

        Path docsRoot = Path.of(docsPath).normalize();
        Path articleDirPath = articleDir.toAbsolutePath().normalize();
        Path targetDirPath = targetDir.toAbsolutePath().normalize();

        Matcher matcher = MD_LINK_PATTERN.matcher(content);
        StringBuilder sb = new StringBuilder();
        Map<String, String> moved = new HashMap<>();

        while (matcher.find()) {
            String bracket = matcher.group(1);
            String href = matcher.group(2);
            String tail = matcher.group(3);
            String newHref = href;

            String sourcePrefix = null;
            Path sourceRoot = null;
            if (href.startsWith("/api/static/images/")) {
                sourcePrefix = "/api/static/images/";
                sourceRoot = Path.of(imageStoragePath).normalize();
            } else if (href.startsWith("/api/static/attachments/")) {
                sourcePrefix = "/api/static/attachments/";
                sourceRoot = Path.of(attachmentStoragePath).normalize();
            }

            if (sourcePrefix != null && sourceRoot != null) {
                String sourceRel = href.substring(sourcePrefix.length());
                String cacheKey = sourcePrefix + sourceRel;
                String cached = moved.get(cacheKey);
                if (cached != null) {
                    newHref = cached;
                } else {
                    try {
                        Path sourcePath = sourceRoot.resolve(sourceRel).normalize();
                        if (Files.exists(sourcePath)) {
                            String fileName = sourcePath.getFileName().toString();
                            Path destPath = targetDirPath.resolve(fileName).normalize();
                            Files.createDirectories(destPath.getParent());
                            Files.move(sourcePath, destPath, StandardCopyOption.REPLACE_EXISTING);
                            String relative = articleDirPath.relativize(destPath).toString().replace("\\", "/");
                            newHref = relative;
                            moved.put(cacheKey, newHref);
                        }
                    } catch (Exception e) {
                        // 迁移失败时保留原链接
                    }
                }
            }

            matcher.appendReplacement(sb, Matcher.quoteReplacement(bracket + "(" + newHref + tail + ")"));
        }
        matcher.appendTail(sb);
        return sb.toString();
    }

    private Path resolveAttachmentTargetDir(Path articleDir) {
        String location = systemSettingService.get("ATTACHMENT_STORAGE_LOCATION", "CURRENT_FOLDER");
        String customPath = systemSettingService.get("ATTACHMENT_CUSTOM_PATH", "").trim();

        return switch (location) {
            case "ROOT" -> Path.of(docsPath).normalize();
            case "SUBFOLDER", "CUSTOM_PATH" -> resolveRelativePath(articleDir, customPath);
            case "CURRENT_FOLDER" -> articleDir;
            default -> articleDir;
        };
    }

    private Path resolveRelativePath(Path articleDir, String customPath) {
        if (customPath == null || customPath.isBlank()) {
            return articleDir;
        }
        String normalized = customPath.replace("\\", "/").trim();
        if (normalized.startsWith("/")) {
            normalized = normalized.substring(1);
        }
        if (normalized.isBlank()) {
            return articleDir;
        }
        Path path = Path.of(normalized);
        if (path.isAbsolute()) {
            return path.normalize();
        }
        return articleDir.resolve(path).normalize();
    }

    /**
     * 把内容中 /api/docs-static/... 绝对路径还原为相对路径，保持磁盘文件的可移植性。
     */
    private String revertDocsAbsolutePaths(String content, String filePath) {
        if (content == null || filePath == null) return content;
        java.io.File articleFile = new java.io.File(filePath);
        if (articleFile.getParentFile() == null) return content;
        Path articleDir = articleFile.getParentFile().toPath().normalize();
        Path docsRoot = Path.of(docsPath).normalize();

        Matcher matcher = MD_LINK_PATTERN.matcher(content);
        StringBuilder sb = new StringBuilder();
        while (matcher.find()) {
            String bracket = matcher.group(1);
            String href   = matcher.group(2);
            String tail   = matcher.group(3);
            if (href.startsWith("/api/docs-static/")) {
                String rel = href.substring("/api/docs-static/".length());
                try {
                    Path absPath = docsRoot.resolve(rel).normalize();
                    String relPath = articleDir.relativize(absPath).toString().replace("\\", "/");
                    matcher.appendReplacement(sb, Matcher.quoteReplacement(bracket + "(" + relPath + tail + ")"));
                } catch (Exception e) {
                    matcher.appendReplacement(sb, Matcher.quoteReplacement(matcher.group(0)));
                }
            } else {
                matcher.appendReplacement(sb, Matcher.quoteReplacement(matcher.group(0)));
            }
        }
        matcher.appendTail(sb);
        return sb.toString();
    }

    private void renameServerManagedFile(Article article, String newTitle) {
        if (newTitle == null || newTitle.isBlank()) return;
        String oldFilePath = article.getFilePath();
        if (oldFilePath == null) {
            article.setTitle(newTitle);
            return;
        }

        try {
            String cleanTitle = newTitle.trim().replaceAll("[\\\\/]", "");
            Path oldPath = Path.of(oldFilePath);
            String fileName = oldPath.getFileName().toString();
            int dot = fileName.lastIndexOf('.');
            String ext = dot >= 0 ? fileName.substring(dot) : ".md";
            String newFileName = cleanTitle.endsWith(ext) ? cleanTitle : cleanTitle + ext;
            Path target = oldPath.resolveSibling(newFileName);

            if (oldPath.equals(target)) {
                article.setTitle(cleanTitle);
                article.setFilePath(target.toString());
                return;
            }

            if (Files.exists(oldPath)) {
                Files.move(oldPath, target, StandardCopyOption.REPLACE_EXISTING);
            } else if (article.getContent() != null) {
                Files.writeString(target, article.getContent());
            }
            article.setTitle(cleanTitle);
            article.setFilePath(target.toString());
        } catch (Exception e) {
            // 仅重命名失败时保留旧路径，避免中断数据库更新
        }
    }

    /**
     * 将服务器文档中的相对路径替换为可通过 /api/docs-static/** 访问的绝对路径。
     * 仅处理相对路径（不以 http/https// 开头）。
     */
    private String resolveDocsRelativePaths(String content, String filePath) {
        if (content == null || filePath == null) return content;
        File articleDir = new File(filePath).getParentFile();
        if (articleDir == null) return content;

        Path docsRoot = Path.of(docsPath).normalize();
        Path articleDirPath = articleDir.toPath().normalize();

        Matcher matcher = MD_LINK_PATTERN.matcher(content);
        StringBuilder sb = new StringBuilder();
        while (matcher.find()) {
            String bracket = matcher.group(1);
            String href = matcher.group(2);
            String tail = matcher.group(3);
            String normalizedHref = normalizeHref(href);

            if (normalizedHref.startsWith("http://") || normalizedHref.startsWith("https://")
                    || normalizedHref.startsWith("/") || normalizedHref.startsWith("#")
                    || normalizedHref.startsWith("mailto:")
                    || normalizedHref.startsWith("data:")
                    || normalizedHref.startsWith("blob:")) {
                matcher.appendReplacement(sb, Matcher.quoteReplacement(matcher.group(0)));
                continue;
            }

            try {
                Path resolved = articleDirPath.resolve(normalizedHref).normalize();
                if (resolved.startsWith(docsRoot)) {
                    String relative = docsRoot.relativize(resolved).toString().replace("\\", "/");
                    String newHref = "/api/docs-static/" + relative;
                    matcher.appendReplacement(sb, Matcher.quoteReplacement(bracket + "(" + newHref + tail + ")"));
                } else {
                    matcher.appendReplacement(sb, Matcher.quoteReplacement(matcher.group(0)));
                }
            } catch (Exception e) {
                matcher.appendReplacement(sb, Matcher.quoteReplacement(matcher.group(0)));
            }
        }
        matcher.appendTail(sb);
        return sb.toString();
    }

    private String prepareMarkdownContent(String content, String filePath) {
        String prepared = cacheBase64Images(content);
        if (filePath == null) {
            return prepared;
        }
        return resolveDocsRelativePaths(prepared, filePath);
    }

    private String cacheBase64Images(String content) {
        if (content == null) return null;

        Matcher matcher = MD_LINK_PATTERN.matcher(content);
        StringBuilder sb = new StringBuilder();
        Map<String, String> cache = new HashMap<>();

        while (matcher.find()) {
            String bracket = matcher.group(1);
            String href = matcher.group(2);
            String tail = matcher.group(3);
            String normalizedHref = normalizeHref(href);

            if (bracket.startsWith("!") && normalizedHref.startsWith("data:image/")) {
                String cachedUrl = cache.computeIfAbsent(normalizedHref, this::cacheBase64Image);
                if (cachedUrl != null) {
                    matcher.appendReplacement(sb, Matcher.quoteReplacement(bracket + "(" + cachedUrl + tail + ")"));
                    continue;
                }
            }

            matcher.appendReplacement(sb, Matcher.quoteReplacement(matcher.group(0)));
        }

        matcher.appendTail(sb);
        return sb.toString();
    }

    private String cacheBase64Image(String dataUri) {
        try {
            int comma = dataUri.indexOf(',');
            if (comma < 0) return null;

            String meta = dataUri.substring(5, comma);
            if (!meta.contains(";base64")) return null;

            String mimeType = meta.substring(0, meta.indexOf(';'));
            String base64 = dataUri.substring(comma + 1).replaceAll("\\s+", "");
            byte[] bytes = Base64.getDecoder().decode(base64);
            String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
            String ext = extensionForMimeType(mimeType);

            Path dir = Path.of(imageStoragePath, "generated");
            Files.createDirectories(dir);

            String fileName = hash.substring(0, 24) + ext;
            Path target = dir.resolve(fileName);
            if (!Files.exists(target)) {
                Files.write(target, bytes);
            }

            return GENERATED_IMAGE_URL_PREFIX + fileName;
        } catch (IOException | NoSuchAlgorithmException | IllegalArgumentException e) {
            return null;
        }
    }

    private String extensionForMimeType(String mimeType) {
        String type = mimeType == null ? "" : mimeType.toLowerCase();
        return switch (type) {
            case "image/jpeg", "image/jpg" -> ".jpg";
            case "image/png" -> ".png";
            case "image/gif" -> ".gif";
            case "image/webp" -> ".webp";
            case "image/bmp" -> ".bmp";
            case "image/svg+xml" -> ".svg";
            default -> ".png";
        };
    }

    private String normalizeHref(String href) {
        return href.replaceFirst("^\\./", "").replaceFirst("^\\.\\\\", "");
    }

    private String resolveFilePath(String path) {
        if (path == null || path.isBlank()) return path;
        path = decodePath(path);
        if (path.startsWith("/api/docs-static/")) {
            return Path.of(docsPath, path.substring("/api/docs-static/".length())).normalize().toString();
        }
        if (path.startsWith("/docs-static/")) {
            return Path.of(docsPath, path.substring("/docs-static/".length())).normalize().toString();
        }
        return path;
    }

    private String decodePath(String path) {
        String value = path;
        for (int i = 0; i < 3; i++) {
            try {
                String next = URLDecoder.decode(value, StandardCharsets.UTF_8);
                if (next.equals(value)) break;
                value = next;
            } catch (Exception e) {
                break;
            }
        }
        return value;
    }

    private ArticleDto loadFromFile(String filePath) {
        try {
            File file = new File(filePath);
            if (!file.exists() || !file.isFile()) {
                throw new IllegalArgumentException("文件不存在");
            }
            String content = Files.readString(file.toPath(), StandardCharsets.UTF_8);
            LocalDateTime fileCreatedAt = resolveFileCreatedAt(file.toPath());
            ArticleDto dto = new ArticleDto();
            dto.setId(null);
            dto.setTitle(stripExtension(file.getName()));
            dto.setContent(prepareMarkdownContent(content, filePath));
            dto.setFilePath(filePath);
            dto.setIsServerManaged(true);
            dto.setViewCount(0);
            dto.setCreatedAt(fileCreatedAt);
            dto.setUpdatedAt(fileCreatedAt);
            return dto;
        } catch (Exception e) {
            throw new IllegalArgumentException("文件不存在");
        }
    }

    private String extractTitle(String filename, String content) {
        String[] lines = content.split("\n");
        for (String line : lines) {
            if (line.startsWith("# ")) return line.substring(2).trim();
        }
        return stripExtension(filename);
    }

    private String stripExtension(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot > 0 ? filename.substring(0, dot) : filename;
    }

    public ArticleDto toDto(Article article) {
        ArticleDto dto = new ArticleDto();
        dto.setId(article.getId());
        dto.setTitle(Boolean.TRUE.equals(article.getIsServerManaged()) && article.getFilePath() != null
                ? stripExtension(new File(article.getFilePath()).getName())
                : article.getTitle());

        String content = article.getContent();
        content = prepareMarkdownContent(content, article.getFilePath());
        dto.setContent(content);
        dto.setCategoryId(article.getCategoryId());
        dto.setFilePath(article.getFilePath());
        dto.setViewCount(article.getViewCount());
        dto.setHelpfulCount(article.getHelpfulCount());
        dto.setIsRecommended(article.getIsRecommended());
        dto.setIsServerManaged(article.getIsServerManaged());
        dto.setCreatedAt(Boolean.TRUE.equals(article.getIsServerManaged()) && article.getFilePath() != null
                ? resolveFileCreatedAt(Path.of(article.getFilePath()))
                : article.getCreatedAt());
        dto.setUpdatedAt(article.getUpdatedAt());
        if (article.getCategory() != null) {
            dto.setCategory(categoryService.toDto(article.getCategory()));
        } else if (article.getCategoryId() != null) {
            categoryRepository.findById(article.getCategoryId())
                    .ifPresent(c -> dto.setCategory(categoryService.toDto(c)));
        }
        return dto;
    }

    private LocalDateTime resolveFileCreatedAt(Path filePath) {
        try {
            if (!Files.exists(filePath)) {
                return LocalDateTime.now();
            }
            BasicFileAttributes attrs = Files.readAttributes(filePath, BasicFileAttributes.class);
            FileTime fileTime = attrs.creationTime();
            if (fileTime == null || fileTime.toMillis() <= 0) {
                fileTime = attrs.lastModifiedTime();
            }
            return LocalDateTime.ofInstant(fileTime.toInstant(), java.time.ZoneId.systemDefault());
        } catch (Exception e) {
            return LocalDateTime.now();
        }
    }

    private Long parseLongOrNull(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return Long.valueOf(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
