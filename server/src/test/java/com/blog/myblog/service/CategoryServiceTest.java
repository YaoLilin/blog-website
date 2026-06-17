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
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CategoryServiceTest {

    @TempDir
    private Path tempDir;

    @Test
    void deleteServerManagedCategoryDeletesDirectoryAndDescendants() throws Exception {
        Path docs = tempDir.resolve("docs");
        Path rootDir = docs.resolve("root");
        Path childDir = rootDir.resolve("child");
        Files.createDirectories(childDir);
        Files.writeString(childDir.resolve("note.md"), "# Note");

        Category root = category(1L, "root", "root", null);
        Category child = category(2L, "child", "root/child", 1L);
        TestCategoryRepository categoryRepository = new TestCategoryRepository(List.of(root, child));

        Article childArticle = article(10L, 2L, childDir.resolve("note.md").toString());
        Article pathArticle = article(11L, null, rootDir.resolve("loose.md").toString());
        TestArticleRepository articleRepository = new TestArticleRepository(List.of(childArticle, pathArticle));

        CategoryService service = new CategoryService(categoryRepository.proxy(), articleRepository.proxy(), null);
        ReflectionTestUtils.setField(service, "docsPath", docs.toString());

        service.delete(1L);

        assertFalse(Files.exists(rootDir));
        assertEquals(List.of(childArticle, pathArticle), articleRepository.deletedArticles);
        assertEquals(List.of(child, root), categoryRepository.deletedCategories);
    }

    @Test
    void deleteRejectsServerManagedPathOutsideDocsRoot() throws Exception {
        Path docs = tempDir.resolve("docs");
        Files.createDirectories(docs);
        Category root = category(1L, "root", "../outside", null);
        TestCategoryRepository categoryRepository = new TestCategoryRepository(List.of(root));
        TestArticleRepository articleRepository = new TestArticleRepository(List.of());
        CategoryService service = new CategoryService(categoryRepository.proxy(), articleRepository.proxy(), null);
        ReflectionTestUtils.setField(service, "docsPath", docs.toString());

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class, () -> service.delete(1L));
        assertEquals("服务器管理分类目录路径非法", error.getMessage());

        assertTrue(articleRepository.deletedArticles.isEmpty());
        assertTrue(categoryRepository.deletedCategories.isEmpty());
    }

    private static Category category(Long id, String name, String filePath, Long parentId) {
        Category category = new Category();
        category.setId(id);
        category.setName(name);
        category.setFilePath(filePath);
        category.setParentId(parentId);
        category.setIsServerManaged(true);
        return category;
    }

    private static Article article(Long id, Long categoryId, String filePath) {
        Article article = new Article();
        article.setId(id);
        article.setTitle("article-" + id);
        article.setCategoryId(categoryId);
        article.setFilePath(filePath);
        article.setIsServerManaged(true);
        return article;
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

    private static class TestCategoryRepository {
        private final List<Category> categories;
        private final List<Category> deletedCategories = new ArrayList<>();

        private TestCategoryRepository(List<Category> categories) {
            this.categories = categories;
        }

        private CategoryRepository proxy() {
            return (CategoryRepository) Proxy.newProxyInstance(
                    CategoryRepository.class.getClassLoader(),
                    new Class<?>[]{CategoryRepository.class},
                    (proxy, method, args) -> {
                        if ("findById".equals(method.getName())) {
                            Long id = (Long) args[0];
                            return categories.stream().filter(category -> id.equals(category.getId())).findFirst();
                        }
                        if ("findAll".equals(method.getName())) {
                            return categories;
                        }
                        if ("deleteAll".equals(method.getName())) {
                            @SuppressWarnings("unchecked")
                            Iterable<Category> toDelete = (Iterable<Category>) args[0];
                            toDelete.forEach(deletedCategories::add);
                            return null;
                        }
                        return defaultValue(method.getReturnType());
                    });
        }
    }

    private static class TestArticleRepository {
        private final List<Article> articles;
        private final List<Article> deletedArticles = new ArrayList<>();

        private TestArticleRepository(List<Article> articles) {
            this.articles = articles;
        }

        private ArticleRepository proxy() {
            return (ArticleRepository) Proxy.newProxyInstance(
                    ArticleRepository.class.getClassLoader(),
                    new Class<?>[]{ArticleRepository.class},
                    (proxy, method, args) -> {
                        if ("findAll".equals(method.getName())) {
                            return articles;
                        }
                        if ("findByFilePathStartingWith".equals(method.getName())) {
                            String prefix = (String) args[0];
                            return articles.stream()
                                    .filter(article -> article.getFilePath() != null && article.getFilePath().startsWith(prefix))
                                    .toList();
                        }
                        if ("deleteAll".equals(method.getName())) {
                            @SuppressWarnings("unchecked")
                            Iterable<Article> toDelete = (Iterable<Article>) args[0];
                            toDelete.forEach(deletedArticles::add);
                            return null;
                        }
                        return defaultValue(method.getReturnType());
                    });
        }
    }
}
