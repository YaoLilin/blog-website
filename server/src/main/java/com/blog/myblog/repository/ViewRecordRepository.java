package com.blog.myblog.repository;

import com.blog.myblog.entity.ViewRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;
import java.util.List;

public interface ViewRecordRepository extends JpaRepository<ViewRecord, Long> {
    @Query("SELECT COUNT(v) FROM ViewRecord v")
    long countTotal();

    @Query("SELECT FUNCTION('DATE', v.createdAt) as date, COUNT(v) as cnt FROM ViewRecord v WHERE v.createdAt >= :since GROUP BY FUNCTION('DATE', v.createdAt) ORDER BY date ASC")
    List<Object[]> findDailyCountsSince(LocalDateTime since);
}
