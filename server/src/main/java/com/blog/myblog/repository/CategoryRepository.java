package com.blog.myblog.repository;

import com.blog.myblog.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface CategoryRepository extends JpaRepository<Category, Long> {
    List<Category> findByParentIdIsNullOrderBySortOrderAsc();
    List<Category> findByParentIdOrderBySortOrderAsc(Long parentId);
    List<Category> findByFilePathAndIsServerManagedTrueOrderByIdAsc(String filePath);

    @Query("SELECT c FROM Category c WHERE c.isServerManaged = true")
    List<Category> findServerManaged();
}
