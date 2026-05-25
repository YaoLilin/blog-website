package com.blog.myblog.repository;

import com.blog.myblog.entity.Image;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ImageRepository extends JpaRepository<Image, Long> {
    List<Image> findByArticleId(Long articleId);
}
