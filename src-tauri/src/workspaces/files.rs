use std::collections::HashSet;
use std::fs::File;
use std::io::Read;
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex};

use git2::Repository;
use ignore::WalkBuilder;
use serde::{Deserialize, Serialize};

use crate::utils::normalize_git_path;

fn should_always_skip(name: &str) -> bool {
    name == ".git"
}

fn is_special_dependency_dir_name(name: &str) -> bool {
    matches!(
        name,
        "node_modules"
            | ".pnpm-store"
            | ".yarn"
            | "bower_components"
            | "vendor"
            | ".venv"
            | "venv"
            | "env"
            | "__pypackages__"
            | "Pods"
            | "Carthage"
            | ".m2"
            | ".ivy2"
            | ".cargo"
    )
}

fn is_special_build_artifact_dir_name(name: &str) -> bool {
    matches!(
        name,
        "target"
            | "dist"
            | "build"
            | "out"
            | "coverage"
            | ".next"
            | ".nuxt"
            | ".svelte-kit"
            | ".angular"
            | ".parcel-cache"
            | ".turbo"
            | ".cache"
            | ".gradle"
            | "CMakeFiles"
            | "bin"
            | "obj"
            | "__pycache__"
            | ".pytest_cache"
            | ".mypy_cache"
            | ".tox"
            | ".dart_tool"
    ) || name.starts_with("cmake-build-")
}

fn is_special_directory_path(path: &str) -> bool {
    path.rsplit('/')
        .next()
        .map(|name| {
            is_special_dependency_dir_name(name) || is_special_build_artifact_dir_name(name)
        })
        .unwrap_or(false)
}

fn normalized_relative_to_pathbuf(normalized: &str) -> PathBuf {
    let mut path = PathBuf::new();
    for segment in normalized.split('/') {
        if !segment.is_empty() {
            path.push(segment);
        }
    }
    path
}

fn normalize_workspace_relative_directory_path(path: &str) -> Result<String, String> {
    let normalized = path.trim().replace('\\', "/");
    let trimmed = normalized.trim_matches('/');
    if trimmed.is_empty() {
        return Err("Directory path cannot be empty.".to_string());
    }
    let relative = Path::new(trimmed);
    for component in relative.components() {
        match component {
            Component::ParentDir
            | Component::RootDir
            | Component::Prefix(_)
            | Component::CurDir => {
                return Err("Invalid directory path.".to_string());
            }
            Component::Normal(_) => {}
        }
    }
    if trimmed == ".git"
        || trimmed.starts_with(".git/")
        || trimmed.contains("/.git/")
        || trimmed.ends_with("/.git")
    {
        return Err("Cannot access .git directory.".to_string());
    }
    Ok(trimmed.to_string())
}

fn sort_and_dedup_workspace_lists(
    files: &mut Vec<String>,
    directories: &mut Vec<String>,
    gitignored_files: &mut Vec<String>,
    gitignored_directories: &mut Vec<String>,
) {
    files.sort();
    files.dedup();
    directories.sort();
    directories.dedup();
    gitignored_files.sort();
    gitignored_files.dedup();
    gitignored_directories.sort();
    gitignored_directories.dedup();
}

#[derive(Serialize, Deserialize, Clone)]
pub(crate) struct WorkspaceFilesResponse {
    pub(crate) files: Vec<String>,
    pub(crate) directories: Vec<String>,
    #[serde(default)]
    pub(crate) gitignored_files: Vec<String>,
    #[serde(default)]
    pub(crate) gitignored_directories: Vec<String>,
}

