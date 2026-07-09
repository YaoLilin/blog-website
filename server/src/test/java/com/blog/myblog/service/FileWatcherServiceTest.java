package com.blog.myblog.service;

import com.blog.myblog.entity.Article;
import com.blog.myblog.entity.Category;
import com.blog.myblog.repository.ArticleRepository;
import com.blog.myblog.repository.CategoryRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.util.ReflectionTestUtils;

import java.lang.reflect.Proxy;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardWatchEventKinds;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FileWatcherServiceTest {

    @TempDir
    private Path tempDir;

    @Test
    void syncFileWithCategoryPreservesExistingDatabaseTitle() throws Exception {
        Path articleFile = tempDir.resolve("server-file.md");
        Files.writeString(articleFile, "# Heading From File\ncontent");

        Article article = new Article();
        article.setId(1L);
        article.setTitle("Database Title");
        article.setFilePath(articleFile.toString());
        article.setIsServerManaged(true);

        TestArticleRepository articleRepository = new TestArticleRepository(article);
        FileWatcherService service = new FileWatcherService(articleRepository.proxy(), emptyCategoryRepository());
        ReflectionTestUtils.setField(service, "docsPath", tempDir.toString());

        ReflectionTestUtils.invokeMethod(service, "syncFileWithCategory", articleFile.toFile(), null);

        assertEquals("Database Title", article.getTitle());
        assertEquals("# Heading From File\ncontent", article.getContent());
    }

    @Test
    void syncFileWithCategoryDeletesDuplicateArticlesWithSamePath() throws Exception {
        Path articleFile = tempDir.resolve("server-file.md");
        Files.writeString(articleFile, "# Heading From File\ncontent");

        Article first = new Article();
        first.setId(1L);
        first.setTitle("First");
        first.setFilePath(articleFile.toString());
        first.setIsServerManaged(true);

        Article duplicate = new Article();
        duplicate.setId(2L);
        duplicate.setTitle("Duplicate");
        duplicate.setFilePath(articleFile.toString());
        duplicate.setIsServerManaged(true);

        TestArticleRepository articleRepository = new TestArticleRepository(first, duplicate);
        FileWatcherService service = new FileWatcherService(articleRepository.proxy(), emptyCategoryRepository());
        ReflectionTestUtils.setField(service, "docsPath", tempDir.toString());

        ReflectionTestUtils.invokeMethod(service, "syncFileWithCategory", articleFile.toFile(), null);

        assertEquals(List.of(duplicate), articleRepository.deletedArticles);
        assertEquals("# Heading From File\ncontent", first.getContent());
    }

    @Test
    void syncFileWithCategoryCollapsesLegacyDocsPathsIntoCurrentPath() throws Exception {
        Path docsRoot = tempDir.resolve("server/docs");
        Files.createDirectories(docsRoot);
        Path articleFile = docsRoot.resolve("泛微开发/README.md");
        Files.createDirectories(articleFile.getParent());
        Files.writeString(articleFile, "# 欢迎\ncontent");

        Article legacy = new Article();
        legacy.setId(1L);
        legacy.setTitle("欢迎");
        legacy.setFilePath(tempDir.resolve("old/docs/泛微开发/README.md").toString());
        legacy.setIsServerManaged(true);

        Article duplicate = new Article();
        duplicate.setId(2L);
        duplicate.setTitle("欢迎");
        duplicate.setFilePath(tempDir.resolve("older/docs/泛微开发/README.md").toString());
        duplicate.setIsServerManaged(true);

        TestArticleRepository articleRepository = new TestArticleRepository(legacy, duplicate);
        FileWatcherService service = new FileWatcherService(articleRepository.proxy(), emptyCategoryRepository());
        ReflectionTestUtils.setField(service, "docsPath", docsRoot.toString());

        ReflectionTestUtils.invokeMethod(service, "syncFileWithCategory", articleFile.toFile(), null);

        assertEquals(articleFile.toString(), legacy.getFilePath());
        assertEquals(List.of(duplicate), articleRepository.deletedArticles);
    }

    @Test
    void pruneEmptyServerCategoriesDeletesLinkedArticlesBeforeCategories() {
        Article article = new Article();
        article.setId(11L);
        article.setCategoryId(5L);
        article.setFilePath(tempDir.resolve("docs/obsolete/README.md").toString());
        article.setIsServerManaged(true);

        Category category = new Category();
        category.setId(5L);
        category.setFilePath("obsolete");
        category.setIsServerManaged(true);

        TestArticleRepository articleRepository = new TestArticleRepository(article);
        TestCategoryRepository categoryRepository = new TestCategoryRepository(category);
        FileWatcherService service = new FileWatcherService(articleRepository.proxy(), categoryRepository.proxy());
        ReflectionTestUtils.setField(service, "docsPath", tempDir.toString());

        ReflectionTestUtils.invokeMethod(service, "pruneEmptyServerCategories", "obsolete");

        assertEquals(List.of(article), articleRepository.deletedArticles);
        assertEquals(List.of(category), categoryRepository.deletedCategories);
    }

    @Test
    void handleFileEventIgnoresMacOsMetadataDeletion() throws Exception {
        TestArticleRepository articleRepository = new TestArticleRepository();
        TestCategoryRepository categoryRepository = new TestCategoryRepository();
        FileWatcherService service = new FileWatcherService(articleRepository.proxy(), categoryRepository.proxy());
        ReflectionTestUtils.setField(service, "docsPath", tempDir.toString());

        Path deletedMetadata = tempDir.resolve("泛微开发/._README.md");
        ReflectionTestUtils.invokeMethod(service, "handleFileEvent", StandardWatchEventKinds.ENTRY_DELETE, deletedMetadata);

        assertTrue(articleRepository.deletedArticles.isEmpty());
        assertTrue(categoryRepository.deletedCategories.isEmpty());
        assertEquals(0, articleRepository.findByPrefixCalls.get());
        assertEquals(0, categoryRepository.findByPathCalls.get());
    }

    @Test
    void handleFileEventDoesNotTreatRegularAttachmentDeletionAsCategoryDeletion() throws Exception {
        Category category = new Category();
        category.setId(5L);
        category.setFilePath("泛微开发");
        category.setIsServerManaged(true);

        TestArticleRepository articleRepository = new TestArticleRepository();
        TestCategoryRepository categoryRepository = new TestCategoryRepository(category);
        FileWatcherService service = new FileWatcherService(articleRepository.proxy(), categoryRepository.proxy());
        ReflectionTestUtils.setField(service, "docsPath", tempDir.toString());

        Path deletedAttachment = tempDir.resolve("泛微开发/files/demo.png");
        ReflectionTestUtils.invokeMethod(service, "handleFileEvent", StandardWatchEventKinds.ENTRY_DELETE, deletedAttachment);

        assertTrue(articleRepository.deletedArticles.isEmpty());
        assertTrue(categoryRepository.deletedCategories.isEmpty());
        assertEquals(0, articleRepository.findByPrefixCalls.get());
    }

    @Test
    void syncDirectorySkipsHiddenMarkdownMetadataFiles() throws Exception {
        Path docsRoot = tempDir.resolve("docs");
        Path categoryDir = docsRoot.resolve("泛微开发");
        Files.createDirectories(categoryDir);
        Files.writeString(categoryDir.resolve("README.md"), "# 欢迎\ncontent");
        Files.writeString(categoryDir.resolve("._README.md"), "not-utf8-looking-metadata");

        TestArticleRepository articleRepository = new TestArticleRepository();
        TestCategoryRepository categoryRepository = new TestCategoryRepository();
        FileWatcherService service = new FileWatcherService(articleRepository.proxy(), categoryRepository.proxy());
        ReflectionTestUtils.setField(service, "docsPath", docsRoot.toString());

        ReflectionTestUtils.invokeMethod(service, "syncDirectory", categoryDir.toFile(), null);

        assertEquals(1, articleRepository.articlesByPath.values().stream().mapToInt(List::size).sum());
        assertTrue(articleRepository.articlesByPath.keySet().stream().noneMatch(path -> path.contains("._README.md")));
    }

    private static CategoryRepository emptyCategoryRepository() {
        return (CategoryRepository) Proxy.newProxyInstance(
                CategoryRepository.class.getClassLoader(),
                new Class<?>[]{CategoryRepository.class},
                (proxy, method, args) -> defaultValue(method.getReturnType())
        );
    }

    private static Object defaultValue(Class<?> returnType) {
        if (returnType == Optional.class) {
            return Optional.empty();
        }
        if (!returnType.isPrimitive()) {
            return null;
        }
        if (returnType == boolean.class) {
            return false;
        }
        if (returnType == void.class) {
            return null;
        }
        return 0;
    }

    private static class TestArticleRepository {
        private final Map<String, List<Article>> articlesByPath = new HashMap<>();
        private final List<Article> deletedArticles = new ArrayList<>();
        private final AtomicInteger findByPrefixCalls = new AtomicInteger();

        private TestArticleRepository(Article... articles) {
            for (Article article : articles) {
                articlesByPath.computeIfAbsent(article.getFilePath(), key -> new ArrayList<>()).add(article);
            }
        }

        private ArticleRepository proxy() {
            return (ArticleRepository) Proxy.newProxyInstance(
                    ArticleRepository.class.getClassLoader(),
                    new Class<?>[]{ArticleRepository.class},
                    (proxy, method, args) -> {
                        if ("findByFilePath".equals(method.getName())) {
                            List<Article> articles = articlesByPath.get(args[0]);
                            return articles == null || articles.isEmpty() ? Optional.empty() : Optional.ofNullable(articles.get(0));
                        }
                        if ("findByFilePathOrderByIdAsc".equals(method.getName())) {
                            List<Article> articles = articlesByPath.get(args[0]);
                            if (articles == null) {
                                return List.of();
                            }
                            return articles.stream()
                                    .sorted((left, right) -> Long.compare(left.getId(), right.getId()))
                                    .toList();
                        }
                        if ("findAll".equals(method.getName())) {
                            return articlesByPath.values().stream().flatMap(List::stream).toList();
                        }
                        if ("findByFilePathStartingWith".equals(method.getName())) {
                            findByPrefixCalls.incrementAndGet();
                            String prefix = (String) args[0];
                            return articlesByPath.values().stream()
                                    .flatMap(List::stream)
                                    .filter(article -> article.getFilePath() != null && article.getFilePath().startsWith(prefix))
                                    .toList();
                        }
                        if ("save".equals(method.getName())) {
                            Article article = (Article) args[0];
                            articlesByPath.values().forEach(list ->
                                    list.removeIf(existing -> existing.getId() != null && existing.getId().equals(article.getId())));
                            List<Article> articles = articlesByPath.computeIfAbsent(article.getFilePath(), key -> new ArrayList<>());
                            articles.add(article);
                            return article;
                        }
                        if ("deleteAll".equals(method.getName())) {
                            @SuppressWarnings("unchecked")
                            Iterable<Article> toDelete = (Iterable<Article>) args[0];
                            for (Article article : toDelete) {
                                deletedArticles.add(article);
                                List<Article> articles = articlesByPath.get(article.getFilePath());
                                if (articles != null) {
                                    articles.removeIf(existing -> existing.getId() != null && existing.getId().equals(article.getId()));
                                }
                            }
                            return null;
                        }
                        return defaultValue(method.getReturnType());
                    }
            );
        }
    }

    private static class TestCategoryRepository {
        private final List<Category> categories = new ArrayList<>();
        private final List<Category> deletedCategories = new ArrayList<>();
        private final AtomicLong ids = new AtomicLong(1000);
        private final AtomicInteger findByPathCalls = new AtomicInteger();

        private TestCategoryRepository(Category... seed) {
            categories.addAll(List.of(seed));
        }

        private CategoryRepository proxy() {
            return (CategoryRepository) Proxy.newProxyInstance(
                    CategoryRepository.class.getClassLoader(),
                    new Class<?>[]{CategoryRepository.class},
                    (proxy, method, args) -> {
                        if ("findAll".equals(method.getName())) {
                            return new ArrayList<>(categories);
                        }
                        if ("delete".equals(method.getName())) {
                            Category category = (Category) args[0];
                            deletedCategories.add(category);
                            categories.removeIf(existing -> existing.getId() != null && existing.getId().equals(category.getId()));
                            return null;
                        }
                        if ("save".equals(method.getName())) {
                            Category category = (Category) args[0];
                            if (category.getId() == null) {
                                category.setId(ids.incrementAndGet());
                            }
                            categories.removeIf(existing -> existing.getId() != null && existing.getId().equals(category.getId()));
                            categories.add(category);
                            return category;
                        }
                        if ("findByFilePathAndIsServerManagedTrueOrderByIdAsc".equals(method.getName())) {
                            findByPathCalls.incrementAndGet();
                            String filePath = (String) args[0];
                            return categories.stream()
                                    .filter(category -> Boolean.TRUE.equals(category.getIsServerManaged()))
                                    .filter(category -> filePath.equals(category.getFilePath()))
                                    .sorted((left, right) -> Long.compare(left.getId(), right.getId()))
                                    .toList();
                        }
                        return defaultValue(method.getReturnType());
                    }
            );
        }
    }
}
