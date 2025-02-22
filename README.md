# Booth 网站增强脚本集合

这是一个用于增强 Booth 网站功能的 Tampermonkey 脚本集合，包含多个功能模块。

## 功能特性

### 1. Booth Cookies 提取器
- 提取 Booth 网站必要的 session cookies
- 美观的 Material Design 悬浮按钮
- 自动提取和格式化 `_plaza_session_nktz7u` cookie
- 提供完整的状态反馈：
  - 加载动画
  - 成功/失败状态显示
  - 桌面通知提醒
- 自动复制到剪贴板（JSON 格式）
- 包含 cookie 值和过期时间信息
- 支持所有 Booth 相关域名

### 2. Booth 网站功能增强
- 商品变体序号显示
  - 动态监控变体列表变化
  - 自动更新序号显示
  - 支持多商品卡片独立序号
- 标签批量操作功能
  - 复制标签
  - 粘贴标签
  - 清空标签
- 商品列表管理优化
  - 可见性优化加载
  - 性能优化处理
  - 动态内容监控
- 商品编辑界面优化
  - 智能按钮状态
  - 操作反馈优化
  - 批量处理能力

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
  - 可见性检测优化
  - 智能节流控制
  - 批量处理机制
  - 选择性翻译
  - 缓存优化
  - 防重复处理

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
- 性能优化措施：
  - 使用 IntersectionObserver 实现可见性检测
  - 智能节流控制避免频繁操作
  - 批量处理减少DOM操作
  - 选择性翻译避免重复处理

## 更新日志

### v0.1.2
- 添加可见性检测优化
- 优化翻译性能
- 改进变体序号显示
- 增强动态内容处理
- 优化内存使用

### v0.1.1
- 优化翻译性能
- 修复动态内容翻译问题
- 改进 UI 交互

### v0.1.0
- 初始版本发布
- 实现基础功能