pub(crate) fn list_workspace_files_inner(
    root: &PathBuf,
    max_files: usize,
) -> WorkspaceFilesResponse {
    let mut files = Vec::new();
    let mut directories = Vec::new();
    let mut gitignored_files = Vec::new();
    let mut gitignored_directories = Vec::new();
    let pruned_special_directories: Arc<Mutex<HashSet<String>>> =
        Arc::new(Mutex::new(HashSet::new()));

    // Always open the repo so we can tag gitignored files for dimmed styling.
    let repo = Repository::open(root).ok();

    // Seed root-level entries first so the file tree always reflects the real workspace root
    // even when deep traversal later hits the max file cap.
    if let Ok(entries) = std::fs::read_dir(root) {
        let mut root_entries = entries.filter_map(|entry| entry.ok()).collect::<Vec<_>>();
        root_entries.sort_by(|a, b| {
            a.file_name()
                .to_string_lossy()
                .cmp(&b.file_name().to_string_lossy())
        });
        for entry in root_entries {
            let path = entry.path();
            let rel_path = match path.strip_prefix(root) {
                Ok(path) => path,
                Err(_) => continue,
            };
            let normalized = normalize_git_path(&rel_path.to_string_lossy());
            if normalized.is_empty() {
                continue;
            }
            let name = entry.file_name().to_string_lossy().to_string();
            let file_type = match entry.file_type() {
                Ok(file_type) => file_type,
                Err(_) => continue,
            };
            let is_ignored = repo
                .as_ref()
                .and_then(|r| r.status_should_ignore(rel_path).ok())
                .unwrap_or(false);
            if file_type.is_dir() {
                if should_always_skip(&name) {
                    continue;
                }
                directories.push(normalized.clone());
                if is_ignored {
                    gitignored_directories.push(normalized);
                }
            } else if file_type.is_file() {
                if name == ".DS_Store" {
                    continue;
                }
                files.push(normalized.clone());
                if is_ignored {
                    gitignored_files.push(normalized);
                }
                if files.len() >= max_files {
                    sort_and_dedup_workspace_lists(
                        &mut files,
                        &mut directories,
                        &mut gitignored_files,
                        &mut gitignored_directories,
                    );
                    return WorkspaceFilesResponse {
                        files,
                        directories,
                        gitignored_files,
                        gitignored_directories,
                    };
                }
            }
        }
    }

    let root_for_filter = root.clone();
    let pruned_special_directories_for_filter = Arc::clone(&pruned_special_directories);
    let walker = WalkBuilder::new(root)
        .hidden(false)
        .follow_links(false)
        .require_git(false)
        .git_ignore(false)
        .filter_entry(move |entry| {
            if entry.depth() == 0 {
                return true;
            }
            let name = entry.file_name().to_string_lossy();
            if entry.file_type().is_some_and(|ft| ft.is_dir()) {
                if should_always_skip(&name) {
                    return false;
                }
                if let Ok(rel_path) = entry.path().strip_prefix(&root_for_filter) {
                    let normalized = normalize_git_path(&rel_path.to_string_lossy());
                    if !normalized.is_empty() && is_special_directory_path(&normalized) {
                        if let Ok(mut special_dirs) = pruned_special_directories_for_filter.lock() {
                            special_dirs.insert(normalized);
                        }
                        return false;
                    }
                }
                return true;
            }
            // Skip OS metadata files
            name != ".DS_Store"
        })
        .build();

    for entry in walker {
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => continue,
        };
        if entry.depth() <= 1 {
            continue;
        }
        if let Ok(rel_path) = entry.path().strip_prefix(root) {
            let normalized = normalize_git_path(&rel_path.to_string_lossy());
            if normalized.is_empty() {
                continue;
            }
            let is_ignored = repo
                .as_ref()
                .and_then(|r| r.status_should_ignore(rel_path).ok())
                .unwrap_or(false);
            if entry.file_type().is_some_and(|ft| ft.is_dir()) {
                directories.push(normalized.clone());
                if is_ignored {
                    gitignored_directories.push(normalized);
                }
            } else if entry.file_type().is_some_and(|ft| ft.is_file()) {
                files.push(normalized.clone());
                if is_ignored {
                    gitignored_files.push(normalized);
                }
                if files.len() >= max_files {
                    break;
                }
            }
        }
    }

    if let Ok(special_dirs) = pruned_special_directories.lock() {
        for normalized in special_dirs.iter() {
            directories.push(normalized.clone());
            let relative_path = normalized_relative_to_pathbuf(normalized);
            let is_ignored = repo
                .as_ref()
                .and_then(|r| r.status_should_ignore(&relative_path).ok())
                .unwrap_or(false);
            if is_ignored {
                gitignored_directories.push(normalized.clone());
            }
        }
    }

    sort_and_dedup_workspace_lists(
        &mut files,
        &mut directories,
        &mut gitignored_files,
        &mut gitignored_directories,
    );
    WorkspaceFilesResponse {
        files,
        directories,
        gitignored_files,
        gitignored_directories,
    }
}

