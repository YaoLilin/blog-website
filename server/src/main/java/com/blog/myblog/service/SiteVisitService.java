package com.blog.myblog.service;

import com.blog.myblog.entity.SiteVisitRecord;
import com.blog.myblog.repository.SiteVisitRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class SiteVisitService {

    private final SiteVisitRecordRepository siteVisitRecordRepository;

    @Transactional
    public void recordVisit() {
        SiteVisitRecord record = new SiteVisitRecord();
        siteVisitRecordRepository.save(record);
    }

    public long getTotalVisits() {
        return siteVisitRecordRepository.countTotal();
    }

    public Map<String, Long> getDailyVisits(int days) {
        LocalDateTime since = LocalDateTime.now().minusDays(days);
        List<Object[]> raw = siteVisitRecordRepository.findDailyCountsSince(since);
        Map<String, Long> result = new LinkedHashMap<>();
        raw.forEach(row -> result.put(row[0].toString(), ((Number) row[1]).longValue()));
        return result;
    }
}
