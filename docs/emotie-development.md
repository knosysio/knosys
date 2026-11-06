# Emotie 扩展纯本地开发

在 KnoSys 仓库中运行真实的 `app-emotie` 扩展，使用本地调试壳提供路由、侧栏、主题、通知和开发身份。不需要 Emotie 源码、Emotie 服务或 Docker，也不需要反复打包和上传。

## 启动

要求 Node.js 24 和 pnpm 9.15.9。已有依赖安装完成时，在仓库根目录运行：

```sh
pnpm dev:emotie
```

打开 `http://127.0.0.1:8010/apps/knosys`。命令在前台运行，按 `Ctrl+C` 停止页面服务、API 和源码监听。默认 API 端口为 8011，仅监听回环地址；端口冲突会明确失败，不自动切换。

干净检出时，先按[整合工作区指南](consolidation.md)恢复锁定的共享制品并安装依赖：

```sh
node scripts/restore-artifacts.ts --from /absolute/artifact-library
pnpm install --frozen-lockfile
pnpm dev:emotie
```

开发命令直接处理 TypeScript 源码，无需先构建 SDK、Web 或扩展包。共享 SDK/UI/工具来自精确版本的制品依赖，不依赖任何相邻仓库。首次安装仍需普通 npm 依赖；完整离线安装要求 pnpm store 已预热。

## 测试数据

默认开发目录为 `.build/emotie-dev/data`，被 Git 忽略：

- `registrations`：开发应用登记。
- `project`：允许初始化的项目根。
- 编译缓存另存于 `.build/emotie-dev/runtime`。

进入“添加知识库”，选择“创建新的 QiiDB 源”，填写应用标识、项目根目录及 `data` 等源相对目录。项目根目录要求绝对路径，可在仓库根目录执行以下命令取得当前环境的值：

```sh
node -p "require('node:path').resolve('.build/emotie-dev/data/project')"
```

默认不会读取正式的 `~/.knosys` 或 `~/.emotie` 数据。开发 API 固定使用开发目录下的登记和项目授权，不继承普通 `KNOSYS_APPS_ROOT` 或 `KNOSYS_ALLOWED_ROOTS` 设置。CRUD、原文、附件、revision 和文件锁使用真实业务实现，不使用假业务数据。

可显式覆盖端口或开发目录：

```sh
KNOSYS_DEV_PORT=8020 KNOSYS_DEV_API_PORT=8021 pnpm dev:emotie
KNOSYS_DEV_ROOT=.build/my-extension-dev pnpm dev:emotie
```

相对开发目录从 KnoSys 仓库根解析。使用自定义目录时，初始化授权根相应变为该目录下的 `project`；请使用独立测试目录并自行排除 Git 跟踪。

## 更新行为

| 修改内容 | 开发生效方式 |
| --- | --- |
| core 业务组件和调试壳组件 | React Fast Refresh，兼容的组件修改保留本地状态 |
| core、外壳及开发 CSS | Vite 样式热更新，新增 Tailwind 类自动扫描 |
| 扩展 Web 工厂与路由贡献 | 自动重新挂载扩展，清理旧 Portal；组件状态可能重置 |
| 扩展 server、core/server、SDK 源码 | 自动重新编译并重启本地 API；页面保持打开，进行中的请求可能需重试 |
| 开发启动脚本、Vite 配置或环境变量 | 停止并重新运行命令 |

编辑器的新建和已有记录草稿，在普通组件文案热更新后均保留。改变 Hook 结构、路由、扩展工厂或手动刷新仍可能重置页面状态，重要内容应及时保存。

后端编译失败时在终端和浏览器错误层显示错误，上一份正常 API 保持服务；修复并保存源码后自动重新启动。后端运行时异常通过终端诊断。服务关闭或端口冲突时不要使用全局端口批量杀进程命令，应停止对应的开发命令。

## 开发身份

右上角可以切换管理员、普通用户和未登录状态，切换会刷新当前页面：

- 管理员：可调用管理和业务接口。
- 普通用户：可访问共享业务数据，管理接口返回 403。
- 未登录：业务和管理接口返回 401。

这些身份仅用于本地接口与页面状态模拟，不提供真实登录、用户组、会话、OIDC 或 CSRF 集成。调试 API 只支持当前扩展的 session/administrator 路由策略；遇到其他策略明确失败。Host、Origin、JSON 写入及初始化目录限制仍在后端执行。

## 实现与发行边界

正式入口 `apps/app-emotie/src/web.tsx` 注入 Emotie 的请求和通知；开发入口注入本地适配器，二者调用同一个 `web-factory.tsx`。本地 API 也调用真实 `createServerExtension`，监听 SDK 源文件以避免依赖陈旧 dist。

调试壳位于 `apps/app-emotie/dev`，不进入正式发行文件。浏览器依赖由同一个 Vite 服务去重，避免重复 React 或 Router 上下文。开发模式提供自己的完整基础样式；正式扩展继续使用宿主主题和发行样式规则。

准备交付时仍需构建正式包，并在真实 Emotie 中验证登录、权限、安装和生命周期集成；本地调试通过不能替代正式宿主验收。

```sh
pnpm typecheck
pnpm build
pnpm test:emotie:dev
pnpm pack:emotie
```

开发回归测试在仓库外创建源码副本，恢复制品并离线冻结安装；不复制 dist，不访问相邻 Emotie 仓库，不启动 Docker。验证身份、真实 CRUD、SDK 修改后的行为变化、编译失败恢复和服务端口释放。
