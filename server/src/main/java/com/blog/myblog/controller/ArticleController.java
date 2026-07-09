package com.blog.myblog.controller;

import com.blog.myblog.datasource.ReadDb;
import com.blog.myblog.datasource.WriteDb;
import com.blog.myblog.dto.ArticleDto;
import com.blog.myblog.dto.CategoryDto;
import com.blog.myblog.service.ArticleService;
import com.blog.myblog.service.CategoryService;
import com.blog.myblog.service.GitService;
import com.blog.myblog.service.IndexNowService;
import com.blog.myblog.service.ViewService;
import com.blog.myblog.util.BrowserRequestDetector;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/articles")
@ReadDb
@RequiredArgsConstructor
public class ArticleController {

    private final ArticleService articleService;
    private final ViewService viewService;
    private final GitService gitService;
    private final CategoryService categoryService;
    private final IndexNowService indexNowService;

    @GetMapping
    public Page<ArticleDto> getList(
            @RequestParam(required = false) Long categoryId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return articleService.getList(categoryId, page, size);
    }

    @GetMapping("/{id}")
    public ArticleDto getById(@PathVariable Long id) {
        return articleService.getById(id);
    }

    @GetMapping("/by-path")
    public ArticleDto getByPath(@RequestParam String path) {
        return articleService.getByFilePath(path);
    }

    @GetMapping("/recommended")
    public List<ArticleDto> getRecommended() {
        return articleService.getRecommended();
    }

    @GetMapping("/recent")
    public List<ArticleDto> getRecent(@RequestParam(defaultValue = "10") int limit) {
        return articleService.getRecent(limit);
    }

    @GetMapping("/search")
    public List<ArticleDto> search(
            @RequestParam String keyword,
            @RequestParam(defaultValue = "false") boolean titleOnly) {
        return articleService.search(keyword, titleOnly);
    }

    @PostMapping
    @WriteDb
    public ArticleDto create(@RequestBody ArticleDto dto) {
        ArticleDto article = articleService.create(dto);
        indexNowService.submitArticle(article.getId());
        return article;
    }

    @PutMapping("/{id}")
    @WriteDb
    public ArticleDto update(@PathVariable Long id, @RequestBody ArticleDto dto) {
        ArticleDto article = articleService.update(id, dto);
        indexNowService.submitArticle(article.getId());
        return article;
    }

    @DeleteMapping("/{id}")
    @WriteDb
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        articleService.getById(id);
        articleService.delete(id);
        indexNowService.submitArticle(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/view")
    @WriteDb
    public ResponseEntity<Void> recordView(
            @PathVariable Long id,
            Authentication authentication,
            HttpServletRequest request) {
        if (isAdmin(authentication) || !isBrowserRequest(request)) {
            return ResponseEntity.ok().build();
        }
        viewService.recordView(id);
        return ResponseEntity.ok().build();
    }

    private boolean isAdmin(Authentication authentication) {
        return authentication != null
                && authentication.isAuthenticated()
                && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }

    private boolean isBrowserRequest(HttpServletRequest request) {
        return BrowserRequestDetector.isBrowserUserAgent(request.getHeader("User-Agent"));
    }

    @GetMapping("/{id}/git-remote")
    public ResponseEntity<Map<String, Object>> getGitRemote(@PathVariable Long id) {
        ArticleDto article = articleService.getById(id);
        if (!Boolean.TRUE.equals(article.getIsServerManaged()) || article.getCategory() == null) {
            return ResponseEntity.ok(Map.of("url", ""));
        }
        String repoRelativePath = resolveRepoRelativePath(article.getCategory().getId());
        if (repoRelativePath == null) {
            return ResponseEntity.ok(Map.of("url", ""));
        }
        try {
            List<Map<String, Object>> remotes = gitService.listRemotes(repoRelativePath);
            for (Map<String, Object> remote : remotes) {
                Object urls = remote.get("urls");
                if (urls instanceof List && !((List<?>) urls).isEmpty()) {
                    String url = ((List<?>) urls).get(0).toString();
                    if (url.startsWith("http")) {
                        return ResponseEntity.ok(Map.of("url", url));
                    }
                }
            }
        } catch (Exception ignored) {
        }
        return ResponseEntity.ok(Map.of("url", ""));
    }

    private String resolveRepoRelativePath(Long categoryId) {
        if (categoryId == null) return null;
        CategoryDto target = categoryService.getById(categoryId);
        if (!Boolean.TRUE.equals(target.getIsServerManaged())) {
            return null;
        }
        return target.getFilePath();
    }
}
