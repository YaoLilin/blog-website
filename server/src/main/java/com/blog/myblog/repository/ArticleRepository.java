package com.blog.myblog.repository;

import com.blog.myblog.entity.Article;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ArticleRepository extends JpaRepository<Article, Long> {
    Page<Article> findByCategoryId(Long categoryId, Pageable pageable);
    List<Article> findByCategoryId(Long categoryId);
    List<Article> findByIsRecommendedTrueOrderByCreatedAtDesc();
    List<Article> findTop20ByOrderByCreatedAtDesc();

    @Query("SELECT a FROM Article a WHERE a.title LIKE %:keyword%")
    List<Article> searchByTitle(String keyword);

    @Query("SELECT a FROM Article a WHERE a.title LIKE %:keyword% OR a.content LIKE %:keyword%")
    List<Article> searchByTitleOrContent(String keyword);

    @Query("SELECT a FROM Article a ORDER BY a.viewCount DESC")
    List<Article> findTopByViewCount(Pageable pageable);

    List<Article> findByFilePathAndIsServerManagedTrue(String filePath);
    List<Article> findByFilePathOrderByIdAsc(String filePath);
    Optional<Article> findByFilePath(String filePath);
    List<Article> findByFilePathStartingWith(String prefix);
}