pub(crate) fn list_workspace_directory_children_inner(
    root: &PathBuf,
    directory_path: &str,
    max_entries: usize,
) -> Result<WorkspaceFilesResponse, String> {
    let normalized_path = normalize_workspace_relative_directory_path(directory_path)?;
    let canonical_root = root
        .canonicalize()
        .map_err(|err| format!("Failed to resolve workspace root: {err}"))?;
    let candidate = canonical_root.join(normalized_relative_to_pathbuf(&normalized_path));
    let canonical_path = candidate
        .canonicalize()
        .map_err(|err| format!("Failed to resolve directory path: {err}"))?;
    if !canonical_path.starts_with(&canonical_root) {
        return Err("Invalid directory path.".to_string());
    }
    let metadata = std::fs::metadata(&canonical_path)
        .map_err(|err| format!("Failed to read directory metadata: {err}"))?;
    if !metadata.is_dir() {
        return Err("Path is not a directory.".to_string());
    }

    let repo = Repository::open(&canonical_root).ok();
    let mut files = Vec::new();
    let mut directories = Vec::new();
    let mut gitignored_files = Vec::new();
    let mut gitignored_directories = Vec::new();

    let entries = std::fs::read_dir(&canonical_path)
        .map_err(|err| format!("Failed to read directory: {err}"))?;
    let mut sorted_entries = entries.filter_map(|entry| entry.ok()).collect::<Vec<_>>();
    sorted_entries.sort_by(|a, b| {
        a.file_name()
            .to_string_lossy()
            .cmp(&b.file_name().to_string_lossy())
    });

    for entry in sorted_entries {
        let path = entry.path();
        let rel_path = match path.strip_prefix(&canonical_root) {
            Ok(value) => value,
            Err(_) => continue,
        };
        let normalized = normalize_git_path(&rel_path.to_string_lossy());
        if normalized.is_empty() {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        let file_type = match entry.file_type() {
            Ok(value) => value,
            Err(_) => continue,
        };
        let is_ignored = repo
            .as_ref()
            .and_then(|r| r.status_should_ignore(rel_path).ok())
            .unwrap_or(false);

        if file_type.is_dir() {
            if should_always_skip(&name) {
                continue;
            }
            directories.push(normalized.clone());
            if is_ignored {
                gitignored_directories.push(normalized);
            }
        } else if file_type.is_file() {
            if name == ".DS_Store" {
                continue;
            }
            files.push(normalized.clone());
            if is_ignored {
                gitignored_files.push(normalized);
            }
        }

        if files.len() + directories.len() >= max_entries {
            break;
        }
    }

    sort_and_dedup_workspace_lists(
        &mut files,
        &mut directories,
        &mut gitignored_files,
        &mut gitignored_directories,
    );
    Ok(WorkspaceFilesResponse {
        files,
        directories,
        gitignored_files,
        gitignored_directories,
    })
}

const MAX_WORKSPACE_FILE_BYTES: u64 = 400_000;

#[derive(Serialize, Deserialize, Clone)]
pub(crate) struct WorkspaceFileResponse {
    content: String,
    truncated: bool,
}

#[derive(Serialize, Deserialize, Clone)]
pub(crate) struct ExternalSpecFileResponse {
    pub(crate) exists: bool,
    pub(crate) content: String,
    pub(crate) truncated: bool,
}

fn normalize_external_spec_root(spec_root: &str) -> Result<PathBuf, String> {
    let trimmed = spec_root.trim();
    if trimmed.is_empty() {
        return Err("Spec root cannot be empty.".to_string());
    }
    let root = PathBuf::from(trimmed);
    if !root.is_absolute() {
        return Err("Spec root must be an absolute path.".to_string());
    }
    let canonical = root
        .canonicalize()
        .map_err(|err| format!("Failed to resolve custom spec root: {err}"))?;
    if !canonical.is_dir() {
        return Err("Custom spec root is not a directory.".to_string());
    }
    Ok(canonical)
}

fn resolve_external_spec_logical_path(
    spec_root: &Path,
    logical_path: &str,
) -> Result<PathBuf, String> {
    let normalized = logical_path.trim().replace('\\', "/");
    if normalized == "openspec" {
        return Ok(spec_root.to_path_buf());
    }
    if !normalized.starts_with("openspec/") {
        return Err("External spec path must be under openspec/.".to_string());
    }
    let suffix = normalized["openspec/".len()..].trim();
    if suffix.is_empty() {
        return Ok(spec_root.to_path_buf());
    }
    let relative = Path::new(suffix);
    for component in relative.components() {
        match component {
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err("Invalid external spec path.".to_string());
            }
            _ => {}
        }
    }
    Ok(spec_root.join(relative))
}

