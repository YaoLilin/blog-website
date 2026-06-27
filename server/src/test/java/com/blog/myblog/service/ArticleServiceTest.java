package com.blog.myblog.service;

import com.blog.myblog.dto.ArticleDto;
import com.blog.myblog.entity.Article;
import com.blog.myblog.repository.ArticleRepository;
import com.blog.myblog.repository.CategoryRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.util.ReflectionTestUtils;

import java.lang.reflect.Proxy;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ArticleServiceTest {

    @TempDir
    private Path tempDir;

    @Test
    void updateServerManagedTitleKeepsOriginalFileName() throws Exception {
        Path articleFile = tempDir.resolve("old-name.md");
        Files.writeString(articleFile, "# Heading\ncontent");

        Article article = new Article();
        article.setId(1L);
        article.setTitle("Old Title");
        article.setFilePath(articleFile.toString());
        article.setIsServerManaged(true);

        TestArticleRepository articleRepository = new TestArticleRepository(article);
        ArticleService service = new ArticleService(
                articleRepository.proxy(),
                emptyCategoryRepository(),
                null,
                null
        );
        ReflectionTestUtils.setField(service, "docsPath", tempDir.toString());

        ArticleDto dto = new ArticleDto();
        dto.setTitle("New Database Title");

        ArticleDto updated = service.update(1L, dto);

        assertEquals("New Database Title", updated.getTitle());
        assertEquals(articleFile.toString(), article.getFilePath());
        assertTrue(Files.exists(articleFile));
        assertFalse(Files.exists(tempDir.resolve("New Database Title.md")));
    }

    @Test
    void toDtoUsesStoredTitleForServerManagedArticle() {
        Article article = new Article();
        article.setId(1L);
        article.setTitle("Database Title");
        article.setFilePath("/tmp/file-name.md");
        article.setIsServerManaged(true);
        article.setContent("content");

        ArticleService service = new ArticleService(
                emptyArticleRepository(),
                emptyCategoryRepository(),
                null,
                null
        );
        ReflectionTestUtils.setField(service, "docsPath", tempDir.toString());

        ArticleDto dto = service.toDto(article);

        assertEquals("Database Title", dto.getTitle());
    }

    private static ArticleRepository emptyArticleRepository() {
        return (ArticleRepository) Proxy.newProxyInstance(
                ArticleRepository.class.getClassLoader(),
                new Class<?>[]{ArticleRepository.class},
                (proxy, method, args) -> defaultValue(method.getReturnType())
        );
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
        private final Map<Long, Article> articles = new HashMap<>();

        private TestArticleRepository(Article article) {
            this.articles.put(article.getId(), article);
        }

        private ArticleRepository proxy() {
            return (ArticleRepository) Proxy.newProxyInstance(
                    ArticleRepository.class.getClassLoader(),
                    new Class<?>[]{ArticleRepository.class},
                    (proxy, method, args) -> {
                        if ("findById".equals(method.getName())) {
                            return Optional.ofNullable(articles.get(args[0]));
                        }
                        if ("save".equals(method.getName())) {
                            Article article = (Article) args[0];
                            articles.put(article.getId(), article);
                            return article;
                        }
                        return defaultValue(method.getReturnType());
                    }
            );
        }
    }
}
