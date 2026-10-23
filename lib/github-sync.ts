// lib/github-sync.ts
import { dbService, ScriptRecord } from "./store";

export interface GitHubSyncOptions {
  repo: string; // "owner/repo" or "https://github.com/owner/repo"
  branch?: string; // default: "main"
  directory?: string; // directory path, e.g. "Rivals" or "rivals" or ""
  token?: string | null; // optional Personal Access Token
}

export interface GitHubSyncResult {
  success: boolean;
  commitSha: string;
  filesCount: number;
  files: string[];
  entryFile?: string;
  error?: string;
}

/**
 * Parses user input into a clean "owner/repo" string.
 */
export function parseGitHubRepoSlug(input: string): { owner: string; repo: string } | null {
  if (!input) return null;
  let clean = input.trim();
  clean = clean.replace(/^https?:\/\/github\.com\//i, "");
  clean = clean.replace(/\.git$/i, "");
  clean = clean.replace(/\/+$/, "");

  const parts = clean.split("/");
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return { owner: parts[0].trim(), repo: parts[1].trim() };
  }
  return null;
}

/**
 * Fetches the latest commit SHA for a repository branch.
 */
export async function getLatestGitHubCommitSha(
  owner: string,
  repo: string,
  branch = "main",
  token?: string | null
): Promise<string | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(branch)}`;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "Aero-Auth-SyncEngine/1.0",
  };
  if (token && token.trim()) {
    headers["Authorization"] = `Bearer ${token.trim()}`;
  }

  try {
    const res = await fetch(url, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`GitHub getLatestCommitSha failed (${res.status}): ${await res.text()}`);
      return null;
    }
    const data = await res.json();
    return data.sha || null;
  } catch (err) {
    console.error("Error fetching latest GitHub commit SHA:", err);
    return null;
  }
}

/**
 * Fetches directory contents from GitHub repository tree.
 * Matches directories case-insensitively.
 */
export async function fetchFilesFromGitHub(
  options: GitHubSyncOptions
): Promise<GitHubSyncResult> {
  const parsed = parseGitHubRepoSlug(options.repo);
  if (!parsed) {
    return {
      success: false,
      commitSha: "",
      filesCount: 0,
      files: [],
      error: `Invalid GitHub repository format: '${options.repo}'. Expected 'owner/repo' or full GitHub URL.`,
    };
  }

  const { owner, repo } = parsed;
  const branch = options.branch?.trim() || "main";
  const targetDir = (options.directory || "").trim().replace(/^\/+|\/+$/g, "");
  const token = options.token?.trim() || null;

  // 1. Fetch latest commit SHA
  const commitSha = (await getLatestGitHubCommitSha(owner, repo, branch, token)) || `sync_${Date.now()}`;

  // 2. Fetch Git Tree recursively
  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
  const treeHeaders: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "Aero-Auth-SyncEngine/1.0",
  };
  if (token) {
    treeHeaders["Authorization"] = `Bearer ${token}`;
  }

  let treeData: any = null;
  try {
    const res = await fetch(treeUrl, {
      headers: treeHeaders,
      cache: "no-store",
    });
    if (!res.ok) {
      const errBody = await res.text();
      return {
        success: false,
        commitSha,
        filesCount: 0,
        files: [],
        error: `GitHub API error (${res.status}): ${errBody}`,
      };
    }
    treeData = await res.json();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      commitSha,
      filesCount: 0,
      files: [],
      error: `Network error connecting to GitHub: ${msg}`,
    };
  }

  if (!treeData || !Array.isArray(treeData.tree)) {
    return {
      success: false,
      commitSha,
      filesCount: 0,
      files: [],
      error: "GitHub response did not contain a valid file tree.",
    };
  }

  // 3. Filter tree for target directory and script file extensions (.lua, .luau, .txt)
  const normTargetDir = targetDir.toLowerCase();
  const validExtensions = [".lua", ".luau", ".txt"];

  const matchedEntries: { fullPath: string; relPath: string }[] = [];

  for (const item of treeData.tree) {
    if (item.type !== "blob" || typeof item.path !== "string") continue;
    const pathStr = item.path;
    const lowerPath = pathStr.toLowerCase();

    // Check extension
    const hasValidExt = validExtensions.some((ext) => lowerPath.endsWith(ext));
    if (!hasValidExt) continue;

    if (!normTargetDir) {
      // Root level: include all script files
      matchedEntries.push({ fullPath: pathStr, relPath: pathStr });
    } else {
      // Must reside within the specified directory (case-insensitive)
      const prefixWithSlash = normTargetDir + "/";
      if (lowerPath.startsWith(prefixWithSlash)) {
        // Strip the target directory prefix
        const rel = pathStr.substring(prefixWithSlash.length);
        matchedEntries.push({ fullPath: pathStr, relPath: rel });
      } else if (lowerPath === normTargetDir) {
        matchedEntries.push({ fullPath: pathStr, relPath: pathStr.split("/").pop() || pathStr });
      }
    }
  }

  if (matchedEntries.length === 0) {
    return {
      success: false,
      commitSha,
      filesCount: 0,
      files: [],
      error: `No script files (.lua, .luau, .txt) found in repository '${owner}/${repo}' under directory '${targetDir || "/"}' (branch: ${branch}).`,
    };
  }

  // 4. Download file contents concurrently
  const fetchedModules: Record<string, string> = {};
  const cacheBuster = Date.now();

  await Promise.all(
    matchedEntries.map(async ({ fullPath, relPath }) => {
      try {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(branch)}/${fullPath}?v=${cacheBuster}`;
        const rawHeaders: Record<string, string> = {
          "User-Agent": "Aero-Auth-SyncEngine/1.0",
        };
        if (token) {
          rawHeaders["Authorization"] = `Bearer ${token}`;
        }
        const res = await fetch(rawUrl, {
          headers: rawHeaders,
          cache: "no-store",
        });
        if (res.ok) {
          const content = await res.text();
          fetchedModules[relPath] = content;
        } else {
          console.warn(`Failed to fetch raw file ${fullPath}: status ${res.status}`);
        }
      } catch (err) {
        console.error(`Error fetching raw file ${fullPath}:`, err);
      }
    })
  );

  const finalFiles = Object.keys(fetchedModules);
  if (finalFiles.length === 0) {
    return {
      success: false,
      commitSha,
      filesCount: 0,
      files: [],
      error: "Failed to download content for any matched files from GitHub.",
    };
  }

  // 5. Determine entry file
  const preferredInit =
    finalFiles.find((k) => k.toLowerCase() === "init.lua" || k.toLowerCase() === "init.txt") ||
    finalFiles.find((k) => k.toLowerCase() === "main.lua" || k.toLowerCase() === "main.txt") ||
    finalFiles[0];

  return {
    success: true,
    commitSha,
    filesCount: finalFiles.length,
    files: finalFiles,
    entryFile: preferredInit,
    modules: fetchedModules,
  } as GitHubSyncResult & { modules: Record<string, string> };
}

