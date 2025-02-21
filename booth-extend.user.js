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

    // 常量配置
    const SETTINGS = {
        checkInterval: 600,
        throttleDelay: 100
    };

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

        // 等待指定时间
        static sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
    }

    // 功能增强类
    class BoothEnhancer {
        constructor() {
            this.initialized = false;
            this.selectedVariations = new Set();
        }

        async init() {
            try {
                await Utils.waitForDOMReady();
                this.setupEventListeners();
                this.addVariationNumbers();
                this.initialized = true;
                console.log('Booth功能增强已启动');
            } catch (error) {
                console.error('Booth功能增强启动失败:', error);
                this.handleError(error);
            }
        }

        setupEventListeners() {
            // 添加事件监听器
            document.addEventListener('click', Utils.throttle((e) => {
                this.handleClick(e);
            }, SETTINGS.throttleDelay));

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
            }, SETTINGS.throttleDelay));

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            // 监听拖动结束事件
            document.addEventListener('dragend', Utils.throttle(() => {
                setTimeout(() => this.addVariationNumbers(), 100);
            }, SETTINGS.throttleDelay));

            // 添加批量操作按钮
            this.addBatchOperationButtons();
        }

        addBatchOperationButtons() {
            const container = document.querySelector('.js-variations');
            if (!container || container.querySelector('.batch-operations')) return;

            // 创建批量操作区域
            const batchArea = document.createElement('div');
            batchArea.className = 'batch-operations u-mb-500';
            batchArea.style.padding = '10px';
            batchArea.style.backgroundColor = '#f5f5f5';
            batchArea.style.borderRadius = '4px';

            // 添加全选按钮
            const selectAllBtn = document.createElement('button');
            selectAllBtn.type = 'button';
            selectAllBtn.className = 'btn btn-default u-mr-300';
            selectAllBtn.textContent = '全选';
            selectAllBtn.onclick = () => this.selectAllVariations();

            // 添加批量删除按钮
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'btn btn-danger u-mr-300';
            deleteBtn.textContent = '批量删除';
            deleteBtn.onclick = () => this.batchDeleteVariations();

            // 添加批量复制按钮
            const copyBtn = document.createElement('button');
            copyBtn.type = 'button';
            copyBtn.className = 'btn btn-primary';
            copyBtn.textContent = '批量复制';
            copyBtn.onclick = () => this.batchCopyVariations();

            batchArea.appendChild(selectAllBtn);
            batchArea.appendChild(deleteBtn);
            batchArea.appendChild(copyBtn);

            container.insertBefore(batchArea, container.firstChild);
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

                // 添加选择框
                if (!variation.querySelector('.variation-checkbox')) {
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.className = 'variation-checkbox';
                    checkbox.style.marginRight = '8px';
                    checkbox.onclick = (e) => {
                        if (e.target.checked) {
                            this.selectedVariations.add(variation);
                        } else {
                            this.selectedVariations.delete(variation);
                        }
                    };
                    titleArea.insertBefore(checkbox, titleArea.firstChild);
                }
            });
        }

        handleClick(event) {
            // 处理点击事件
        }

        handleError(error) {
            console.error('Booth功能增强错误:', error);
        }

        // 全选功能
        selectAllVariations() {
            const checkboxes = document.querySelectorAll('.variation-checkbox');
            const isAllSelected = Array.from(checkboxes).every(cb => cb.checked);
            
            checkboxes.forEach(checkbox => {
                checkbox.checked = !isAllSelected;
                const variation = checkbox.closest('.js-variation');
                if (!isAllSelected) {
                    this.selectedVariations.add(variation);
                } else {
                    this.selectedVariations.delete(variation);
                }
            });
        }

        // 批量删除功能
        batchDeleteVariations() {
            if (this.selectedVariations.size === 0) {
                alert('请先选择要删除的项目');
                return;
            }

            if (confirm(`确定要删除选中的 ${this.selectedVariations.size} 个项目吗？`)) {
                this.selectedVariations.forEach(variation => {
                    const deleteBtn = variation.querySelector('.variation-box-destroy');
                    if (deleteBtn) deleteBtn.click();
                });
                this.selectedVariations.clear();
            }
        }

        // 批量复制功能
        batchCopyVariations() {
            if (this.selectedVariations.size === 0) {
                alert('请先选择要复制的项目');
                return;
            }

            const copyInfo = Array.from(this.selectedVariations).map(variation => {
                const nameInput = variation.querySelector('input[data-vv-name="variation.name"]');
                const priceInput = variation.querySelector('input[data-vv-name="variation.price"]');
                const files = Array.from(variation.querySelectorAll('.assigned-files a')).map(a => a.href);
                
                return {
                    name: nameInput?.value || '',
                    price: priceInput?.value || '',
                    files: files
                };
            });

            // 将信息复制到剪贴板
            const copyText = JSON.stringify(copyInfo, null, 2);
            navigator.clipboard.writeText(copyText).then(() => {
                alert('已复制到剪贴板！');
            });
        }
    }

    // 启动增强功能
    new BoothEnhancer().init();
})();
