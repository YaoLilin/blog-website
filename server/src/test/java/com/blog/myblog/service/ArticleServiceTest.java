package com.blog.myblog.service;

import com.blog.myblog.dto.ArticleDto;
import com.blog.myblog.entity.Article;
import com.blog.myblog.repository.ArticleRepository;
import com.blog.myblog.repository.CategoryRepository;
import com.blog.myblog.repository.SystemSettingRepository;
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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
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
                emptySystemSettingService()
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
                emptySystemSettingService()
        );
        ReflectionTestUtils.setField(service, "docsPath", tempDir.toString());

        ArticleDto dto = service.toDto(article);

        assertEquals("Database Title", dto.getTitle());
    }

    @Test
    void updateRecreatesMissingServerManagedArticleFromFilePath() throws Exception {
        Path articleFile = tempDir.resolve("server-managed.md");
        Files.writeString(articleFile, "# Heading\nold");

        TestArticleRepository articleRepository = new TestArticleRepository();
        ArticleService service = new ArticleService(
                articleRepository.proxy(),
                emptyCategoryRepository(),
                null,
                emptySystemSettingService()
        );
        ReflectionTestUtils.setField(service, "docsPath", tempDir.toString());
        ReflectionTestUtils.setField(service, "imageStoragePath", tempDir.resolve("images").toString());
        ReflectionTestUtils.setField(service, "attachmentStoragePath", tempDir.resolve("attachments").toString());

        ArticleDto dto = new ArticleDto();
        dto.setTitle("Recovered Title");
        dto.setContent("new content");
        dto.setCategoryId(9L);
        dto.setFilePath(articleFile.toString());
        dto.setIsServerManaged(true);
        dto.setIsRecommended(true);

        ArticleDto updated = service.update(103L, dto);

        assertNotNull(updated.getId());
        assertEquals("Recovered Title", updated.getTitle());
        assertEquals(articleFile.toString(), updated.getFilePath());
        assertTrue(updated.getIsServerManaged());
        assertEquals(9L, updated.getCategoryId());
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

    private static SystemSettingService emptySystemSettingService() {
        SystemSettingRepository repository = (SystemSettingRepository) Proxy.newProxyInstance(
                SystemSettingRepository.class.getClassLoader(),
                new Class<?>[]{SystemSettingRepository.class},
                (proxy, method, args) -> defaultValue(method.getReturnType())
        );
        return new SystemSettingService(repository);
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
        private long nextId = 1L;

        private TestArticleRepository() {
        }

        private TestArticleRepository(Article article) {
            this.articles.put(article.getId(), article);
            this.nextId = Math.max(this.nextId, article.getId() + 1);
        }

        private ArticleRepository proxy() {
            return (ArticleRepository) Proxy.newProxyInstance(
                    ArticleRepository.class.getClassLoader(),
                    new Class<?>[]{ArticleRepository.class},
                    (proxy, method, args) -> {
                        if ("findById".equals(method.getName())) {
                            return Optional.ofNullable(articles.get(args[0]));
                        }
                        if ("findByFilePathOrderByIdAsc".equals(method.getName())) {
                            String filePath = (String) args[0];
                            List<Article> matches = new ArrayList<>();
                            for (Article article : articles.values()) {
                                if (filePath.equals(article.getFilePath())) {
                                    matches.add(article);
                                }
                            }
                            matches.sort((a, b) -> Long.compare(a.getId(), b.getId()));
                            return matches;
                        }
                        if ("save".equals(method.getName())) {
                            Article article = (Article) args[0];
                            if (article.getId() == null) {
                                article.setId(nextId++);
                            }
                            articles.put(article.getId(), article);
                            return article;
                        }
                        return defaultValue(method.getReturnType());
                    }
            );
        }
    }
}
