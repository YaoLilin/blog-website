package com.blog.myblog.service;

import org.eclipse.jgit.api.Git;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GitServiceConflictTest {

    private static final IndexNowService NO_OP_INDEX_NOW = new IndexNowService(null, null) {
        @Override
        public void submitArticles(java.util.Collection<Long> articleIds) {
        }
    };

    @TempDir
    private Path tempDir;

    @Test
    void extractConflictFilesParsesCheckoutConflictMessage() {
        List<String> files = GitService.extractConflictFiles("""
                Checkout conflict with files:
                E10/E10 前端二次开发指南.md
                E9/e9前端二次开发指南.md
                README.md
                """);

        assertEquals(List.of(
                "E10/E10 前端二次开发指南.md",
                "E9/e9前端二次开发指南.md",
                "README.md"
        ), files);
    }

    @Test
    void extractConflictFilesReturnsEmptyListForOtherMessages() {
        assertTrue(GitService.extractConflictFiles("Authentication failed").isEmpty());
    }

    @Test
    void toPullConflictExceptionOrNullBuildsStructuredConflictFromGenericException() {
        Exception exception = new IllegalStateException("""
                Checkout conflict with files:
                E10/E10 前端二次开发指南.md
                README.md
                """);

        GitService.GitPullConflictException conflict = GitService.toPullConflictExceptionOrNull(exception);

        assertEquals(List.of("E10/E10 前端二次开发指南.md", "README.md"), conflict.getConflictFiles());
    }

    @Test
    void getStatusDoesNotClimbAboveDocsRootToFindParentRepo() throws Exception {
        Path projectRoot = tempDir.resolve("project");
        Path docsDir = projectRoot.resolve("server/docs");
        Files.createDirectories(docsDir);

        try (Git ignored = Git.init().setDirectory(projectRoot.toFile()).call()) {
            GitService service = new GitService(null, NO_OP_INDEX_NOW);
            ReflectionTestUtils.setField(service, "docsPath", docsDir.toString());

            Object hasRepo = service.getStatus(null).get("hasRepo");

            assertEquals(Boolean.FALSE, hasRepo);
        }
    }
}
