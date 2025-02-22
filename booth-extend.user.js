// ==UserScript==
// @name         Booth 网站功能增强
// @namespace    https://bbs.tampermonkey.net.cn/
// @version      0.1.2
// @description  增强 Booth 网站的功能体验
// @author       Yueby
// @match        https://*.booth.pm/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM_notification
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // 常量配置
    const CONFIG = {
        throttleDelay: 100,
        animationDelay: 1000
    };

    // 工具类
    class Utils {
        static throttleCache = new Map();

        // 优化的节流函数，使用Map缓存
        static throttle(func, limit) {
            const key = func.toString();
            if (!this.throttleCache.has(key)) {
                let inThrottle;
                const throttled = function (...args) {
                    if (!inThrottle) {
                        func.apply(this, args);
                        inThrottle = true;
                        setTimeout(() => inThrottle = false, limit);
                    }
                };
                this.throttleCache.set(key, throttled);
            }
            return this.throttleCache.get(key);
        }

        // 等待DOM加载完成
        static async waitForDOMReady() {
            if (document.readyState === 'loading') {
                await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
            }
        }

        // 检查当前页面是否需要特定功能
        static shouldEnableFeature(feature) {
            const path = window.location.pathname;
            switch (feature) {
                case 'variations':
                    // 商品编辑页面 https://manage.booth.pm/items/***/edit_pre
                    return /^\/items\/\d+\/edit(_pre)?$/.test(path);
                case 'tags':
                    // 商品编辑页面 https://manage.booth.pm/items/***/edit_pre
                    return /^\/items\/\d+\/edit(_pre)?$/.test(path);
                case 'dashboard':
                    // 商品管理页面 https://manage.booth.pm/items
                    return path === '/items' || path === '/items/';
                case 'session':
                    // 所有页面都可以获取session
                    return true;
                default:
                    return false;
            }
        }

        // 获取当前页面类型
        static getCurrentPageType() {
            const path = window.location.pathname;
            if (/^\/items\/\d+\/edit(_pre)?$/.test(path)) {
                return 'itemEdit';
            }
            if (path === '/items' || path === '/items/') {
                return 'dashboard';
            }
            return 'other';
        }

        // 优化的按钮状态更新
        static updateButtonState(button, success = true, originalHtml) {
            if (!button) return;

            const newHtml = success ?
                '<i class="icon-check"></i><span class="cmd-label">已完成</span>' :
                originalHtml;

            button.innerHTML = newHtml;
            button.classList.toggle('calm', !success);
            button.classList.toggle('primary', success);

            if (success) {
                setTimeout(() => {
                    button.innerHTML = originalHtml;
                    button.classList.add('calm');
                    button.classList.remove('primary');
                }, CONFIG.animationDelay);
            }
        }
    }

    // 基础页面命令类
    class PageCommand {
        constructor(context) {
            this.context = context;
            this.path = window.location.pathname;
        }

        shouldExecute() {
            return false;
        }

        execute() {
            console.log(`${this.constructor.name} 执行`);
        }

        cleanup() { }
    }

    // 商品编辑页面命令
    class ItemEditPageCommand extends PageCommand {
        shouldExecute() {
            return /^\/items\/\d+\/edit(_pre)?$/.test(this.path);
        }

        execute() {
            super.execute();
            this.addVariationNumbers();
            this.setupVariationObserver();
            this.addTagButtons();
        }

        // 变体序号功能
        addVariationNumbers() {
            const variations = document.querySelectorAll('.js-variation');
            variations.forEach((variation, index) => {
                let numberSpan = variation.querySelector('.variation-number');
                const titleArea = variation.querySelector('.u-flex-1.handle');

                if (!titleArea) return;

                if (!numberSpan) {
                    numberSpan = document.createElement('span');
                    numberSpan.className = 'variation-number u-align-middle';
                    numberSpan.style.cssText = 'margin-right: 8px; color: #666;';
                    titleArea.insertBefore(numberSpan, titleArea.firstChild);
                }

                numberSpan.textContent = `#${index + 1}`;
            });
        }

        setupVariationObserver() {
            const pageObserver = new MutationObserver(Utils.throttle(() => {
                const variations = document.querySelector('.js-variations');
                const hasObserver = this.context.observers.has('variation');

                if (variations && !hasObserver) {
                    // 变体列表出现且没有监听时，设置监听并添加序号
                    this.setupVariationsObserver(variations);
                    this.addVariationNumbers();
                } else if (!variations && hasObserver) {
                    // 变体列表消失且有监听时，清理监听和序号
                    const observer = this.context.observers.get('variation');
                    observer.disconnect();
                    this.context.observers.delete('variation');
                    document.querySelectorAll('.variation-number').forEach(span => span.remove());
                }
            }, CONFIG.throttleDelay));

            pageObserver.observe(document.body, {
                childList: true,
                subtree: true
            });

            this.context.observers.set('page', pageObserver);

            // 初始检查
            const variations = document.querySelector('.js-variations');
            if (variations) {
                this.setupVariationsObserver(variations);
                this.addVariationNumbers();
            }
        }

        setupVariationsObserver(variations) {
            const observer = new MutationObserver(Utils.throttle(() => {
                const needsUpdate = Array.from(variations.children).some((variation, index) => {
                    const numberSpan = variation.querySelector('.variation-number');
                    return !numberSpan || numberSpan.textContent !== `#${index + 1}`;
                });

                if (needsUpdate) {
                    requestAnimationFrame(() => this.addVariationNumbers());
                }
            }, CONFIG.throttleDelay));

            observer.observe(variations, {
                childList: true,
                subtree: false
            });

            this.context.observers.set('variation', observer);
        }

        // 标签功能
        addTagButtons() {
            const tagLabel = document.querySelector('#item_tag .u-tpg-label');
            if (!tagLabel) return;

            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'u-d-inline-block u-ml-300';
            buttonContainer.style.display = 'inline-flex';
            buttonContainer.style.gap = '8px';
            buttonContainer.style.verticalAlign = 'middle';

            // 复制按钮
            const copyBtn = document.createElement('a');
            copyBtn.type = 'button';
            copyBtn.className = 'btn calm small';
            copyBtn.innerHTML = '复制标签';
            copyBtn.onclick = () => this.copyTags();

            // 粘贴按钮
            const pasteBtn = document.createElement('a');
            pasteBtn.type = 'button';
            pasteBtn.className = 'btn calm small';
            pasteBtn.innerHTML = '粘贴标签';
            pasteBtn.onclick = () => this.pasteTags();

            // 清空按钮
            const clearBtn = document.createElement('a');
            clearBtn.type = 'button';
            clearBtn.className = 'btn calm small';
            clearBtn.innerHTML = '清空标签';
            clearBtn.onclick = () => this.clearTags();

            buttonContainer.appendChild(copyBtn);
            buttonContainer.appendChild(pasteBtn);
            buttonContainer.appendChild(clearBtn);

            tagLabel.parentNode.insertBefore(buttonContainer, tagLabel.nextSibling);
        }

        copyTags() {
            const tags = Array.from(document.querySelectorAll('.selectize-input .item'))
                .map(item => item.getAttribute('data-value'))
                .filter(Boolean);

            if (tags.length === 0) {
                alert('没有找到标签');
                return;
            }

            navigator.clipboard.writeText(JSON.stringify(tags)).then(() => {
                const copyBtn = document.querySelector('#item_tag .btn:first-child');
                if (copyBtn) {
                    const originalHtml = copyBtn.innerHTML;
                    copyBtn.innerHTML = '已复制';
                    copyBtn.classList.remove('calm');
                    copyBtn.classList.add('primary');
                    setTimeout(() => {
                        copyBtn.innerHTML = originalHtml;
                        copyBtn.classList.remove('primary');
                        copyBtn.classList.add('calm');
                    }, CONFIG.animationDelay);
                }
            });
        }

        async pasteTags() {
            try {
                const text = await navigator.clipboard.readText();
                const tags = JSON.parse(text);

                if (!Array.isArray(tags)) {
                    throw new Error('无效的标签数据');
                }

                const select = document.querySelector('.js-item-tags-array');
                if (!select || !select.selectize) {
                    throw new Error('找不到标签输入框');
                }

                select.selectize.clear();
                tags.forEach(tag => {
                    select.selectize.addOption({ value: tag, text: tag });
                    select.selectize.addItem(tag);
                });

                const pasteBtn = document.querySelector('#item_tag .btn:nth-child(2)');
                if (pasteBtn) {
                    const originalHtml = pasteBtn.innerHTML;
                    pasteBtn.innerHTML = '已粘贴';
                    pasteBtn.classList.remove('calm');
                    pasteBtn.classList.add('primary');
                    setTimeout(() => {
                        pasteBtn.innerHTML = originalHtml;
                        pasteBtn.classList.remove('primary');
                        pasteBtn.classList.add('calm');
                    }, CONFIG.animationDelay);
                }
            } catch (error) {
                alert('粘贴标签失败：' + error.message);
            }
        }

        clearTags() {
            if (!confirm('确定要清空所有标签吗？')) return;

            const select = document.querySelector('.js-item-tags-array');
            if (!select || !select.selectize) {
                alert('找不到标签输入框');
                return;
            }

            select.selectize.clear();

            const clearBtn = document.querySelector('#item_tag .btn:nth-child(3)');
            if (clearBtn) {
                const originalHtml = clearBtn.innerHTML;
                clearBtn.innerHTML = '已清空';
                clearBtn.classList.remove('calm');
                clearBtn.classList.add('primary');
                setTimeout(() => {
                    clearBtn.innerHTML = originalHtml;
                    clearBtn.classList.remove('primary');
                    clearBtn.classList.add('calm');
                }, CONFIG.animationDelay);
            }
        }

        cleanup() {
            ['variation', 'page'].forEach(observerName => {
                const observer = this.context.observers.get(observerName);
                if (observer) {
                    observer.disconnect();
                    this.context.observers.delete(observerName);
                }
            });

            const buttons = document.querySelectorAll('.btn.calm.small');
            buttons.forEach(button => {
                if (['复制标签', '粘贴标签', '清空标签'].includes(button.innerHTML)) {
                    button.remove();
                }
            });
        }
    }

    // 商品管理页面命令
    class ItemManagePageCommand extends PageCommand {
        constructor(context) {
            super(context);
            // 创建Intersection Observer
            this.itemObserver = new IntersectionObserver(
                (entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            const item = entry.target;
                            this.processItem(item);
                            // 处理完成后停止观察该元素
                            this.itemObserver.unobserve(item);
                        }
                    });
                },
                { threshold: 0.1 } // 当元素10%可见时触发
            );
        }

        shouldExecute() {
            return this.path === '/items' || this.path === '/items/';
        }

        execute() {
            super.execute();
            this.setupItemsObserver();
        }

        // 处理单个商品卡片
        processItem(item) {
            // 添加复制按钮
            this.addButtonToItem(item);
            // 添加变体序号
            this.addVariationNumbersToItem(item);
            // 标记该元素已处理
            item.dataset.processed = 'true';
        }

        // 为单个商品添加变体序号
        addVariationNumbersToItem(item) {
            const variationList = item.querySelector('.dashboard-items-variation');
            if (!variationList) return;

            const variations = variationList.querySelectorAll('.row');
            variations.forEach((variation, index) => {
                let numberSpan = variation.querySelector('.variation-number');
                const labelArea = variation.querySelector('.dashboard-items-variation-label');
                
                if (!labelArea) return;

                if (!numberSpan) {
                    numberSpan = document.createElement('span');
                    numberSpan.className = 'variation-number u-align-middle';
                    numberSpan.style.cssText = 'margin-right: 8px; color: #666;';
                    labelArea.insertBefore(numberSpan, labelArea.firstChild);
                }
                
                numberSpan.textContent = `#${index + 1}`;
            });

            // 监听变体列表的变化
            const observer = new MutationObserver(Utils.throttle(() => {
                const needsUpdate = Array.from(variations).some((variation, index) => {
                    const numberSpan = variation.querySelector('.variation-number');
                    return !numberSpan || numberSpan.textContent !== `#${index + 1}`;
                });

                if (needsUpdate) {
                    requestAnimationFrame(() => this.addVariationNumbersToItem(item));
                }
            }, CONFIG.throttleDelay));

            observer.observe(variationList, {
                childList: true,
                subtree: false
            });

            // 将observer存储到item元素中，以便后续清理
            item.variationObserver = observer;
        }

        setupItemsObserver() {
            // 监听页面变化，处理新增的商品元素
            const pageObserver = new MutationObserver(Utils.throttle((mutations) => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) { // 元素节点
                            // 检查新增的元素是否是商品容器或包含商品容器
                            const items = node.matches('.item-wrapper') ?
                                [node] :
                                Array.from(node.querySelectorAll('.item-wrapper'));

                            items.forEach(item => {
                                // 如果元素没有processed标记，则进行处理
                                if (!item.dataset.processed) {
                                    this.itemObserver.observe(item);
                                }
                            });
                        }
                    });
                });
            }, CONFIG.throttleDelay));

            pageObserver.observe(document.body, {
                childList: true,
                subtree: true
            });

            this.context.observers.set('page', pageObserver);

            // 处理已存在的商品元素
            document.querySelectorAll('.item-wrapper').forEach(item => {
                if (!item.dataset.processed) {
                    this.itemObserver.observe(item);
                }
            });
        }

        addButtonToItem(item) {
            const tagList = item.querySelector('.dashboard-items-tags');
            const footerActions = item.querySelector('.dashboard-item-footer-actions');
            if (!tagList || !footerActions || footerActions.querySelector('.tag-copy-btn')) return;

            const copyBtn = document.createElement('a');
            copyBtn.type = 'button';
            copyBtn.className = 'btn calm small tag-copy-btn mr-8';
            copyBtn.innerHTML = '复制标签';
            copyBtn.onclick = (e) => {
                e.preventDefault();
                this.copyItemManageTags(tagList);
            };

            footerActions.insertBefore(copyBtn, footerActions.firstChild);
        }

        copyItemManageTags(tagList) {
            const tags = Array.from(tagList.querySelectorAll('.tag-text'))
                .map(tag => tag.textContent)
                .filter(Boolean);

            if (tags.length === 0) {
                alert('没有找到标签');
                return;
            }

            navigator.clipboard.writeText(JSON.stringify(tags)).then(() => {
                const copyBtn = tagList.closest('.item-wrapper')?.querySelector('.tag-copy-btn');
                if (copyBtn) {
                    const originalHtml = copyBtn.innerHTML;
                    copyBtn.innerHTML = '已复制';
                    copyBtn.classList.remove('calm');
                    copyBtn.classList.add('primary');
                    setTimeout(() => {
                        copyBtn.innerHTML = originalHtml;
                        copyBtn.classList.remove('primary');
                        copyBtn.classList.add('calm');
                    }, CONFIG.animationDelay);
                }
            });
        }

        cleanup() {
            // 清理所有观察器
            const observer = this.context.observers.get('page');
            if (observer) {
                observer.disconnect();
                this.context.observers.delete('page');
            }

            if (this.itemObserver) {
                this.itemObserver.disconnect();
            }

            // 清理每个商品卡片的变体观察器
            document.querySelectorAll('.item-wrapper').forEach(item => {
                if (item.variationObserver) {
                    item.variationObserver.disconnect();
                    delete item.variationObserver;
                }
            });

            // 移除所有已添加的按钮和序号
            document.querySelectorAll('.tag-copy-btn, .variation-number').forEach(el => el.remove());
        }
    }

    // 全局功能命令
    class GlobalCommand extends PageCommand {
        shouldExecute() {
            return true;
        }

        execute() {
            super.execute();
            GM_registerMenuCommand("获取Booth Session", () => this.getSession());
        }

        extractCookieInfo(headers) {
            const cookieHeader = headers.split('\n')
                .find(line => line.toLowerCase().startsWith('set-cookie:') &&
                    line.includes('_plaza_session_nktz7u='));

            if (!cookieHeader) return null;

            const value = cookieHeader.split(';')[0].split('=').slice(1).join('=').trim();
            const expires = cookieHeader.match(/expires=([^;]+)/i)?.[1]?.trim();

            return {
                value,
                expires: expires ? new Date(expires).toISOString() : null
            };
        }

        getSession() {
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'https://manage.booth.pm/orders',
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
                },
                onload: (response) => {
                    const cookieInfo = this.extractCookieInfo(response.responseHeaders);

                    if (cookieInfo) {
                        const cookieData = {
                            _plaza_session_nktz7u: cookieInfo.value,
                            updated_at: new Date().toISOString(),
                            expires_at: cookieInfo.expires
                        };

                        GM_setClipboard(JSON.stringify(cookieData, null, 2));

                        GM_notification({
                            text: cookieInfo.expires
                                ? `Session已复制\n过期时间: ${new Date(cookieInfo.expires).toLocaleString()}`
                                : 'Session已复制到剪贴板',
                            title: '获取成功',
                            timeout: 3000
                        });
                    } else {
                        GM_notification({
                            text: '未找到有效的 Session',
                            title: '获取失败',
                            timeout: 3000
                        });
                    }
                },
                onerror: () => {
                    GM_notification({
                        text: '请求出错，请检查网络连接',
                        title: '错误',
                        timeout: 3000
                    });
                }
            });
        }
    }

    // 功能增强类
    class BoothEnhancer {
        constructor() {
            this.initialized = false;
            this.observers = new Map();
            this.cachedElements = new Map();
            this.commands = [
                new ItemEditPageCommand(this),
                new ItemManagePageCommand(this),
                new GlobalCommand(this)
            ];
        }

        async init() {
            try {
                await Utils.waitForDOMReady();

                this.commands.forEach(command => {
                    if (command.shouldExecute()) {
                        command.execute();
                    }
                });

                this.initialized = true;
                console.log('Booth功能增强已启动');
            } catch (error) {
                console.error('Booth功能增强启动失败:', error);
            }
        }

        destroy() {
            this.commands.forEach(command => command.cleanup());
            this.observers.clear();
            this.cachedElements.clear();
            this.initialized = false;
        }
    }

    // 启动增强功能
    new BoothEnhancer().init();
})();