/**
 * Synchronizes an existing script in the database from its connected GitHub repository.
 */
export async function syncScriptFromGitHub(
  scriptIdOrSlug: string,
  options?: { force?: boolean }
): Promise<GitHubSyncResult> {
  const script = await dbService.getScriptBySlug(scriptIdOrSlug);
  if (!script) {
    return {
      success: false,
      commitSha: "",
      filesCount: 0,
      files: [],
      error: `Script '${scriptIdOrSlug}' not found.`,
    };
  }

  if (!script.github_repo) {
    return {
      success: false,
      commitSha: "",
      filesCount: 0,
      files: [],
      error: `Script '${script.name}' does not have a connected GitHub repository.`,
    };
  }

  const parsed = parseGitHubRepoSlug(script.github_repo);
  if (!parsed) {
    return {
      success: false,
      commitSha: "",
      filesCount: 0,
      files: [],
      error: `Invalid GitHub repository configuration '${script.github_repo}'.`,
    };
  }

  const branch = script.github_branch || "main";

  // Check commit SHA if not forced
  if (!options?.force && script.github_last_commit) {
    const latestSha = await getLatestGitHubCommitSha(
      parsed.owner,
      parsed.repo,
      branch,
      script.github_token
    );
    if (latestSha && latestSha === script.github_last_commit) {
      // Up to date
      return {
        success: true,
        commitSha: latestSha,
        filesCount: Object.keys(script.modules || {}).length,
        files: Object.keys(script.modules || {}),
        entryFile: script.entry_file,
      };
    }
  }

  // Perform full fetch
  const pullResult = (await fetchFilesFromGitHub({
    repo: script.github_repo,
    branch,
    directory: script.github_directory || "",
    token: script.github_token,
  })) as GitHubSyncResult & { modules?: Record<string, string> };

  if (!pullResult.success || !pullResult.modules) {
    return pullResult;
  }

  // Update script record in store
  const now = new Date().toISOString();
  const updatedScript: ScriptRecord = {
    ...script,
    modules: pullResult.modules,
    entry_file: pullResult.entryFile || script.entry_file || "init.lua",
    github_last_commit: pullResult.commitSha,
    github_last_pulled_at: now,
    updated_at: now,
  };

  await dbService.saveScript(updatedScript);

  return {
    success: true,
    commitSha: pullResult.commitSha,
    filesCount: pullResult.filesCount,
    files: pullResult.files,
    entryFile: updatedScript.entry_file,
  };
}