pub(crate) fn list_external_spec_tree_inner(
    spec_root: &str,
    max_files: usize,
) -> Result<WorkspaceFilesResponse, String> {
    let root = normalize_external_spec_root(spec_root)?;
    let mut files = Vec::new();
    let mut directories = vec!["openspec".to_string()];

    let walker = WalkBuilder::new(&root)
        .hidden(false)
        .follow_links(false)
        .require_git(false)
        .git_ignore(false)
        .filter_entry(|entry| {
            if entry.depth() == 0 {
                return true;
            }
            let name = entry.file_name().to_string_lossy();
            if entry.file_type().is_some_and(|ft| ft.is_dir()) {
                return !should_always_skip(&name);
            }
            name != ".DS_Store"
        })
        .build();

    for entry in walker {
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => continue,
        };
        let rel_path = match entry.path().strip_prefix(&root) {
            Ok(path) => path,
            Err(_) => continue,
        };
        let normalized = normalize_git_path(&rel_path.to_string_lossy());
        if normalized.is_empty() {
            continue;
        }
        let logical = format!("openspec/{normalized}");
        if entry.file_type().is_some_and(|ft| ft.is_dir()) {
            directories.push(logical);
        } else if entry.file_type().is_some_and(|ft| ft.is_file()) {
            files.push(logical);
            if files.len() >= max_files {
                break;
            }
        }
    }

    files.sort();
    files.dedup();
    directories.sort();
    directories.dedup();
    Ok(WorkspaceFilesResponse {
        files,
        directories,
        gitignored_files: Vec::new(),
        gitignored_directories: Vec::new(),
    })
}

pub(crate) fn read_external_spec_file_inner(
    spec_root: &str,
    logical_path: &str,
) -> Result<ExternalSpecFileResponse, String> {
    let root = normalize_external_spec_root(spec_root)?;
    let candidate = resolve_external_spec_logical_path(&root, logical_path)?;
    if !candidate.exists() {
        return Ok(ExternalSpecFileResponse {
            exists: false,
            content: String::new(),
            truncated: false,
        });
    }
    let canonical_path = candidate
        .canonicalize()
        .map_err(|err| format!("Failed to resolve external spec file: {err}"))?;
    if !canonical_path.starts_with(&root) {
        return Err("Invalid external spec file path.".to_string());
    }
    let metadata = std::fs::metadata(&canonical_path)
        .map_err(|err| format!("Failed to read external spec file metadata: {err}"))?;
    if !metadata.is_file() {
        return Ok(ExternalSpecFileResponse {
            exists: false,
            content: String::new(),
            truncated: false,
        });
    }

    let file = File::open(&canonical_path)
        .map_err(|err| format!("Failed to open external spec file: {err}"))?;
    let mut buffer = Vec::new();
    file.take(MAX_WORKSPACE_FILE_BYTES + 1)
        .read_to_end(&mut buffer)
        .map_err(|err| format!("Failed to read external spec file: {err}"))?;

    let truncated = buffer.len() > MAX_WORKSPACE_FILE_BYTES as usize;
    if truncated {
        buffer.truncate(MAX_WORKSPACE_FILE_BYTES as usize);
    }
    let content = String::from_utf8(buffer)
        .map_err(|_| "External spec file is not valid UTF-8".to_string())?;
    Ok(ExternalSpecFileResponse {
        exists: true,
        content,
        truncated,
    })
}

