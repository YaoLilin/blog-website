package com.blog.myblog.service;

import com.blog.myblog.entity.Article;
import com.blog.myblog.entity.Category;
import com.blog.myblog.repository.ArticleRepository;
import com.blog.myblog.repository.CategoryRepository;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Slf4j
@Service
@RequiredArgsConstructor
public class FileWatcherService {

    @Value("${app.docs.path}")
    private String docsPath;

    private final ArticleRepository articleRepository;
    private final CategoryRepository categoryRepository;

    private WatchService watchService;
    private ExecutorService executor;

    @PostConstruct
    public void start() {
        File docsDir = new File(docsPath);
        if (!docsDir.exists()) {
            log.info("文档目录不存在，文件监听未启动: {}", docsPath);
            return;
        }
        try {
            watchService = FileSystems.getDefault().newWatchService();
            executor = Executors.newSingleThreadExecutor(r -> {
                Thread t = new Thread(r, "file-watcher");
                t.setDaemon(true);
                return t;
            });
            registerAll(docsDir.toPath());
            rescan();
            executor.submit(this::watchLoop);
            log.info("文件监听已启动: {}", docsPath);
        } catch (IOException e) {
            log.error("文件监听启动失败", e);
        }
    }

    @PreDestroy
    public void stop() {
        if (executor != null) executor.shutdownNow();
        if (watchService != null) {
            try { watchService.close(); } catch (IOException ignored) {}
        }
    }

