package com.blog.myblog.service;

import lombok.RequiredArgsConstructor;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.PullResult;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.storage.file.FileRepositoryBuilder;
import org.eclipse.jgit.transport.CredentialsProvider;
import org.eclipse.jgit.transport.UsernamePasswordCredentialsProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
public class GitService {

    @Value("${app.docs.path}")
    private String docsPath;

    private final FileWatcherService fileWatcherService;

    private Git openRepo(String repoRelativePath) throws IOException {
        Path gitDir = locateGitDir(repoRelativePath);
        if (gitDir == null) {
            throw new IOException("Git repository not found");
        }
        FileRepositoryBuilder builder = new FileRepositoryBuilder();
        Repository repo = builder.setGitDir(gitDir.toFile())
                .readEnvironment()
                .setMustExist(true)
                .build();
        return new Git(repo);
    }

    private Path locateGitDir(String repoRelativePath) {
        Path root = repoRelativePath == null || repoRelativePath.isBlank()
                ? Path.of(docsPath)
                : Path.of(docsPath).resolve(repoRelativePath);

        Path current = root;
        for (int i = 0; i < 10; i++) {
            Path gitDir = current.resolve(".git");
            if (Files.exists(gitDir)) {
                return gitDir;
            }
            current = current.getParent();
            if (current == null) break;
        }
        return null;
    }

    public Map<String, Object> getStatus(String repoRelativePath) {
        Map<String, Object> result = new HashMap<>();
        try {
            Git git = openRepo(repoRelativePath);
            result.put("hasRepo", true);
            result.put("currentBranch", git.getRepository().getBranch());
            var status = git.status().call();
            boolean hasChanges = !status.isClean();
            result.put("hasUncommittedChanges", hasChanges);
            List<String> files = new ArrayList<>();
            files.addAll(status.getModified());
            files.addAll(status.getUntracked());
            files.addAll(status.getAdded());
            files.addAll(status.getRemoved());
            result.put("uncommittedFiles", files);
            var remoteNames = git.getRepository().getRemoteNames();
            result.put("remoteUrls", new ArrayList<>(remoteNames));
            git.close();
        } catch (Exception e) {
            result.put("hasRepo", false);
        }
        return result;
    }

    public void commit(String message, String repoRelativePath) throws IOException, GitAPIException {
        try (Git git = openRepo(repoRelativePath)) {
            git.add().addFilepattern(".").call();
            git.commit().setMessage(message).call();
        }
    }

    public void push(String remoteName, String username, String password, String repoRelativePath) throws IOException, GitAPIException {
        try (Git git = openRepo(repoRelativePath)) {
            CredentialsProvider cp = new UsernamePasswordCredentialsProvider(username, password);
            git.push().setRemote(remoteName).setCredentialsProvider(cp).call();
        }
    }

    public Map<String, Object> pull(String remoteName, String username, String password, String repoRelativePath) throws IOException, GitAPIException {
        Map<String, Object> result = new HashMap<>();
        try (Git git = openRepo(repoRelativePath)) {
            CredentialsProvider cp = new UsernamePasswordCredentialsProvider(username, password);
            PullResult pullResult = git.pull().setRemote(remoteName).setCredentialsProvider(cp).call();
            result.put("success", pullResult.isSuccessful());
            result.put("hasConflicts", !pullResult.getMergeResult().getMergeStatus().isSuccessful());
        }
        return result;
    }

    public void addRemote(String name, String url, String repoRelativePath) throws IOException, GitAPIException {
        try (Git git = openRepo(repoRelativePath)) {
            git.remoteAdd().setName(name).setUri(new org.eclipse.jgit.transport.URIish(url)).call();
        } catch (Exception e) {
            throw new GitAPIException("Invalid URL: " + url + " - " + e.getMessage()) {};
        }
    }

    public void removeRemote(String name, String repoRelativePath) throws IOException, GitAPIException {
        try (Git git = openRepo(repoRelativePath)) {
            git.remoteRemove().setRemoteName(name).call();
        }
    }

    public List<Map<String, Object>> listRemotes(String repoRelativePath) throws IOException {
        List<Map<String, Object>> remotes = new ArrayList<>();
        try (Git git = openRepo(repoRelativePath)) {
            var configs = git.getRepository().getConfig();
            var remoteNames = git.getRepository().getRemoteNames();
            for (String name : remoteNames) {
                Map<String, Object> r = new HashMap<>();
                r.put("name", name);
                r.put("urls", List.of(configs.getString("remote", name, "url")));
                remotes.add(r);
            }
        }
        return remotes;
    }

    public void initRepo() throws GitAPIException {
        File dir = new File(docsPath);
        dir.mkdirs();
        try (Git git = Git.init().setDirectory(dir).call()) {
            git.add().addFilepattern(".").call();
            git.commit().setMessage("Initial commit").call();
        }
    }

    public Map<String, Object> cloneRemoteRepo(String url, String targetRelativePath) throws IOException, GitAPIException {
        if (url == null || url.isBlank()) {
            throw new IllegalArgumentException("仓库地址不能为空");
        }
        Path targetDir = resolveCloneTarget(targetRelativePath);
        if (Files.exists(targetDir) && Files.isDirectory(targetDir)) {
            try (Stream<Path> stream = Files.list(targetDir)) {
                if (stream.findAny().isPresent()) {
                    throw new IllegalArgumentException("目标目录已存在且非空");
                }
            }
        } else if (Files.exists(targetDir)) {
            throw new IllegalArgumentException("目标目录已存在且非空");
        }
        Files.createDirectories(targetDir.getParent() != null ? targetDir.getParent() : targetDir);
        cloneToDirectory(url, targetDir);
        if (!targetDir.toAbsolutePath().normalize().equals(Path.of(docsPath).toAbsolutePath().normalize())) {
            fileWatcherService.registerDirectoryTree(targetDir);
        }
        fileWatcherService.rescan();

        Map<String, Object> result = new HashMap<>();
        result.put("directory", targetDir.toString());
        result.put("repoName", targetDir.getFileName() != null ? targetDir.getFileName().toString() : "");
        result.put("relativePath", relativePathFromDocs(targetDir));
        return result;
    }

    private void cloneToDirectory(String url, Path targetDir) throws IOException, GitAPIException {
        try {
            try (Git git = Git.cloneRepository()
                    .setURI(url)
                    .setDirectory(targetDir.toFile())
                    .call()) {
                git.getRepository().getBranch();
            }
        } catch (org.eclipse.jgit.api.errors.InvalidRemoteException e) {
            throw new IllegalArgumentException("仓库地址无效");
        }
    }

    private Path resolveCloneTarget(String relativePath) {
        Path base = Path.of(docsPath);
        return relativePath == null || relativePath.isBlank()
                ? base
                : base.resolve(relativePath);
    }

    private String relativePathFromDocs(Path path) {
        Path docsRoot = Path.of(docsPath).toAbsolutePath().normalize();
        Path normalized = path.toAbsolutePath().normalize();
        if (normalized.startsWith(docsRoot)) {
            return docsRoot.relativize(normalized).toString().replace('\\', '/');
        }
        return normalized.toString();
    }
}
