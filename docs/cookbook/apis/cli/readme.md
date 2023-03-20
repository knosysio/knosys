内置了一些较为常用且通用的命令。

## 站点类

与静态站点构建相关的命令，从配置文件的 `site` 配置项读取配置后操作——

### `serve`

通过 `npm start [site]` 启动站点进行调试，`[site]` 不指定时默认为 `default`。

### `deploy`

通过 `npm run deploy [site]` 构建并部署站点到指定远程 Git 仓库，`[site]` 不指定时默认为 `default`。
