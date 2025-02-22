// ==UserScript==
// @name         Booth 网站功能增强
// @namespace    https://bbs.tampermonkey.net.cn/
// @version      0.1.0
// @description  增强 Booth 网站的功能体验
// @author       Yueby
// @match        https://*.booth.pm/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // 工具类
    class Utils {
        // 节流函数
        static throttle(func, limit) {
            let inThrottle;
            return function(...args) {
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
    }

    // 功能增强类
    class BoothEnhancer {
        constructor() {
            this.initialized = false;
        }

        async init() {
            try {
                await Utils.waitForDOMReady();
                this.setupEventListeners();
                this.addVariationNumbers();
                this.addTagButtons();
                this.addDashboardTagButtons();
                this.initialized = true;
                console.log('Booth功能增强已启动');
            } catch (error) {
                console.error('Booth功能增强启动失败:', error);
            }
        }

        setupEventListeners() {
            // 监听DOM变化
            const observer = new MutationObserver(Utils.throttle((mutations) => {
                // 检查是否有拖动相关的变化
                const hasDragChanges = mutations.some(mutation => {
                    return Array.from(mutation.addedNodes).some(node => 
                        node.nodeType === 1 && node.classList?.contains('js-variation')
                    ) || Array.from(mutation.removedNodes).some(node => 
                        node.nodeType === 1 && node.classList?.contains('js-variation')
                    );
                });

                // 如果是拖动导致的变化，延迟一下再更新序号
                if (hasDragChanges) {
                    setTimeout(() => this.addVariationNumbers(), 100);
                } else {
                    this.addVariationNumbers();
                }
            }, 100));

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            // 监听拖动结束事件
            document.addEventListener('dragend', Utils.throttle(() => {
                setTimeout(() => this.addVariationNumbers(), 100);
            }, 100));
        }

        addVariationNumbers() {
            // 获取所有变体卡片
            const variations = document.querySelectorAll('.js-variation');
            
            variations.forEach((variation, index) => {
                // 查找现有的序号元素
                let numberSpan = variation.querySelector('.variation-number');
                const titleArea = variation.querySelector('.u-flex-1.handle');
                
                if (!titleArea) return;

                // 如果序号元素存在，更新它
                if (numberSpan) {
                    numberSpan.textContent = `#${index + 1}`;
                } else {
                    // 创建新的序号元素
                    numberSpan = document.createElement('span');
                    numberSpan.className = 'variation-number u-align-middle';
                    numberSpan.style.marginRight = '8px';
                    numberSpan.style.color = '#666';
                    numberSpan.textContent = `#${index + 1}`;
                    titleArea.insertBefore(numberSpan, titleArea.firstChild);
                }
            });
        }

        // 添加标签操作按钮
        addTagButtons() {
            // 找到标签区域的标题
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
            copyBtn.innerHTML = '<i class="icon-copy"></i><span class="cmd-label">复制标签</span>';
            copyBtn.onclick = () => this.copyTags();

            // 粘贴按钮
            const pasteBtn = document.createElement('a');
            pasteBtn.type = 'button';
            pasteBtn.className = 'btn calm small';
            pasteBtn.innerHTML = '<i class="icon-paste"></i><span class="cmd-label">粘贴标签</span>';
            pasteBtn.onclick = () => this.pasteTags();

            // 清空按钮
            const clearBtn = document.createElement('a');
            clearBtn.type = 'button';
            clearBtn.className = 'btn calm small';
            clearBtn.innerHTML = '<i class="icon-cancel"></i><span class="cmd-label">清空标签</span>';
            clearBtn.onclick = () => this.clearTags();

            buttonContainer.appendChild(copyBtn);
            buttonContainer.appendChild(pasteBtn);
            buttonContainer.appendChild(clearBtn);
            
            // 将按钮添加到标签标题后面
            tagLabel.parentNode.insertBefore(buttonContainer, tagLabel.nextSibling);
        }

        // 复制标签
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
                    copyBtn.innerHTML = '<i class="icon-check"></i><span class="cmd-label">已复制</span>';
                    copyBtn.classList.remove('calm');
                    copyBtn.classList.add('primary');
                    
                    setTimeout(() => {
                        copyBtn.innerHTML = originalHtml;
                        copyBtn.classList.remove('primary');
                        copyBtn.classList.add('calm');
                    }, 1000);
                }
            });
        }

        // 粘贴标签
        async pasteTags() {
            try {
                const text = await navigator.clipboard.readText();
                const tags = JSON.parse(text);

                if (!Array.isArray(tags)) {
                    throw new Error('无效的标签数据');
                }

                // 获取 selectize 实例
                const select = document.querySelector('.js-item-tags-array');
                if (!select || !select.selectize) {
                    throw new Error('找不到标签输入框');
                }

                // 清除现有标签
                select.selectize.clear();

                // 添加新标签
                tags.forEach(tag => {
                    select.selectize.addOption({ value: tag, text: tag });
                    select.selectize.addItem(tag);
                });

                // 显示成功提示
                const pasteBtn = document.querySelector('#item_tag .btn:nth-child(2)');
                if (pasteBtn) {
                    const originalHtml = pasteBtn.innerHTML;
                    pasteBtn.innerHTML = '<i class="icon-check"></i><span class="cmd-label">已粘贴</span>';
                    pasteBtn.classList.remove('calm');
                    pasteBtn.classList.add('primary');
                    
                    setTimeout(() => {
                        pasteBtn.innerHTML = originalHtml;
                        pasteBtn.classList.remove('primary');
                        pasteBtn.classList.add('calm');
                    }, 1000);
                }
            } catch (error) {
                alert('粘贴标签失败：' + error.message);
            }
        }

        // 清空标签
        clearTags() {
            if (!confirm('确定要清空所有标签吗？')) return;

            const select = document.querySelector('.js-item-tags-array');
            if (!select || !select.selectize) {
                alert('找不到标签输入框');
                return;
            }

            // 清除现有标签
            select.selectize.clear();

            // 显示成功提示
            const clearBtn = document.querySelector('#item_tag .btn:nth-child(3)');
            if (clearBtn) {
                const originalHtml = clearBtn.innerHTML;
                clearBtn.innerHTML = '<i class="icon-check"></i><span class="cmd-label">已清空</span>';
                clearBtn.classList.remove('calm');
                clearBtn.classList.add('primary');
                
                setTimeout(() => {
                    clearBtn.innerHTML = originalHtml;
                    clearBtn.classList.remove('primary');
                    clearBtn.classList.add('calm');
                }, 1000);
            }
        }

        // 添加商品页面标签操作按钮
        addDashboardTagButtons() {
            // 找到所有商品列表项
            const items = document.querySelectorAll('.item-wrapper');
            items.forEach(item => {
                const tagList = item.querySelector('.dashboard-items-tags');
                const footerActions = item.querySelector('.dashboard-item-footer-actions');
                
                if (!tagList || !footerActions || footerActions.querySelector('.tag-copy-btn')) return;

                // 复制按钮
                const copyBtn = document.createElement('a');
                copyBtn.type = 'button';
                copyBtn.className = 'btn calm small tag-copy-btn mr-8';
                copyBtn.innerHTML = '<i class="icon-copy"></i><span class="cmd-label">复制标签</span>';
                copyBtn.onclick = (e) => {
                    e.preventDefault();
                    this.copyDashboardTags(tagList);
                };

                // 将按钮添加到最前面
                footerActions.insertBefore(copyBtn, footerActions.firstChild);
            });

            // 监听可能的动态加载
            const observer = new MutationObserver(Utils.throttle(() => {
                this.addDashboardTagButtons();
            }, 100));

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        // 复制商品页面标签
        copyDashboardTags(tagList) {
            const tags = Array.from(tagList.querySelectorAll('.tag-text'))
                .map(tag => tag.textContent)
                .filter(Boolean);

            if (tags.length === 0) {
                alert('没有找到标签');
                return;
            }

            navigator.clipboard.writeText(JSON.stringify(tags)).then(() => {
                // 找到正确的复制按钮
                const copyBtn = tagList.closest('.item-wrapper')?.querySelector('.tag-copy-btn');
                if (copyBtn) {
                    const originalHtml = copyBtn.innerHTML;
                    copyBtn.innerHTML = '<i class="icon-check"></i><span class="cmd-label">已复制</span>';
                    copyBtn.classList.remove('calm');
                    copyBtn.classList.add('primary');
                    
                    setTimeout(() => {
                        copyBtn.innerHTML = originalHtml;
                        copyBtn.classList.remove('primary');
                        copyBtn.classList.add('calm');
                    }, 1000);
                }
            });
        }
    }

    // 启动增强功能
    new BoothEnhancer().init();
})();
