package com.blog.myblog.service;

import com.blog.myblog.dto.CategoryDto;
import com.blog.myblog.entity.Category;
import com.blog.myblog.entity.Article;
import com.blog.myblog.repository.ArticleRepository;
import com.blog.myblog.repository.CategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

@Service
@RequiredArgsConstructor
public class CategoryService {

    private static final String HOME_RECOMMENDED_CATEGORY_IDS = "HOME_RECOMMENDED_CATEGORY_IDS";

    private final CategoryRepository categoryRepository;
    private final ArticleRepository articleRepository;
    private final SystemSettingService systemSettingService;

    @Value("${app.docs.path}")
    private String docsPath;

    public List<CategoryDto> getAll() {
        return categoryRepository.findAll().stream().map(this::toDto).collect(Collectors.toList());
    }

    public CategoryDto getById(Long id) {
        return categoryRepository.findById(id).map(this::toDto).orElseThrow();
    }

    public List<CategoryDto> getTree() {
        List<Category> all = categoryRepository.findAll();
        Map<String, Category> unique = new LinkedHashMap<>();
        for (Category cat : all) {
            String key = Boolean.TRUE.equals(cat.getIsServerManaged()) && cat.getFilePath() != null
                    ? "path:" + cat.getFilePath()
                    : "id:" + cat.getId();
            unique.putIfAbsent(key, cat);
        }
        List<Category> deduped = new ArrayList<>(unique.values());
        deduped.sort(Comparator
                .comparing((Category c) -> c.getSortOrder() == null ? 0 : c.getSortOrder())
                .thenComparing(Category::getId));
        Map<Long, CategoryDto> map = deduped.stream().collect(Collectors.toMap(Category::getId, this::toDto));
        List<CategoryDto> roots = new ArrayList<>();
        for (Category cat : deduped) {
            CategoryDto dto = map.get(cat.getId());
            if (cat.getParentId() == null) {
                roots.add(dto);
            } else {
                CategoryDto parent = map.get(cat.getParentId());
                if (parent != null) {
                    if (parent.getChildren() == null) parent.setChildren(new ArrayList<>());
                    parent.getChildren().add(dto);
                }
            }
        }
        return roots;
    }

    public List<CategoryDto> getHomeCategories() {
        List<CategoryDto> all = flattenCategories(getTree());
        if (all.isEmpty()) {
            return all;
        }

        String setting = systemSettingService.get(HOME_RECOMMENDED_CATEGORY_IDS, "").trim();
        if (!setting.isBlank()) {
            Map<Long, CategoryDto> allMap = all.stream()
                    .collect(Collectors.toMap(CategoryDto::getId, c -> c, (a, b) -> a, java.util.LinkedHashMap::new));
            List<CategoryDto> selected = new ArrayList<>();
            Set<Long> seen = new java.util.LinkedHashSet<>();
            for (String part : setting.split(",")) {
                Long id = parseLongOrNull(part.trim());
                if (id != null && seen.add(id) && allMap.containsKey(id)) {
                    selected.add(allMap.get(id));
                }
            }
            if (!selected.isEmpty()) {
                return selected;
            }
        }

        return all.stream()
                .filter(cat -> cat.getParentId() == null)
                .limit(5)
                .toList();
    }

    private List<CategoryDto> flattenCategories(List<CategoryDto> roots) {
        List<CategoryDto> result = new ArrayList<>();
        for (CategoryDto cat : roots) {
            result.add(cat);
            if (cat.getChildren() != null && !cat.getChildren().isEmpty()) {
                result.addAll(flattenCategories(cat.getChildren()));
            }
        }
        return result;
    }

    private Long parseLongOrNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Long.valueOf(value);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    @Transactional
    public CategoryDto create(CategoryDto dto) {
        Category cat = new Category();
        cat.setName(dto.getName());
        cat.setFilePath(dto.getFilePath());
        cat.setParentId(dto.getParentId());
        cat.setCoverImage(dto.getCoverImage());
        cat.setSortOrder(dto.getSortOrder() != null ? dto.getSortOrder() : 0);
        cat.setIsServerManaged(false);
        return toDto(categoryRepository.save(cat));
    }

    @Transactional
    public CategoryDto update(Long id, CategoryDto dto) {
        Category cat = categoryRepository.findById(id).orElseThrow();
        if (dto.getName() != null) cat.setName(dto.getName());
        if (dto.getCoverImage() != null) cat.setCoverImage(dto.getCoverImage());
        if (dto.getSortOrder() != null) cat.setSortOrder(dto.getSortOrder());
        return toDto(categoryRepository.save(cat));
    }

    @Transactional
    public void delete(Long id) {
        categoryRepository.deleteById(id);
    }

    @Transactional
    public void move(Long id, Long newParentId) {
        Category cat = categoryRepository.findById(id).orElseThrow();
        if (newParentId != null) {
            Category newParent = categoryRepository.findById(newParentId).orElseThrow();
            if (id.equals(newParentId)) {
                throw new IllegalArgumentException("不能移动到自身");
            }
            if (isDescendant(id, newParentId)) {
                throw new IllegalArgumentException("不能移动到子分类下");
            }
            if (!Boolean.TRUE.equals(cat.getIsServerManaged()) && isServerManagedBranch(newParentId)) {
                throw new IllegalArgumentException("普通分类不能移动到服务器管理分类下");
            }
            if (Boolean.TRUE.equals(cat.getIsServerManaged()) && !Boolean.TRUE.equals(newParent.getIsServerManaged())) {
                throw new IllegalArgumentException("服务器管理分类只能移动到服务器管理分类下");
            }
        }

        if (Boolean.TRUE.equals(cat.getIsServerManaged())) {
            moveServerManagedCategory(cat, newParentId);
        }
        cat.setParentId(newParentId);
        categoryRepository.save(cat);
    }

