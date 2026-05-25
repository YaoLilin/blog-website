package com.blog.myblog.service;

import com.blog.myblog.entity.ViewRecord;
import com.blog.myblog.repository.ArticleRepository;
import com.blog.myblog.repository.ViewRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ViewService {

    private final ViewRecordRepository viewRecordRepository;
    private final ArticleRepository articleRepository;

    @Transactional
    public void recordView(Long articleId) {
        try {
            ViewRecord viewRecord = new ViewRecord();
            viewRecord.setArticleId(articleId);
            viewRecord.setFingerprint("auto");
            viewRecordRepository.save(viewRecord);

            articleRepository.findById(articleId).ifPresent(a -> {
                a.setViewCount(a.getViewCount() + 1);
                articleRepository.save(a);
            });
        } catch (DataIntegrityViolationException ignored) {
        }
    }

    public long getTotalViews() {
        return viewRecordRepository.countTotal();
    }

    public Map<String, Long> getDailyViews(int days) {
        LocalDateTime since = LocalDateTime.now().minusDays(days);
        List<Object[]> raw = viewRecordRepository.findDailyCountsSince(since);
        Map<String, Long> result = new LinkedHashMap<>();
        raw.forEach(row -> result.put(row[0].toString(), ((Number) row[1]).longValue()));
        return result;
    }
}
