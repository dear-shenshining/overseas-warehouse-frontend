# Git 提交代码完整指南

## 📋 目录

1. [准备工作](#准备工作)
2. [检查当前状态](#检查当前状态)
3. [添加文件到暂存区](#添加文件到暂存区)
4. [提交更改](#提交更改)
5. [推送到远程仓库](#推送到远程仓库)
6. [常见问题解决](#常见问题解决)
7. [最佳实践](#最佳实践)

---

## 准备工作

### 1. 确认 Git 已安装

```bash
# 检查 Git 版本
git --version
```

**说明：** 如果显示版本号（如 `git version 2.52.0.windows.1`），说明 Git 已安装。

### 2. 确认 Git 配置

```bash
# 查看当前配置
git config --list

# 如果用户名和邮箱未配置，需要设置：
git config --global user.name "你的用户名"
git config --global user.email "1426225727@qq.com"
```

**说明：**
- `user.name`: 你的 Git 用户名（可以是任意名称）
- `user.email`: 你的邮箱地址（用于标识提交者）

### 3. 确认远程仓库地址

```bash
# 查看远程仓库配置
git remote -v
```

**说明：**
- 应该显示类似：`origin  https://github.com/dear-shenshining/overseas-warehouse-frontend.git (fetch)`
- 如果没有显示，需要添加远程仓库（见下方）

### 4. 添加远程仓库（如果需要）

```bash
# 添加远程仓库
git remote add origin https://github.com/dear-shenshining/overseas-warehouse-frontend.git

# 验证是否添加成功
git remote -v
```

**说明：**
- `origin` 是远程仓库的默认名称
- URL 是你的 GitHub 仓库地址

---

## 检查当前状态

### 1. 查看工作区状态

```bash
# 查看当前工作区状态（最重要的一步）
git status
```

**输出说明：**

#### 情况 A：有未跟踪的文件（新文件）
```
Untracked files:
  (use "git add <file>..." to include in what will be committed)
        lib/logistics-crawler.ts
        package.json
```

**说明：** 这些是新创建的文件，还没有被 Git 跟踪。

#### 情况 B：有已修改的文件
```
Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
        modified:   lib/logistics-crawler.ts
```

**说明：** 这些文件已被 Git 跟踪，但修改还没有暂存。

#### 情况 C：有已暂存的文件
```
Changes to be committed:
  (use "git restore --staged <file>..." to unstage)
        new file:   lib/logistics-crawler.ts
        modified:   package.json
```

**说明：** 这些文件已经添加到暂存区，准备提交。

#### 情况 D：工作区干净
```
On branch main
nothing to commit, working tree clean
```

**说明：** 所有更改都已提交，工作区没有未提交的更改。

### 2. 查看当前分支

```bash
# 查看所有分支（* 表示当前分支）
git branch
```

**输出示例：**
```
* main
  master
```

**说明：**
- `* main` 表示当前在 `main` 分支
- 如果显示 `* master`，说明当前在 `master` 分支
- 如果只显示 `* (no branch)`，说明还没有创建任何分支

### 3. 查看提交历史

```bash
# 查看最近的提交历史
git log --oneline -5
```

**输出示例：**
```
a1b2c3d (HEAD -> main) 修复HTML解析逻辑
d4e5f6g 添加cheerio依赖
g7h8i9j 初始提交
```

**说明：**
- `HEAD -> main` 表示当前在 `main` 分支
- 如果没有任何提交，会显示 `fatal: your current branch 'main' does not have any commits yet`

---

## 添加文件到暂存区

### 1. 添加单个文件

```bash
# 添加指定文件到暂存区
git add lib/logistics-crawler.ts
```

**说明：**
- 将 `lib/logistics-crawler.ts` 文件添加到暂存区
- 文件路径可以是相对路径或绝对路径

### 2. 添加多个文件

```bash
# 添加多个指定文件
git add lib/logistics-crawler.ts package.json HTML_PARSING_FIX.md
```

**说明：** 可以一次添加多个文件，用空格分隔。

### 3. 添加整个目录

```bash
# 添加整个目录下的所有文件
git add lib/
```

**说明：** 添加 `lib/` 目录下的所有文件（包括子目录）。

### 4. 添加所有更改（最常用）

```bash
# 添加所有更改的文件（包括新文件、修改的文件、删除的文件）
git add .
```

**说明：**
- `.` 表示当前目录
- 这会添加所有已跟踪文件的修改和所有未跟踪的文件
- **注意：** 不会添加 `.gitignore` 中忽略的文件

### 5. 添加所有文件（包括被删除的文件）

```bash
# 添加所有更改，包括被删除的文件
git add -A
# 或者
git add --all
```

**说明：** 与 `git add .` 类似，但会明确包括被删除的文件。

### 6. 交互式添加（高级）

```bash
# 交互式选择要添加的文件
git add -i
```

**说明：** 会显示一个交互式菜单，可以选择要添加的文件。

### 7. 验证已添加的文件

```bash
# 查看暂存区的文件
git status
```

**说明：** 已添加到暂存区的文件会显示在 "Changes to be committed" 部分。

---

## 提交更改

### 1. 基本提交命令

```bash
# 提交暂存区的所有更改
git commit -m "提交信息"
```

**说明：**
- `-m` 参数后面跟提交信息（必须用引号括起来）
- 提交信息应该清晰描述这次更改的内容

### 2. 提交信息规范

#### 好的提交信息示例：

```bash
# 简短描述
git commit -m "修复HTML解析逻辑"

# 详细描述
git commit -m "修复HTML解析逻辑：使用cheerio精确解析日邮追踪信息表格"

# 多行提交信息
git commit -m "修复HTML解析逻辑

- 使用cheerio库替代正则表达式
- 正确提取shipping_track_record字段
- 修复状态字段被错误提取的问题"
```

#### 提交信息格式建议：

```
<类型>: <简短描述>

<详细描述（可选）>

<更改列表（可选）>
```

**类型说明：**
- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码格式调整（不影响功能）
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建/工具相关

**示例：**
```bash
git commit -m "fix: 修复HTML解析逻辑，正确提取追踪状态字段"
```

### 3. 打开编辑器编写提交信息

```bash
# 不使用 -m 参数，会打开默认编辑器
git commit
```

**说明：**
- 会打开默认文本编辑器（通常是 vim 或记事本）
- 第一行写简短描述，空一行后写详细描述
- 保存并关闭编辑器即可完成提交

### 4. 提交并跳过暂存区（不推荐）

```bash
# 直接提交所有已跟踪文件的更改（跳过 git add）
git commit -a -m "提交信息"
```

**说明：**
- `-a` 参数会自动添加所有已跟踪文件的更改
- **注意：** 不会添加新文件（未跟踪的文件）
- 不推荐使用，建议先 `git add` 再 `git commit`

### 5. 修改最后一次提交

```bash
# 修改最后一次提交的信息
git commit --amend -m "新的提交信息"

# 或者添加文件到最后一次提交
git add 忘记添加的文件
git commit --amend --no-edit
```

**说明：**
- `--amend` 会修改最后一次提交
- `--no-edit` 表示不修改提交信息
- **注意：** 如果已经推送到远程，修改后需要强制推送（不推荐）

### 6. 验证提交

```bash
# 查看提交历史
git log --oneline -3

# 查看最后一次提交的详细信息
git show
```

**说明：**
- `git log` 显示提交历史
- `git show` 显示最后一次提交的详细内容

---

## 推送到远程仓库

### 1. 查看远程仓库

```bash
# 查看远程仓库配置
git remote -v
```

**输出示例：**
```
origin  https://github.com/dear-shenshining/overseas-warehouse-frontend.git (fetch)
origin  https://github.com/dear-shenshining/overseas-warehouse-frontend.git (push)
```

**说明：**
- `origin` 是远程仓库的名称（默认名称）
- `fetch` 表示拉取地址
- `push` 表示推送地址

### 2. 推送到 main 分支

```bash
# 推送到远程的 main 分支
git push origin main
```

**说明：**
- `origin` 是远程仓库名称
- `main` 是分支名称
- 如果是第一次推送，可能需要设置上游分支

### 3. 推送到 master 分支

```bash
# 推送到远程的 master 分支
git push origin master
```

**说明：** 如果远程仓库使用 `master` 作为默认分支，使用此命令。

### 4. 首次推送并设置上游分支

```bash
# 首次推送并设置上游分支（推荐）
git push -u origin main
```

**说明：**
- `-u` 或 `--set-upstream` 会设置上游分支
- 设置后，以后可以直接使用 `git push`，不需要指定分支名

### 5. 查看当前分支对应的远程分支

```bash
# 查看分支跟踪关系
git branch -vv
```

**输出示例：**
```
* main  a1b2c3d [origin/main] 修复HTML解析逻辑
```

**说明：**
- `[origin/main]` 表示本地 `main` 分支跟踪远程 `origin/main` 分支

### 6. 强制推送（谨慎使用）

```bash
# 强制推送到远程（会覆盖远程的提交）
git push --force origin main
```

**说明：**
- `--force` 会强制推送，覆盖远程的提交
- **警告：** 只有在确定要覆盖远程提交时才使用
- 如果多人协作，不要使用强制推送

### 7. 推送所有分支

```bash
# 推送所有分支到远程
git push --all origin
```

**说明：** 推送所有本地分支到远程仓库。

### 8. 推送标签

```bash
# 推送所有标签
git push --tags origin
```

**说明：** 推送本地所有标签到远程仓库。

---

## 常见问题解决

### 问题 1: `error: src refspec master does not match any`

**原因：** 本地没有 `master` 分支，或者还没有任何提交。

**解决方案：**

```bash
# 1. 检查当前分支
git branch

# 2. 如果没有分支，创建并切换到 main 分支
git checkout -b main

# 3. 如果有更改但未提交，先提交
git add .
git commit -m "初始提交"

# 4. 然后推送
git push -u origin main
```

### 问题 2: `error: failed to push some refs`

**原因：** 远程仓库有本地没有的提交。

**解决方案：**

```bash
# 1. 先拉取远程更改
git pull origin main

# 2. 如果有冲突，解决冲突后
git add .
git commit -m "解决冲突"

# 3. 然后推送
git push origin main
```

### 问题 3: 需要输入用户名和密码

**原因：** GitHub 不再支持密码认证，需要使用 Personal Access Token。

**解决方案：**

```bash
# 1. 生成 Personal Access Token（在 GitHub 网站）
#    Settings -> Developer settings -> Personal access tokens -> Tokens (classic)
#    生成新 token，勾选 repo 权限

# 2. 推送时使用 token 作为密码
git push origin main
# Username: dear-shenshining
# Password: <粘贴你的 Personal Access Token>
```

### 问题 4: 推送被拒绝（rejected）

**原因：** 远程分支有本地没有的提交。

**解决方案：**

```bash
# 方案 A：先拉取再推送（推荐）
git pull origin main
git push origin main

# 方案 B：使用 rebase（高级）
git pull --rebase origin main
git push origin main
```

### 问题 5: 忘记添加某个文件

**解决方案：**

```bash
# 1. 添加忘记的文件
git add 忘记的文件

# 2. 修改最后一次提交（不创建新提交）
git commit --amend --no-edit

# 3. 如果已经推送，需要强制推送（谨慎）
git push --force origin main
```

### 问题 6: 提交信息写错了

**解决方案：**

```bash
# 1. 修改最后一次提交信息
git commit --amend -m "正确的提交信息"

# 2. 如果已经推送，需要强制推送（谨慎）
git push --force origin main
```

---

## 完整推送流程示例

### 标准流程（推荐）

```bash
# 1. 检查当前状态
git status

# 2. 查看当前分支
git branch

# 3. 添加所有更改
git add .

# 4. 提交更改
git commit -m "修复HTML解析逻辑：使用cheerio精确解析日邮追踪信息表格"

# 5. 查看提交历史（可选）
git log --oneline -3

# 6. 推送到远程
git push origin main
```

### 首次推送流程

```bash
# 1. 检查状态
git status

# 2. 添加所有文件
git add .

# 3. 首次提交
git commit -m "初始提交：海外仓前端页面项目"

# 4. 创建 main 分支（如果还没有）
git checkout -b main

# 5. 首次推送并设置上游分支
git push -u origin main
```

### 有冲突时的流程

```bash
# 1. 尝试推送
git push origin main

# 2. 如果提示需要拉取，先拉取
git pull origin main

# 3. 如果有冲突，解决冲突文件
#    打开冲突文件，找到 <<<<<<< HEAD 标记
#    手动解决冲突，删除冲突标记

# 4. 标记冲突已解决
git add 冲突的文件

# 5. 完成合并提交
git commit -m "解决合并冲突"

# 6. 再次推送
git push origin main
```

---

## 最佳实践

### 1. 提交前检查

```bash
# 提交前总是先检查状态
git status

# 查看将要提交的更改
git diff --staged
```

### 2. 提交信息规范

- ✅ 使用清晰、简洁的描述
- ✅ 使用动词开头（如：修复、添加、更新）
- ✅ 一行描述不超过 50 个字符
- ❌ 避免使用无意义的提交信息（如：`update`、`fix`）

**好的示例：**
```bash
git commit -m "fix: 修复HTML解析逻辑，正确提取追踪状态字段"
git commit -m "feat: 添加cheerio依赖用于HTML解析"
git commit -m "docs: 更新Git推送指南文档"
```

**不好的示例：**
```bash
git commit -m "update"
git commit -m "fix bug"
git commit -m "changes"
```

### 3. 频繁提交

- ✅ 完成一个小功能就提交一次
- ✅ 修复一个 bug 就提交一次
- ❌ 不要积累大量更改才提交

### 4. 提交前测试

- ✅ 提交前确保代码可以正常运行
- ✅ 提交前运行测试（如果有）
- ❌ 不要提交无法运行的代码

### 5. 使用分支

```bash
# 创建功能分支
git checkout -b feature/html-parsing-fix

# 在分支上开发
git add .
git commit -m "修复HTML解析逻辑"

# 合并到主分支
git checkout main
git merge feature/html-parsing-fix

# 推送到远程
git push origin main
```

### 6. 不要提交敏感信息

- ❌ 不要提交 `.env` 文件（包含密码、API密钥）
- ❌ 不要提交 `node_modules/` 目录
- ✅ 使用 `.gitignore` 忽略这些文件

### 7. 推送前拉取

```bash
# 推送前先拉取远程更改
git pull origin main
git push origin main
```

---

## 快速参考命令

```bash
# 查看状态
git status

# 查看分支
git branch

# 添加文件
git add .

# 提交
git commit -m "修改时区带来的比较问题2.0"

# 推送
git push main
git push origin main

# 拉取
git pull origin main

# 查看历史
git log --oneline -5
```

---

## 总结

**标准推送流程：**

1. `git status` - 检查状态
2. `git add .` - 添加文件
3. `git commit -m "提交信息"` - 提交更改
4. `git push origin main` - 推送到远程

**如果遇到问题：**

1. 先查看错误信息
2. 根据错误信息查找对应的解决方案
3. 如果还是无法解决，可以查看 Git 帮助：`git help <命令>`

---

**文档版本：** v1.0  
**最后更新：** 2025年1月  
**适用场景：** 日常代码推送、首次推送、解决推送问题