pub(crate) fn write_external_spec_file_inner(
    spec_root: &str,
    logical_path: &str,
    content: &str,
) -> Result<(), String> {
    if content.len() > MAX_WORKSPACE_FILE_BYTES as usize {
        return Err("File content exceeds maximum allowed size".to_string());
    }
    let root = normalize_external_spec_root(spec_root)?;
    let candidate = resolve_external_spec_logical_path(&root, logical_path)?;
    if candidate == root {
        return Err("Cannot write to external spec root directory directly.".to_string());
    }

    let normalized = logical_path.replace('\\', "/");
    if normalized == ".git"
        || normalized.starts_with(".git/")
        || normalized.contains("/.git/")
        || normalized.ends_with("/.git")
    {
        return Err("Cannot write to .git directory".to_string());
    }

    if let Some(parent) = candidate.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|err| format!("Failed to create external spec parent directory: {err}"))?;
        let canonical_parent = parent
            .canonicalize()
            .map_err(|err| format!("Failed to resolve external spec parent directory: {err}"))?;
        if !canonical_parent.starts_with(&root) {
            return Err("Invalid external spec file path.".to_string());
        }
    } else {
        return Err("Invalid external spec file path.".to_string());
    }

    std::fs::write(&candidate, content)
        .map_err(|err| format!("Failed to write external spec file: {err}"))?;
    Ok(())
}

pub(crate) fn read_workspace_file_inner(
    root: &PathBuf,
    relative_path: &str,
) -> Result<WorkspaceFileResponse, String> {
    let canonical_root = root
        .canonicalize()
        .map_err(|err| format!("Failed to resolve workspace root: {err}"))?;
    let candidate = canonical_root.join(relative_path);
    let canonical_path = candidate
        .canonicalize()
        .map_err(|err| format!("Failed to open file: {err}"))?;
    if !canonical_path.starts_with(&canonical_root) {
        return Err("Invalid file path".to_string());
    }
    let metadata = std::fs::metadata(&canonical_path)
        .map_err(|err| format!("Failed to read file metadata: {err}"))?;
    if !metadata.is_file() {
        return Err("Path is not a file".to_string());
    }

    let file = File::open(&canonical_path).map_err(|err| format!("Failed to open file: {err}"))?;
    let mut buffer = Vec::new();
    file.take(MAX_WORKSPACE_FILE_BYTES + 1)
        .read_to_end(&mut buffer)
        .map_err(|err| format!("Failed to read file: {err}"))?;

    let truncated = buffer.len() > MAX_WORKSPACE_FILE_BYTES as usize;
    if truncated {
        buffer.truncate(MAX_WORKSPACE_FILE_BYTES as usize);
    }

    let content = String::from_utf8(buffer).map_err(|_| "File is not valid UTF-8".to_string())?;
    Ok(WorkspaceFileResponse { content, truncated })
}

pub(crate) fn write_workspace_file_inner(
    root: &PathBuf,
    relative_path: &str,
    content: &str,
) -> Result<(), String> {
    let canonical_root = root
        .canonicalize()
        .map_err(|err| format!("Failed to resolve workspace root: {err}"))?;
    let candidate = canonical_root.join(relative_path);

    // Ensure the parent directory exists so we can canonicalize safely.
    if let Some(parent) = candidate.parent() {
        let canonical_parent = parent
            .canonicalize()
            .map_err(|err| format!("Failed to resolve parent directory: {err}"))?;
        if !canonical_parent.starts_with(&canonical_root) {
            return Err("Invalid file path".to_string());
        }
    }

    // Block writes into .git directories.
    let normalized = relative_path.replace('\\', "/");
    if normalized == ".git"
        || normalized.starts_with(".git/")
        || normalized.contains("/.git/")
        || normalized.contains("/.git")
    {
        return Err("Cannot write to .git directory".to_string());
    }

    if content.len() > MAX_WORKSPACE_FILE_BYTES as usize {
        return Err("File content exceeds maximum allowed size".to_string());
    }

    std::fs::write(&candidate, content).map_err(|err| format!("Failed to write file: {err}"))?;
    Ok(())
}

pub(crate) fn trash_workspace_item_inner(
    root: &PathBuf,
    relative_path: &str,
) -> Result<(), String> {
    let canonical_root = root
        .canonicalize()
        .map_err(|err| format!("Failed to resolve workspace root: {err}"))?;
    let candidate = canonical_root.join(relative_path);
    let canonical_path = candidate
        .canonicalize()
        .map_err(|err| format!("Failed to resolve path: {err}"))?;

    if !canonical_path.starts_with(&canonical_root) {
        return Err("Invalid file path".to_string());
    }

    let normalized = relative_path.replace('\\', "/");
    if normalized == ".git"
        || normalized.starts_with(".git/")
        || normalized.contains("/.git/")
        || normalized.contains("/.git")
    {
        return Err("Cannot delete items in .git directory".to_string());
    }

    if !canonical_path.exists() {
        return Err("Path does not exist".to_string());
    }

    trash::delete(&canonical_path).map_err(|err| format!("Failed to move to trash: {err}"))?;

    Ok(())
}

