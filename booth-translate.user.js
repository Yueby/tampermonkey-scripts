// ==UserScript==
// @name         Booth 网站翻译助手
// @namespace    https://bbs.tampermonkey.net.cn/
// @version      0.1.2
// @description  自动翻译 Booth 网站的多语言内容为中文
// @author       Yueby
// @match        https://*.booth.pm/*
// @connect      raw.githubusercontent.com
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // 常量配置
    const SETTINGS = {
        checkInterval: 600,
        throttleDelay: 100,
        maxLanguageSelectorAttempts: 10,
        languageSelectorInterval: 500,
        batchSize: 10
    };

    // 配置类 - 集中管理所有配置
    class Config {
        // 基本翻译规则
        translations = {};

        // 特殊翻译规则 - 为特定选择器添加额外文本
        specialRules = [];

        // 选择器配置
        selectors = {
            // 静态内容选择器
            static: [],
            // 动态内容选择器
            dynamic: [],
            // 排除的选择器
            exclude: [],
            // 需要翻译的属性
            attributes: {
                translate: [],
                observe: []
            }
        };

        // 从配置文件加载配置
        async loadConfig() {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: 'https://raw.githubusercontent.com/Yueby/tampermonkey-scripts/refs/heads/booth-scripts/booth-translate-config.json',
                    onload: (response) => {
                        try {
                            const config = JSON.parse(response.responseText);
                            this.translations = config.translations || {};
                            this.specialRules = config.specialRules || [];
                            this.selectors = {
                                static: config.selectors?.static || [],
                                dynamic: config.selectors?.dynamic || [],
                                exclude: config.selectors?.exclude || [],
                                attributes: {
                                    translate: config.selectors?.attributes?.translate || [],
                                    observe: config.selectors?.attributes?.observe || []
                                }
                            };
                            resolve();
                        } catch (error) {
                            console.error('解析配置文件失败:', error);
                            reject(error);
                        }
                    },
                    onerror: (error) => {
                        console.error('加载配置文件失败:', error);
                        reject(error);
                    }
                });
            });
        }

        // 获取所有选择器
        getAllSelectors() {
            return [
                ...this.selectors.static,
                ...this.selectors.dynamic
            ];
        }

        // 获取需要观察的属性
        getObserveAttributes() {
            return [
                ...this.selectors.attributes.translate,
                ...this.selectors.attributes.observe
            ];
        }
    }

    // 创建全局配置实例
    const config = new Config();

    // 翻译器类 - 处理文本翻译
    class Translator {
        constructor(config) {
            this.config = config;
        }

        // 检查元素是否需要翻译
        shouldTranslate(element) {
            // 如果元素已经被翻译，不需要重复翻译
            if (element.dataset?.translated === 'true') {
                return false;
            }

            // 检查是否在排除列表中
            const isExcluded = (el) => {
                if (!el || !el.matches) return false;
                return this.config.selectors.exclude.some(selector => {
                    return el.matches(selector) || el.closest(selector);
                });
            };

            // 跳过空文本节点
            if (element.nodeType === Node.TEXT_NODE) {
                const parent = element.parentElement;
                if (!parent || isExcluded(parent)) {
                    return false;
                }
                return element.textContent.trim() !== '';
            }

            // 以下检查仅适用于元素节点
            if (element.nodeType === Node.ELEMENT_NODE) {
                // 跳过脚本和样式标签
                if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE') {
                    return false;
                }
                // 如果元素在排除列表中，但有title或placeholder属性，仍然允许翻译
                if (isExcluded(element)) {
                    return element.hasAttribute('title') || element.hasAttribute('placeholder');
                }
                // 即使已翻译，也允许继续模糊匹配
                if (element.hasAttribute('data-translated')) {
                    return element.textContent.trim() !== '';
                }
            }

            return true;
        }

        // 处理特殊规则
        applySpecialRule(text, rule) {
            let result = text;
            if (rule) {
                if (rule.prepend) {
                    result = rule.prepend + result;
                }
                if (rule.append) {
                    result = result + rule.append;
                }
            }
            return result;
        }

        translate(text, element) {
            if (!text || typeof text !== 'string') return text;
            let result = text;

            // 获取特殊规则
            let currentRule = null;
            if (element) {
                currentRule = this.config.specialRules.find(rule => element.matches(rule.selector));
            }

            // 按源文本长度降序排序翻译规则,确保优先匹配较长的文本
            const sortedTranslations = Object.entries(this.config.translations)
                .sort((a, b) => b[0].length - a[0].length);

            // 遍历所有翻译规则进行替换
            for (const [source, target] of sortedTranslations) {
                if (result.includes(source)) {
                    // 转义正则表达式特殊字符
                    const escapedSource = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    // 创建全局替换的正则表达式
                    const regex = new RegExp(escapedSource, 'g');
                    // 替换并应用特殊规则
                    let replacement = target;
                    if (currentRule) {
                        if (currentRule.prepend) {
                            replacement = currentRule.prepend + replacement;
                        }
                        if (currentRule.append) {
                            replacement = replacement + currentRule.append;
                        }
                    }
                    result = result.replace(regex, replacement);
                }
            }

            return result;
        }

        translateNode(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                return this.translateTextNode(node);
            }
            if (node.nodeType === Node.ELEMENT_NODE) {
                return this.translateElement(node);
            }
        }

        translateTextNode(node) {
            const text = node.textContent.trim();
            if (!text) return;

            // 传入节点的父元素以检查特殊规则
            const translated = this.translate(text, node.parentElement);
            if (translated !== text) {
                node.textContent = node.textContent.replace(text, translated);
            }
        }

        translateElement(element) {
            let hasTranslation = false;

            // 翻译属性
            this.config.selectors.attributes.translate.forEach(attr => {
                if (element.hasAttribute(attr)) {
                    const value = element.getAttribute(attr);
                    if (value) {  // 确保属性值存在
                        const translated = this.translate(value, element);
                        if (translated !== value) {
                            element.setAttribute(attr, translated);
                            // 为每个翻译过的属性添加标记
                            element.setAttribute(`data-translated-${attr}`, 'true');
                            hasTranslation = true;
                        }
                    }
                }
            });

            // 检查是否在排除列表中
            const isExcluded = this.config.selectors.exclude.some(selector => {
                return element.matches(selector) || element.closest(selector);
            });

            // 如果不在排除列表中，或者有特殊属性需要翻译
            if (!isExcluded || element.hasAttribute('title') || element.hasAttribute('placeholder')) {
                // 翻译子节点
                element.childNodes.forEach(node => {
                    if (this.shouldTranslate(node)) {
                        const text = node.textContent?.trim();
                        if (text) {
                            const translated = this.translate(text, element);
                            if (translated !== text) {
                                if (node.nodeType === Node.TEXT_NODE) {
                                    node.textContent = node.textContent.replace(text, translated);
                                } else {
                                    this.translateNode(node);
                                }
                                hasTranslation = true;  // 标记已进行翻译
                            }
                        }
                    }
                });
            }

            // 只有在实际进行了翻译时才标记元素
            if (hasTranslation) {
                element.dataset.translated = 'true';
            }
        }
    }

    // 创建全局翻译器实例
    const translator = new Translator(config);

    // 工具类 - 提供通用功能
    class Utils {
        // 节流函数 - 限制函数调用频率
        static throttle(func, limit) {
            let inThrottle;
            return function (...args) {
                if (!inThrottle) {
                    func.apply(this, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        }

        // 等待DOM加载完成
        static async waitForDOMReady() {
            if (document.readyState === 'loading') {
                await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
            }
        }

        // 等待指定时间
        static sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
    }

    // 观察器类 - 处理DOM变化
    class Observer {
        constructor(config, translator) {
            this.config = config;
            this.translator = translator;
            this.throttledHandle = Utils.throttle(this.handleMutations.bind(this), SETTINGS.throttleDelay);
            this.observer = new MutationObserver(this.throttledHandle);
            this.processing = false;
            this.checkInterval = null;
            
            // 创建 IntersectionObserver 用于监控元素可见性
            this.visibilityObserver = new IntersectionObserver(
                (entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting && !entry.target.dataset.translated) {
                            // 元素可见且未翻译时进行翻译
                            this.translator.translateNode(entry.target);
                            // 标记已翻译
                            entry.target.dataset.translated = 'true';
                            // 停止观察已翻译的元素
                            this.visibilityObserver.unobserve(entry.target);
                        }
                    });
                },
                { 
                    threshold: 0.1,  // 元素10%可见时触发
                    rootMargin: '100px'  // 提前100px开始加载，提供更平滑的体验
                }
            );
        }

        start() {
            // 监听整个文档的变化
            this.observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: this.config.getObserveAttributes(),
                characterData: true,
                attributeOldValue: true
            });

            // 初始处理可见元素
            this.observeVisibleElements();
        }

        // 观察可见元素
        observeVisibleElements() {
            const allSelectors = this.config.getAllSelectors();
            allSelectors.forEach(selector => {
                try {
                    document.querySelectorAll(selector).forEach(element => {
                        if (!element.dataset.translated && this.translator.shouldTranslate(element)) {
                            this.visibilityObserver.observe(element);
                        }
                    });
                } catch (error) {
                    console.error(`选择器 ${selector} 查询失败:`, error);
                }
            });
        }

        handleMutations(mutations) {
            if (this.processing) return;
            this.processing = true;

            try {
                mutations.forEach(mutation => {
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach(node => {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                // 对新添加的元素应用可见性观察
                                if (this.translator.shouldTranslate(node)) {
                                    this.visibilityObserver.observe(node);
                                }
                                // 处理子元素
                                const allSelectors = this.config.getAllSelectors();
                                allSelectors.forEach(selector => {
                                    try {
                                        node.querySelectorAll(selector).forEach(element => {
                                            if (!element.dataset.translated && this.translator.shouldTranslate(element)) {
                                                this.visibilityObserver.observe(element);
                                            }
                                        });
                                    } catch (error) {
                                        console.error(`选择器 ${selector} 查询失败:`, error);
                                    }
                                });
                            }
                        });
                    }
                    else if (mutation.type === 'attributes') {
                        const target = mutation.target;
                        if (!target.dataset.translated && this.translator.shouldTranslate(target)) {
                            this.visibilityObserver.observe(target);
                        }
                    }
                });
            } catch (error) {
                console.error('处理DOM变化时出错:', error);
            } finally {
                this.processing = false;
            }
        }

        disconnect() {
            this.observer.disconnect();
            this.visibilityObserver.disconnect();
            if (this.checkInterval) {
                clearInterval(this.checkInterval);
                this.checkInterval = null;
            }
        }
    }

    // 语言检测器类 - 处理语言检测相关功能
    class LanguageDetector {
        static async detectLanguage() {
            for (let i = 0; i < SETTINGS.maxLanguageSelectorAttempts; i++) {
                const languageSwitcher = document.querySelector('.js-locale-switcher');
                const currentLanguage = languageSwitcher?.querySelector('.bg-ui-background200');

                if (currentLanguage) {
                    const text = currentLanguage.textContent.trim();
                    console.log('检测到的语言:', text);
                    return text.includes('简体中文');
                }

                console.log(`等待语言选择器加载... (${i + 1}/${SETTINGS.maxLanguageSelectorAttempts})`);
                await Utils.sleep(SETTINGS.languageSelectorInterval);
            }

            console.log('语言选择器加载超时');
            return false;
        }
    }

    // 主应用类 - 协调整体功能
    class TranslatorApp {
        constructor() {
            this.config = new Config();
            this.translator = new Translator(this.config);
            this.observer = new Observer(this.config, this.translator);
            this.initialized = false;
        }

        async start() {
            try {
                await Utils.waitForDOMReady();

                const isChineseUI = await LanguageDetector.detectLanguage();
                if (!isChineseUI) {
                    console.log('当前不是简体中文界面，翻译助手未启动');
                    return;
                }

                await this.config.loadConfig();

                // 启动观察器
                this.observer.start();

                this.initialized = true;
                console.log('Booth翻译助手已启动');
            } catch (error) {
                console.error('Booth翻译助手启动失败:', error);
                this.handleError(error);
            }
        }

        stop() {
            if (this.observer) {
                this.observer.disconnect();
            }
            this.initialized = false;
            console.log('Booth翻译助手已停止');
        }

        restart() {
            this.stop();
            this.start();
        }

        handleError(error) {
            // 记录错误
            console.error('Booth翻译助手错误:', error);

            // 如果是致命错误，尝试重启
            if (error instanceof TypeError || error instanceof ReferenceError) {
                console.log('检测到致命错误，尝试重启...');
                setTimeout(() => this.restart(), 1000);
            }
        }
    }

    // 启动应用
    new TranslatorApp().start();
})(); 