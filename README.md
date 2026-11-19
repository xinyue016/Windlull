# 风歇小筑

纯前端、可离线部署的情绪觉察与解压网站。

## 页面

- `index.html`：主页面、情绪轮、情绪调节内容、每日刮刮乐与昼夜主题
- `game.html`：脆皮捏捏乐、果冻工坊、敲木鱼、静心流沙
- `chat.html`：本地情绪日记

## 运行

直接打开 `index.html` 即可预览。为保证跨页面音乐和 localStorage 状态正常，建议在项目目录运行：

```bash
python -m http.server 8000
```

然后访问 `http://localhost:8000`。

## 目录

```text
assets/
  audio/   页面音乐、游戏音乐与程序化音频数据
  css/     页面样式
  data/    治愈语录数据
  images/  页面内图片
  js/      页面与 3D 交互逻辑
  vendor/  Three.js 本地运行文件
图片/      背景图、Logo 与游戏宣传图
```

## 存储

所有个人状态只写入当前浏览器的 localStorage，不连接后端，也不上传服务器。

## 资源说明

- 页面结构、样式与业务交互代码由项目创作者编写或借助系统工具生成。
- 3D 场景使用本地 Three.js 开源库。
- 主页面背景音乐：《Morning》 — Kevin MacLeod，来源 Incompetech，CC BY 4.0；仅用于网页背景播放，未改变音乐内容。
- 小游戏背景音乐：“Northern Glade” — Kevin MacLeod，Licensed under Creative Commons: By Attribution 4.0 License。
- 其余视觉素材由项目创作者提供或生成。

## 使用声明

本站用于日常情绪觉察与放松，不替代医疗诊断、心理治疗或危机干预。