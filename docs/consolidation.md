# KnoSys 整合工作区

开发环境要求 Node.js 24 和 pnpm 9.15.9。SDK 与 CLI 发行物支持 Node.js 14.0.0 及以上版本；两种 Web 运行模式均要求 Node.js 24。源码来源和许可证边界见 [source-provenance.json](source-provenance.json)。原 SDK 与 CLI 仓库继续独立维护。

## 首次安装与构建

从任务负责人处取得与 `artifact-lock.json` 匹配的制品库，其中包含精确版本的 Emotie SDK、UI、契约和 extension-tools 包。安装不依赖相邻仓库。

```sh
node scripts/restore-artifacts.ts --from /absolute/artifact-library
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
pnpm test:production
pnpm test:bootstrap
```

恢复命令先校验归档路径、包身份和 SHA256，再将文件写入被 Git 忽略的 `.build/artifacts`。此步骤只恢复扩展制品。离线安装还要求 pnpm store 中已有普通依赖；未预热时，`pnpm install --offline --frozen-lockfile` 会失败。不要通过替换包版本或重新生成锁文件绕过制品缺失。

`packages/sdk` 负责存储和站点生成。`packages/web-core` 提供相互隔离的 browser、server 和 contracts 入口。`apps/app-web` 提供独立 Web 外壳；`apps/app-emotie` 提供 Emotie 会话、toast、路由和 Portal 适配。`apps/app-cli` 提供 `ksio`；`apps/app-crx` 保留原浏览器扩展。现有 `sites` 和 `pnpm build:site` 仍可使用。

## 独立 Web 模式

启动前先创建项目目录。显式授权的根目录不会授予访问其他目录的权限。

```sh
KNOSYS_APPS_ROOT=/absolute/registrations KNOSYS_ALLOWED_ROOTS='["/absolute/project"]' pnpm ksio app serve
```

默认地址为 `http://127.0.0.1:8001`。可显式设置 `KNOSYS_PORT` 和仅允许回环地址的 `KNOSYS_HOST`；端口被占用时启动失败，不自动选择其他端口。生产模式提供构建后的静态文件和共用 API。开发时可通过 `KNOSYS_VITE_ORIGIN` 显式允许一个回环 Vite 来源。HTTP 写入要求同源 JSON 请求；脚本应使用 SDK 或 CLI，不应绕过此策略。

独立安装 CLI 后，使用 `ksio app serve --web-path /absolute/built-web-directory`。目标目录必须包含 `server.mjs` 和构建后的资源。Node.js 14 会在加载 Web 模块前拒绝启动 Web 服务。

通过初始化向导登记已有源或创建新源。登记不会修改源数据；创建要求目标目录尚不存在。应用登记和可重建索引位于配置的应用根目录下，实际 QiiDB 内容、稳定身份表和恢复日志位于外部源中。普通配置更新不能修改应用标识、源绑定或路径模式。

## Emotie 发行包

```sh
pnpm pack:emotie --to /absolute/artifact-library
```

此命令生成一个按内容摘要命名的 `.tgz`，同时提供普通 exports 和运行时入口，并生成 `knosys-artifact.json`。私有 SDK/core 实现已打入包中。普通浏览器入口仍使用声明为宿主共享的 React、Router、HeroUI 和 Emotie 包。归档与匹配的共享制品应一起保存；归档和生成的 dist 不提交 Git。

在 Emotie 中显式锁定生成的文件，并在准备或构建官方包前恢复：

```sh
pnpm artifacts:pin --key knosys --file /absolute/artifact-library/knosys-VERSION-HASH.tgz
pnpm restore-artifacts --from /absolute/artifact-library
pnpm extensions:pack:official
```

以上操作不会将扩展安装到运行中的实例，也不会改变默认安装选择。上传安装、发行发布和正式环境操作需要另行授权。

## 迁移与回退

所有真实数据迁移均需另行批准。先在经过校验的备份上操作。备份必须同时包含应用登记和外部源目录；仅备份登记并不完整。

1. 停止全部旧 Web、CLI、定时任务和其他写入者。旧工具不遵守新的锁协议。
2. 备份所有登记、JSON 存储、外部源、附件和配置。
3. 针对已停止写入的输入重新生成计划。对存在歧义的集合、ID、冲突字段，以及明确接受的仅索引记录，提供显式映射决策。

```sh
pnpm ksio migrate plan --source /absolute/old/apps --target /absolute/nonexistent-target --output /absolute/plan.json
pnpm ksio migrate plan --source /absolute/old/apps --target /absolute/another-new-target --mapping /absolute/mapping.json --output /absolute/resolved-plan.json
pnpm ksio migrate apply --plan /absolute/resolved-plan.json --old-writers-stopped
pnpm ksio migrate verify --report /absolute/another-new-target/reports/migration.json
```

类型化的 `MigrationMapping` 契约见 `packages/sdk/src/storage/migration.ts`。每条映射通过 `app`、`collectionKey`、`legacyId`、`collectionPath` 和 `recordPath` 定位记录；可选字段包括 `systemId`、逐字段的 `fieldSources`（`source`、`json` 或 `index`），以及显式的 `acceptIndexOnly`。未解决的阻断项会禁止执行迁移。输入发生变化后必须重新规划。目标必须尚不存在，且不得与输入或宿主受管删除范围重叠。失败目标会保留未完成诊断；重试应使用新目标，不要删除归属不明的文件。

纯 QiiDB 应用保留其外部源，并生成新的登记和映射。JSON 与混合格式应用会在 `target/data` 下生成新的 QiiDB 副本。原始源和 JSON 字节保持不变。生成的 `target/apps` 是新的登记根目录。审阅报告并校验输出后，将 `KNOSYS_APPS_ROOT` 指向该目录启动新外壳，检查读取结果后再允许写入。

新登记中记录最低写入工具版本；缺失或不受支持的版本会被拒绝写入。手动登记源意味着明确采用新协议，因此必须先停止旧写入者。锁只保证同机本地文件系统上的进程序列化，不支持跨主机网络文件系统。外部手工修改只能通过 revision 摘要检测，无法被阻止。

尚未发生新写入时，可以停止新外壳并恢复旧登记配置。发生任何新写入后，必须先冻结所有写入者，导出或迁回变化并完成校验，再进行切换。不要直接用旧工具重新打开已变化的源。系统不提供自动反向覆盖或删除命令。

只有确认锁中记录的同机进程已经退出后，才能显式恢复遗留锁：

```sh
pnpm ksio recover-lock /absolute/source
```

不能强制接管活跃或无法核实的锁持有者。备份和恢复时应保留 `.knosys/transactions`。读取者在提供快照前，会回滚 prepared 状态的事务，或补全 committed 状态的事务；缺少恢复材料时停止访问该源。

禁用或卸载 Emotie 扩展会移除其运行时样式和 Portal。删除数据选项只清理宿主受管数据，不会沿登记中的引用删除外部 QiiDB 源。外部源需要单独备份和管理。