    private void moveServerManagedCategory(Category cat, Long newParentId) {
        if (cat.getFilePath() == null || cat.getFilePath().isBlank()) return;

        String oldRelativePath = cat.getFilePath();
        String newRelativePath = buildServerManagedPath(cat.getName(), newParentId);
        Path oldAbsolutePath = Path.of(docsPath).resolve(oldRelativePath).normalize();
        Path newAbsolutePath = Path.of(docsPath).resolve(newRelativePath).normalize();

        try {
            if (Files.exists(oldAbsolutePath)) {
                Path parent = newAbsolutePath.getParent();
                if (parent != null) {
                    Files.createDirectories(parent);
                }
                Files.move(oldAbsolutePath, newAbsolutePath, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException e) {
            throw new IllegalArgumentException("服务器管理分类目录移动失败");
        }

        updateServerManagedPaths(oldRelativePath, newRelativePath);
        cat.setFilePath(newRelativePath);
    }

    private String buildServerManagedPath(String name, Long newParentId) {
        if (newParentId == null) {
            return name;
        }
        Category parent = categoryRepository.findById(newParentId).orElseThrow();
        if (parent.getFilePath() == null || parent.getFilePath().isBlank()) {
            return name;
        }
        return parent.getFilePath() + "/" + name;
    }

    private void updateServerManagedPaths(String oldRelativePath, String newRelativePath) {
        String oldPrefix = oldRelativePath.endsWith("/") ? oldRelativePath : oldRelativePath + "/";
        String newPrefix = newRelativePath.endsWith("/") ? newRelativePath : newRelativePath + "/";

        List<Category> categories = categoryRepository.findAll();
        List<Category> toSaveCategories = new ArrayList<>();
        for (Category c : categories) {
            if (!Boolean.TRUE.equals(c.getIsServerManaged()) || c.getFilePath() == null) continue;
            if (c.getFilePath().equals(oldRelativePath)) {
                c.setFilePath(newRelativePath);
                toSaveCategories.add(c);
            } else if (c.getFilePath().startsWith(oldPrefix)) {
                c.setFilePath(newPrefix + c.getFilePath().substring(oldPrefix.length()));
                toSaveCategories.add(c);
            }
        }
        if (!toSaveCategories.isEmpty()) {
            categoryRepository.saveAll(toSaveCategories);
        }

        String oldAbsPrefix = Path.of(docsPath).resolve(oldRelativePath).normalize().toString();
        String newAbsPrefix = Path.of(docsPath).resolve(newRelativePath).normalize().toString();
        List<Article> articles = articleRepository.findAll();
        List<Article> toSaveArticles = new ArrayList<>();
        for (Article article : articles) {
            if (!Boolean.TRUE.equals(article.getIsServerManaged()) || article.getFilePath() == null) continue;
            if (article.getFilePath().equals(oldAbsPrefix)) {
                article.setFilePath(newAbsPrefix);
                toSaveArticles.add(article);
            } else if (article.getFilePath().startsWith(oldAbsPrefix + "/")) {
                article.setFilePath(newAbsPrefix + article.getFilePath().substring(oldAbsPrefix.length()));
                toSaveArticles.add(article);
            }
        }
        if (!toSaveArticles.isEmpty()) {
            articleRepository.saveAll(toSaveArticles);
        }
    }

    private boolean isServerManagedBranch(Long id) {
        Map<Long, Category> map = new java.util.HashMap<>();
        for (Category cat : categoryRepository.findAll()) {
            map.put(cat.getId(), cat);
        }
        Category current = map.get(id);
        while (current != null) {
            if (Boolean.TRUE.equals(current.getIsServerManaged())) return true;
            current = current.getParentId() != null ? map.get(current.getParentId()) : null;
        }
        return false;
    }

    private boolean isDescendant(Long id, Long maybeDescendantId) {
        List<Category> all = categoryRepository.findAll();
        Map<Long, Long> parentMap = new java.util.HashMap<>();
        for (Category cat : all) {
            parentMap.put(cat.getId(), cat.getParentId());
        }
        Long current = maybeDescendantId;
        while (current != null) {
            if (id.equals(current)) return true;
            current = parentMap.get(current);
        }
        return false;
    }

    public CategoryDto toDto(Category cat) {
        CategoryDto dto = new CategoryDto();
        dto.setId(cat.getId());
        dto.setName(cat.getName());
        dto.setFilePath(cat.getFilePath());
        dto.setParentId(cat.getParentId());
        dto.setCoverImage(cat.getCoverImage());
        dto.setSortOrder(cat.getSortOrder());
        dto.setIsServerManaged(cat.getIsServerManaged());
        dto.setHasGitRepo(hasGitRepo(cat.getFilePath()));
        dto.setCreatedAt(cat.getCreatedAt());
        dto.setUpdatedAt(cat.getUpdatedAt());
        return dto;
    }

    private boolean hasGitRepo(String relativePath) {
        if (relativePath == null || relativePath.isBlank()) {
            return false;
        }
        return Files.exists(Path.of(docsPath).resolve(relativePath).resolve(".git"));
    }
}