    private void registerAll(Path start) throws IOException {
        Files.walkFileTree(start, new SimpleFileVisitor<>() {
            @Override
            public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) throws IOException {
                dir.register(watchService, StandardWatchEventKinds.ENTRY_CREATE,
                        StandardWatchEventKinds.ENTRY_MODIFY, StandardWatchEventKinds.ENTRY_DELETE);
                return FileVisitResult.CONTINUE;
            }
        });
    }

    private void watchLoop() {
        while (!Thread.currentThread().isInterrupted()) {
            try {
                WatchKey key = watchService.take();
                Path dir = (Path) key.watchable();
                for (WatchEvent<?> event : key.pollEvents()) {
                    WatchEvent.Kind<?> kind = event.kind();
                    if (kind == StandardWatchEventKinds.OVERFLOW) continue;
                    @SuppressWarnings("unchecked")
                    Path changed = dir.resolve(((WatchEvent<Path>) event).context());
                    handleFileEvent(kind, changed);
                }
                key.reset();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
    }

    private void handleFileEvent(WatchEvent.Kind<?> kind, Path path) {
        File file = path.toFile();
        if (kind == StandardWatchEventKinds.ENTRY_CREATE || kind == StandardWatchEventKinds.ENTRY_MODIFY) {
            if (file.isDirectory()) {
                try { registerAll(path); } catch (IOException ignored) {}
                syncDirectory(file, null);
            } else if (file.getName().endsWith(".md")) {
                File parent = file.getParentFile();
                if (parent != null) {
                    syncDirectory(parent, null);
                }
            }
        } else if (kind == StandardWatchEventKinds.ENTRY_DELETE) {
            log.info("文件已删除: {}", path);
            String absolutePath = file.getAbsolutePath();
            if (file.getName().endsWith(".md")) {
                articleRepository.findByFilePath(absolutePath).ifPresent(article -> {
                    articleRepository.delete(article);
                    log.info("已同步删除文章: {}", article.getTitle());
                });
            } else {
                List<Article> orphaned = articleRepository.findByFilePathStartingWith(absolutePath + "/");
                if (!orphaned.isEmpty()) {
                    articleRepository.deleteAll(orphaned);
                    log.info("已同步删除目录下的 {} 篇文章", orphaned.size());
                }
                String relativePath = toRelativePath(file);
                pruneEmptyServerCategories(relativePath);
                log.info("已同步删除分类及子分类: {}", relativePath);
            }
            File parent = file.getParentFile();
            if (parent != null) {
                syncDirectory(parent, null);
            }
        }
    }

    public void rescan() {
        syncDirectory(new File(docsPath), null);
    }

    public void fullSync() {
        syncDirectory(new File(docsPath), null);
        List<Article> all = articleRepository.findAll();
        List<Article> orphans = new java.util.ArrayList<>();
        for (Article a : all) {
            if (!Boolean.TRUE.equals(a.getIsServerManaged()) || a.getFilePath() == null) continue;
            try {
                if (!java.nio.file.Files.exists(java.nio.file.Path.of(a.getFilePath()))) {
                    orphans.add(a);
                }
            } catch (Exception e) {
                orphans.add(a);
            }
        }
        if (!orphans.isEmpty()) {
            articleRepository.deleteAll(orphans);
            log.info("全量同步完成，清理了 {} 篇已删除文件的文章", orphans.size());
        } else {
            log.info("全量同步完成，无孤立文章");
        }

        List<Category> orphanCats = categoryRepository.findAll().stream()
                .filter(c -> Boolean.TRUE.equals(c.getIsServerManaged()))
                .filter(c -> c.getFilePath() != null)
                .filter(c -> {
                    File dir = new File(docsPath, c.getFilePath());
                    return !dir.exists() || !dir.isDirectory();
                })
                .sorted((a, b) -> Integer.compare(
                        b.getFilePath() == null ? 0 : b.getFilePath().length(),
                        a.getFilePath() == null ? 0 : a.getFilePath().length()))
                .toList();
        if (!orphanCats.isEmpty()) {
            categoryRepository.deleteAll(orphanCats);
            log.info("全量同步完成，清理了 {} 个已删除目录的分类", orphanCats.size());
        }
    }

    public void registerDirectoryTree(Path start) throws IOException {
        registerAll(start);
    }

    private void syncDirectory(File dir, Long parentCategoryId) {
        if (!dir.exists() || !dir.isDirectory()) return;
        String dirName = dir.getName();
        if (dirName.startsWith(".")) return;

        Long catId = parentCategoryId;
        if (!dir.getAbsolutePath().equals(docsPath)) {
            String relativePath = toRelativePath(dir);
            if (!containsMarkdown(dir)) {
                pruneEmptyServerCategories(relativePath);
                return;
            }
            Category cat = categoryRepository.findByFilePathAndIsServerManagedTrueOrderByIdAsc(relativePath)
                    .stream()
                    .findFirst()
                    .orElseGet(() -> createServerCategory(dirName, relativePath, parentCategoryId));
            catId = cat.getId();
        }

        File[] files = dir.listFiles();
        if (files == null) return;
        final Long finalCatId = catId;
        for (File f : files) {
            if (f.isDirectory() && !f.getName().startsWith(".")) {
                syncDirectory(f, finalCatId);
            } else if (f.isFile() && f.getName().endsWith(".md")) {
                syncFileWithCategory(f, finalCatId);
            }
        }
    }

    private boolean containsMarkdown(File dir) {
        File[] files = dir.listFiles();
        if (files == null) return false;
        for (File f : files) {
            if (f.getName().startsWith(".")) continue;
            if (f.isFile() && f.getName().endsWith(".md")) return true;
            if (f.isDirectory() && containsMarkdown(f)) return true;
        }
        return false;
    }

    private void pruneEmptyServerCategories(String relativePath) {
        String prefix = relativePath + "/";
        categoryRepository.findAll().stream()
                .filter(c -> Boolean.TRUE.equals(c.getIsServerManaged()))
                .filter(c -> relativePath.equals(c.getFilePath()) || (c.getFilePath() != null && c.getFilePath().startsWith(prefix)))
                .sorted((a, b) -> Integer.compare(
                        b.getFilePath() == null ? 0 : b.getFilePath().length(),
                        a.getFilePath() == null ? 0 : a.getFilePath().length()))
                .forEach(categoryRepository::delete);
    }

    private Category createServerCategory(String name, String relativePath, Long parentCategoryId) {
        Category newCat = new Category();
        newCat.setName(name);
        newCat.setFilePath(relativePath);
        newCat.setParentId(parentCategoryId);
        newCat.setIsServerManaged(true);
        newCat.setSortOrder(0);
        return categoryRepository.save(newCat);
    }

    private String toRelativePath(File dir) {
        return docsPath.endsWith(File.separator)
                ? dir.getAbsolutePath().substring(docsPath.length()).replaceAll("^[/\\\\]", "")
                : dir.getAbsolutePath().replace(docsPath, "").replaceAll("^[/\\\\]", "");
    }

    private void syncFile(File file) {
        String path = file.getAbsolutePath();
        try {
            String content = Files.readString(file.toPath());
            String title = extractTitle(file.getName(), content);
            LocalDateTime fileModified = LocalDateTime.ofInstant(
                    Files.getLastModifiedTime(file.toPath()).toInstant(), ZoneId.systemDefault());

            articleRepository.findByFilePath(path).ifPresentOrElse(article -> {
                try {
                    if (article.getUpdatedAt() == null || fileModified.isAfter(article.getUpdatedAt())) {
                        article.setContent(content);
                        article.setTitle(title);
                        articleRepository.save(article);
                        log.info("已从文件同步文章: {}", title);
                    }
                } catch (Exception e) {
                    log.error("同步文章失败: {}", path, e);
                }
            }, () -> syncFileWithCategory(file, null));
        } catch (IOException e) {
            log.error("读取文件失败: {}", path, e);
        }
    }

    private void syncFileWithCategory(File file, Long categoryId) {
        String path = file.getAbsolutePath();
        try {
            String content = Files.readString(file.toPath());
            String title = extractTitle(file.getName(), content);
            articleRepository.findByFilePath(path).ifPresentOrElse(article -> {
                try {
                    article.setContent(content);
                    article.setTitle(title);
                    articleRepository.save(article);
                } catch (Exception e) {
                    log.error("更新文章失败: {}", path, e);
                }
            }, () -> {
                try {
                    Article article = new Article();
                    article.setTitle(title);
                    article.setContent(content);
                    article.setCategoryId(categoryId);
                    article.setIsServerManaged(true);
                    article.setFilePath(path);
                    articleRepository.save(article);
                    log.info("从文件导入新文章: {}", title);
                } catch (Exception e) {
                    log.error("导入文章失败: {}", path, e);
                }
            });
        } catch (IOException e) {
            log.error("读取文件失败: {}", path, e);
        }
    }

    private String extractTitle(String filename, String content) {
        String[] lines = content.split("\n");
        for (String line : lines) {
            if (line.startsWith("# ")) return line.substring(2).trim();
        }
        return filename.replace(".md", "");
    }
}