/// Copy a file or directory within the workspace, appending " copy" (or " copy N")
/// to avoid name collisions.
pub(crate) fn copy_workspace_item_inner(
    root: &PathBuf,
    relative_path: &str,
) -> Result<String, String> {
    let canonical_root = root
        .canonicalize()
        .map_err(|err| format!("Failed to resolve workspace root: {err}"))?;
    let candidate = canonical_root.join(relative_path);
    let canonical_path = candidate
        .canonicalize()
        .map_err(|err| format!("Failed to resolve path: {err}"))?;

    if !canonical_path.starts_with(&canonical_root) {
        return Err("Invalid file path".to_string());
    }

    let normalized = relative_path.replace('\\', "/");
    if normalized == ".git"
        || normalized.starts_with(".git/")
        || normalized.contains("/.git/")
        || normalized.contains("/.git")
    {
        return Err("Cannot copy items in .git directory".to_string());
    }

    if !canonical_path.exists() {
        return Err("Path does not exist".to_string());
    }

    // Build destination path with " copy" suffix
    let parent = canonical_path
        .parent()
        .ok_or_else(|| "Invalid file path".to_string())?;

    let stem = canonical_path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("");
    let ext = canonical_path.extension().and_then(|s| s.to_str());

    let mut dest;
    let mut counter = 0u32;
    loop {
        let suffix = if counter == 0 {
            " copy".to_string()
        } else {
            format!(" copy {counter}")
        };
        let new_name = if canonical_path.is_dir() {
            format!("{stem}{suffix}")
        } else if let Some(e) = ext {
            format!("{stem}{suffix}.{e}")
        } else {
            format!("{stem}{suffix}")
        };
        dest = parent.join(&new_name);
        if !dest.exists() {
            break;
        }
        counter += 1;
        if counter > 999 {
            return Err("Too many copies exist".to_string());
        }
    }

    if canonical_path.is_dir() {
        copy_dir_recursive(&canonical_path, &dest)?;
    } else {
        std::fs::copy(&canonical_path, &dest)
            .map_err(|err| format!("Failed to copy file: {err}"))?;
    }

    // Return the relative path of the new copy
    let new_relative = dest
        .strip_prefix(&canonical_root)
        .map_err(|_| "Failed to compute relative path".to_string())?;
    Ok(normalize_git_path(&new_relative.to_string_lossy()))
}

fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> Result<(), String> {
    std::fs::create_dir_all(dst).map_err(|err| format!("Failed to create directory: {err}"))?;
    for entry in std::fs::read_dir(src).map_err(|err| format!("Failed to read directory: {err}"))? {
        let entry = entry.map_err(|err| format!("Failed to read entry: {err}"))?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            std::fs::copy(&src_path, &dst_path)
                .map_err(|err| format!("Failed to copy file: {err}"))?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::is_special_directory_path;

    #[test]
    fn special_directory_path_detection_supports_dependency_dirs() {
        assert!(is_special_directory_path("node_modules"));
        assert!(is_special_directory_path("apps/web/node_modules"));
        assert!(is_special_directory_path("tools/.pnpm-store"));
        assert!(is_special_directory_path("sdk/.m2"));
        assert!(is_special_directory_path("rust/.cargo"));
    }

    #[test]
    fn special_directory_path_detection_supports_build_dirs() {
        assert!(is_special_directory_path("target"));
        assert!(is_special_directory_path("packages/ui/dist"));
        assert!(is_special_directory_path("service/build"));
        assert!(is_special_directory_path("native/cmake-build-debug"));
        assert!(is_special_directory_path("cache/.turbo"));
    }

    #[test]
    fn special_directory_path_detection_does_not_match_source_or_docs() {
        assert!(!is_special_directory_path("src"));
        assert!(!is_special_directory_path("docs"));
        assert!(!is_special_directory_path("apps/web/src"));
    }
}
