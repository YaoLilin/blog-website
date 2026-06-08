package com.blog.myblog.service;

import com.blog.myblog.entity.Article;
import com.blog.myblog.repository.ArticleRepository;
import com.blog.myblog.repository.ViewRecordRepository;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ViewServiceTest {

    @Test
    void recordViewCreatesARecordAndIncrementsArticleEachTime() {
        Article article = new Article();
        article.setId(115L);
        article.setViewCount(7);
        TestViewRecordRepository viewRecordRepository = new TestViewRecordRepository();
        TestArticleRepository articleRepository = new TestArticleRepository(Optional.of(article));
        ViewService viewService = new ViewService(viewRecordRepository.proxy(), articleRepository.proxy());

        viewService.recordView(115L);
        viewService.recordView(115L);

        assertEquals(2, viewRecordRepository.savedRecords);
        assertEquals(9, article.getViewCount());
        assertEquals(2, articleRepository.savedArticles);
    }

    @Test
    void recordViewTreatsNullViewCountAsZero() {
        Article article = new Article();
        article.setId(115L);
        article.setViewCount(null);
        TestViewRecordRepository viewRecordRepository = new TestViewRecordRepository();
        TestArticleRepository articleRepository = new TestArticleRepository(Optional.of(article));
        ViewService viewService = new ViewService(viewRecordRepository.proxy(), articleRepository.proxy());

        viewService.recordView(115L);

        assertEquals(1, article.getViewCount());
        assertEquals(1, viewRecordRepository.savedRecords);
        assertTrue(articleRepository.findByIdCalled);
        assertEquals(1, articleRepository.savedArticles);
    }

    private static Object defaultValue(Class<?> returnType) {
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

    private static class TestViewRecordRepository {
        private int savedRecords;

        private ViewRecordRepository proxy() {
            return (ViewRecordRepository) Proxy.newProxyInstance(
                    ViewRecordRepository.class.getClassLoader(),
                    new Class<?>[]{ViewRecordRepository.class},
                    (proxy, method, args) -> {
                        if ("save".equals(method.getName())) {
                            savedRecords++;
                            return args[0];
                        }
                        return defaultValue(method.getReturnType());
                    });
        }
    }

    private static class TestArticleRepository {
        private final Optional<Article> article;
        private boolean findByIdCalled;
        private int savedArticles;

        private TestArticleRepository(Optional<Article> article) {
            this.article = article;
        }

        private ArticleRepository proxy() {
            return (ArticleRepository) Proxy.newProxyInstance(
                    ArticleRepository.class.getClassLoader(),
                    new Class<?>[]{ArticleRepository.class},
                    (proxy, method, args) -> {
                        if ("findById".equals(method.getName())) {
                            findByIdCalled = true;
                            assertEquals(115L, args[0]);
                            return article;
                        }
                        if ("save".equals(method.getName())) {
                            savedArticles++;
                            return args[0];
                        }
                        return defaultValue(method.getReturnType());
                    });
        }
    }
}
