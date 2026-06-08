package com.blog.myblog.controller;

import com.blog.myblog.repository.ArticleRepository;
import com.blog.myblog.service.ArticleService;
import com.blog.myblog.service.SiteVisitService;
import com.blog.myblog.service.ViewService;
import com.blog.myblog.util.BrowserRequestDetector;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/stats")
@RequiredArgsConstructor
public class StatsController {

    private final ViewService viewService;
    private final SiteVisitService siteVisitService;
    private final ArticleRepository articleRepository;
    private final ArticleService articleService;

    @GetMapping
    public Map<String, Object> getStats() {
        Map<String, Object> result = new HashMap<>();
        result.put("totalViews", viewService.getTotalViews());
        result.put("totalVisits", siteVisitService.getTotalVisits());

        Map<String, Long> dailyViewMap = viewService.getDailyViews(180);
        List<Map<String, Object>> dailyViews = new ArrayList<>();
        dailyViewMap.forEach((date, cnt) -> {
            Map<String, Object> row = new HashMap<>();
            row.put("date", date);
            row.put("count", cnt);
            dailyViews.add(row);
        });
        result.put("dailyViews", dailyViews);

        Map<String, Long> dailyVisitMap = siteVisitService.getDailyVisits(180);
        List<Map<String, Object>> dailyVisits = new ArrayList<>();
        dailyVisitMap.forEach((date, cnt) -> {
            Map<String, Object> row = new HashMap<>();
            row.put("date", date);
            row.put("count", cnt);
            dailyVisits.add(row);
        });
        result.put("dailyVisits", dailyVisits);

        var topArticles = articleRepository.findTopByViewCount(PageRequest.of(0, 10));
        List<Map<String, Object>> topList = new ArrayList<>();
        topArticles.forEach(a -> {
            Map<String, Object> item = new HashMap<>();
            item.put("article", articleService.toDto(a));
            item.put("viewCount", a.getViewCount());
            topList.add(item);
        });
        result.put("topArticles", topList);

        return result;
    }

    @PostMapping("/visit")
    public ResponseEntity<Void> recordVisit(HttpServletRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !(auth instanceof AnonymousAuthenticationToken)) {
            return ResponseEntity.ok().build();
        }
        if (!BrowserRequestDetector.isBrowserUserAgent(request.getHeader("User-Agent"))) {
            return ResponseEntity.ok().build();
        }
        siteVisitService.recordVisit();
        return ResponseEntity.ok().build();
    }
}
