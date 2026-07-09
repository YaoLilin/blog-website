package com.blog.myblog.service;

import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.transport.URIish;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GitServiceTest {

    @TempDir
    private Path tempDir;

    @Test
    void pullDoesNotFailWhenRepositoryIsAlreadyUpToDate() throws Exception {
        Path remoteDir = tempDir.resolve("remote.git");
        Path seedDir = tempDir.resolve("seed");
        Path docsDir = tempDir.resolve("docs");

        try (Git remote = Git.init().setDirectory(remoteDir.toFile()).setBare(true).call()) {
            assertTrue(Files.exists(remoteDir));
        }

        try (Git seed = Git.init().setDirectory(seedDir.toFile()).call()) {
            Files.writeString(seedDir.resolve("README.md"), "seed");
            seed.add().addFilepattern(".").call();
            seed.commit().setMessage("seed").setAuthor("tester", "tester@example.com").call();
            seed.remoteAdd().setName("origin").setUri(new URIish(remoteDir.toUri().toString())).call();
            seed.push().setRemote("origin").call();
        }

        try (Git ignored = Git.cloneRepository()
                .setURI(remoteDir.toUri().toString())
                .setDirectory(docsDir.toFile())
                .call()) {
            assertTrue(Files.exists(docsDir.resolve(".git")));
        }

        GitService service = new GitService(null);
        ReflectionTestUtils.setField(service, "docsPath", docsDir.toString());

        Map<String, Object> result = service.pull("origin", "", "", null, false);

        assertEquals(Boolean.TRUE, result.get("success"));
        assertEquals(Boolean.FALSE, result.get("hasConflicts"));
    }

    @Test
    void pullReportsNoConflictsForFastForwardUpdate() throws Exception {
        Path remoteDir = tempDir.resolve("remote-fast-forward.git");
        Path seedDir = tempDir.resolve("seed-fast-forward");
        Path docsDir = tempDir.resolve("docs-fast-forward");
        Path updaterDir = tempDir.resolve("updater-fast-forward");

        try (Git remote = Git.init().setDirectory(remoteDir.toFile()).setBare(true).call()) {
            assertTrue(Files.exists(remoteDir));
        }

        try (Git seed = Git.init().setDirectory(seedDir.toFile()).call()) {
            Files.writeString(seedDir.resolve("README.md"), "v1");
            seed.add().addFilepattern(".").call();
            seed.commit().setMessage("seed").setAuthor("tester", "tester@example.com").call();
            seed.remoteAdd().setName("origin").setUri(new URIish(remoteDir.toUri().toString())).call();
            seed.push().setRemote("origin").call();
        }

        try (Git ignored = Git.cloneRepository()
                .setURI(remoteDir.toUri().toString())
                .setDirectory(docsDir.toFile())
                .call()) {
            assertTrue(Files.exists(docsDir.resolve(".git")));
        }

        try (Git updater = Git.cloneRepository()
                .setURI(remoteDir.toUri().toString())
                .setDirectory(updaterDir.toFile())
                .call()) {
            Files.writeString(updaterDir.resolve("README.md"), "v2");
            updater.add().addFilepattern(".").call();
            updater.commit().setMessage("update").setAuthor("tester", "tester@example.com").call();
            updater.push().setRemote("origin").call();
        }

        GitService service = new GitService(null);
        ReflectionTestUtils.setField(service, "docsPath", docsDir.toString());

        Map<String, Object> result = service.pull("origin", "", "", null, false);

        assertEquals(Boolean.TRUE, result.get("success"));
        assertEquals(Boolean.FALSE, result.get("hasConflicts"));
        assertEquals("v2", Files.readString(docsDir.resolve("README.md")));
    }
}
