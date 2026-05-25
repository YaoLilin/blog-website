package com.blog.myblog.controller;

import com.blog.myblog.dto.ArticleDto;
import com.blog.myblog.dto.CategoryDto;
import com.blog.myblog.service.ArticleService;
import com.blog.myblog.service.CategoryService;
import com.blog.myblog.service.GitService;
import com.blog.myblog.service.HelpfulVoteService;
import com.blog.myblog.service.ViewService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/articles")
@RequiredArgsConstructor
public class ArticleController {

    private final ArticleService articleService;
    private final ViewService viewService;
    private final HelpfulVoteService helpfulVoteService;
    private final GitService gitService;
    private final CategoryService categoryService;

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
    public ArticleDto create(@RequestBody ArticleDto dto) {
        return articleService.create(dto);
    }

    @PutMapping("/{id}")
    public ArticleDto update(@PathVariable Long id, @RequestBody ArticleDto dto) {
        return articleService.update(id, dto);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        articleService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/view")
    public ResponseEntity<Void> recordView(@PathVariable Long id) {
        viewService.recordView(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/helpful")
    public ResponseEntity<Map<String, Object>> recordHelpful(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String fingerprint = body.getOrDefault("fingerprint", "unknown");
        boolean voted = helpfulVoteService.vote(id, fingerprint);
        return ResponseEntity.ok(Map.of("voted", voted));
    }

    @GetMapping("/{id}/helpful/status")
    public ResponseEntity<Map<String, Object>> getHelpfulStatus(@PathVariable Long id, @RequestParam String fingerprint) {
        boolean voted = helpfulVoteService.isVoted(id, fingerprint);
        return ResponseEntity.ok(Map.of("voted", voted));
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
