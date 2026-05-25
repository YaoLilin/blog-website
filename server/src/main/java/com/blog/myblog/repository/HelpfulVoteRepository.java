package com.blog.myblog.repository;

import com.blog.myblog.entity.HelpfulVote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface HelpfulVoteRepository extends JpaRepository<HelpfulVote, Long> {
    boolean existsByArticleIdAndFingerprint(Long articleId, String fingerprint);

    @Query("SELECT v.articleId, COUNT(v) FROM HelpfulVote v GROUP BY v.articleId ORDER BY COUNT(v) DESC")
    List<Object[]> findTopHelpfulGrouped();
}
