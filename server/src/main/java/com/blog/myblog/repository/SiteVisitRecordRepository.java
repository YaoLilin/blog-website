package com.blog.myblog.repository;

import com.blog.myblog.entity.SiteVisitRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;

public interface SiteVisitRecordRepository extends JpaRepository<SiteVisitRecord, Long> {
    @Query("SELECT COUNT(v) FROM SiteVisitRecord v")
    long countTotal();

    @Query("SELECT FUNCTION('DATE', v.createdAt) as date, COUNT(v) as cnt FROM SiteVisitRecord v WHERE v.createdAt >= :since GROUP BY FUNCTION('DATE', v.createdAt) ORDER BY date ASC")
    java.util.List<Object[]> findDailyCountsSince(LocalDateTime since);
}
