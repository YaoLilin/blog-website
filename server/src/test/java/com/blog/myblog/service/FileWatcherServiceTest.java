package com.blog.myblog.service;

import com.blog.myblog.entity.Article;
import com.blog.myblog.repository.ArticleRepository;
import com.blog.myblog.repository.CategoryRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.util.ReflectionTestUtils;

import java.lang.reflect.Proxy;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;

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
                        if ("save".equals(method.getName())) {
                            Article article = (Article) args[0];
                            List<Article> articles = articlesByPath.computeIfAbsent(article.getFilePath(), key -> new ArrayList<>());
                            articles.removeIf(existing -> existing.getId() != null && existing.getId().equals(article.getId()));
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
}
