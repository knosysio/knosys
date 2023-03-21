内置了一些较为常用且通用的命令。

## 站点类

与静态站点构建相关的命令，从配置文件的 `site` 配置项读取配置后操作——

### `generate`

若将 `generate` 命令映射到 `build` npm script，可通过 `npm run build [site]` 从数据源生成站点数据与页面文件，`[site]` 不指定时默认为 `default`。

### `serve`

若将 `serve` 命令映射到 `start` npm script，可通过 `npm start [site]` 启动站点进行调试，`[site]` 不指定时默认为 `default`。

### `deploy`

若将 `deploy` 命令映射到 `deploy` npm script，可通过 `npm run deploy [site]` 构建并部署站点到指定远程 Git 仓库，`[site]` 不指定时默认为 `default`。
