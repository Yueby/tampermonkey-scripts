# Booth 网站增强脚本集合

这是一个用于增强 Booth 网站功能的 Tampermonkey 脚本集合，包含多个功能模块。

## 功能特性

### 1. Booth Cookies 提取器
- 提取 Booth 网站必要的 cookies 信息
- 悬浮按钮快速提取 session
- 自动复制到剪贴板
- 桌面通知提醒
- 美化的 UI 界面和加载动画

### 2. Booth 网站功能增强
- 商品变体序号显示
- 标签批量操作功能
  - 复制标签
  - 粘贴标签
  - 清空标签
- 商品列表管理优化
- 商品编辑界面优化

### 3. Booth 网站翻译助手
- 智能检测页面语言，仅在非中文界面启动
- 使用配置文件管理翻译规则
- 支持多种内容翻译：
  - 静态内容翻译
  - 动态内容翻译
  - 属性翻译(title、placeholder等)
- 实时监听页面变化自动翻译
- 支持特殊规则处理
- 性能优化：
  - 节流控制
  - 批量处理
  - 智能缓存

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展

2. 点击下方按钮安装对应脚本：

| 脚本 | 安装 |
|------|------|
| Booth Cookies 提取器 | [![安装](https://img.shields.io/badge/-点击安装-blue.svg)](https://raw.githubusercontent.com/Yueby/tampermonkey-scripts/refs/heads/booth-scripts/booth-cookies.user.js) |
| Booth 网站功能增强 | [![安装](https://img.shields.io/badge/-点击安装-blue.svg)](https://raw.githubusercontent.com/Yueby/tampermonkey-scripts/refs/heads/booth-scripts/booth-extend.user.js) |
| Booth 网站翻译助手 | [![安装](https://img.shields.io/badge/-点击安装-blue.svg)](https://raw.githubusercontent.com/Yueby/tampermonkey-scripts/refs/heads/booth-scripts/booth-translate.user.js) |

3. 访问 Booth 网站即可自动启用功能

## 注意事项

- 翻译助手仅在检测到非中文界面时启动
- 使用的是预定义的翻译规则，非实时翻译 API
- 部分功能可能随 Booth 网站更新而需要调整

## 更新日志

### v0.1.1
- 优化翻译性能
- 修复动态内容翻译问题
- 改进 UI 交互

### v0.1.0
- 初始版本发布
- 实现基础功能
