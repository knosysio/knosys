数据源文件夹及其包含的代表「类别」与「集合」的文件夹可通过放置一个带有 `basic.yml` 文件的 `.meta` 文件夹进行数据处理相关的一些定制 `basic.yml` 中的配置项为——

## 配置项

| 属性名 | 值类型/可选值 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `path` | `string` | `':category/:collection/:slug'` | 文件目录层级结构，详见下方 |
| `permalink` | `string` | `'/:category/:collection/:slug/'` | 生成页面的链接形式 |

### `path`

支持 `类别/集合/记录` 与 `集合/记录` 两种模式——其中 `:category` 对应 `类别`，`:collection` 对应 `集合`，之后的任意多层级的文件夹都被认为是 `记录`。
