// ==UserScript==
// @name         厕所空位查询增强
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  增强厕所空位查询功能
// @author       Yueby
// @match        https://eip.skyunion.net/*
// @grant        GM_notification
// ==/UserScript==

(function () {
    'use strict';

    // 调试配置（放在最前面）
    const DEBUG = {
        ENABLED: false  // 调试模式开关
    };

    // 简化配置
    const CONFIG = {
        SELECTORS: {
            TOILET_TAB: 'label:contains("厕所空位查询")',
            TOILET_IFRAME: 'iframe[src*="/other/wc/wcflag"]',
            TAB_LIST: '#win_lab_list',
            TOILET_MAPS: '.toilet_map',
            TOILET_ROOMS: '.toilet_rooms li',
            ROOM_STATUS: '.tips'
        },
        OBSERVER: {
            DOM: { childList: true, subtree: true },
            TEXT: { characterData: true, childList: true, subtree: true }
        }
    };

    // 修改通知配置
    const NOTIFICATION = {
        TITLE: {
            VACANT: '有空位啦！',
            OCCUPIED: '被占用了'
        },
        HIGHLIGHT: true,
        SILENT: {
            VACANT: false,    // 空位时有声音提醒
            OCCUPIED: true    // 占用时静音
        },
        IMAGE: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAACXBIWXMAAAsTAAALEwEAmpwYAAABk0lEQVR4nO2XzUoDMRDHc/Eqnj37DN4K4sniQ7TQ6MEH8OS+QPsCevIh+oEmiwWLt548eFAnRetVROwHTJDIWopK0W7TZJvK/ODPkj1k55+ZZDOMEQTxAwl6VwA+SaXNbxIKu3FH55kDClH5qhhVTBoVonJr6oRJcH8F/yV8dGGgmDL4saZOmC74kcgAowxMQiU0I0XaxAsuoUJUbqX+DxxVLoMzkOD0e2TAAkkZ+AaVkAVS6bZUuC8ezHryHI0n36WdLPNTyClkYNHIZS8hXh+YLFSqDbp79V5+aQ18qtZ30paSAW65+qVab8d5BiRgb5aNbCvngY+RgJ2lNiAUVv0bwFdvBiTggXcDoG+8GWjcmlUB+OLTgAB9zHwSKzz0aeD8Xm97NdBumxWp9LWf1ccLlgUx4KYEfHdb+/h8djfcYFkhQZ+6DD4GzLEsiQFzrsom05Uf0+yYNauAFb4lR6UAfeJ9w07D6qpcHW6xUOBWV+V+k4UCt21YQskCt25YAskCn6dtDCELfK62MZAsEMQ/5gPhdLoNMMkO2wAAAABJRU5ErkJggg=='
    };

    // 简化事件
    const EVENTS = {
        TAB_OPENED: 'toiletTabOpened',
        TAB_CLOSED: 'toiletTabClosed',
        STATUS_CHANGED: 'toiletStatusChanged'
    };

    // 添加状态相关配置
    const STATUS = {
        OCCUPIED: '使用中',
        VACANT: '空 闲'
    };

    // 添加 UI 相关配置
    const UI = {
        STYLES: `
            .toilet-panel-trigger {
                position: fixed;
                right: -30px;  /* 初始状态半隐藏 */
                top: 50%;
                transform: translateY(-50%);
                background: white;
                color: #666;
                padding: 10px 15px 10px 20px;  /* 左侧padding更大 */
                border-radius: 20px 0 0 20px;  /* 左侧圆角 */
                cursor: pointer;
                z-index: 9999;
                box-shadow: -2px 2px 8px rgba(0,0,0,0.1);
                transition: all 0.3s ease;
                font-size: 20px;
                display: flex;
                align-items: center;
                border: 1px solid #eee;
                border-right: none;
            }

            .toilet-panel-trigger:hover {
                right: -5px;  /* 悬停时展开 */
                color: #4CAF50;
            }

            .toilet-panel-trigger.has-occupied {
                color: #f44336;
                animation: pulse 2s infinite;
            }

            .toilet-panel-trigger.has-occupied:hover {
                animation: none;  /* 悬停时停止动画 */
            }

            @keyframes pulse {
                0% { transform: translateY(-50%) scale(1); }
                50% { transform: translateY(-50%) scale(1.1); }
                100% { transform: translateY(-50%) scale(1); }
            }

            .toilet-panel {
                position: fixed;
                right: 20px;
                top: 50%;
                transform: translateY(-50%);
                background: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                z-index: 9999;
                min-width: 600px;  /* 最小宽度 */
                width: fit-content;  /* 根据内容自适应宽度 */
                max-width: calc(100vw - 40px);  /* 最大宽度为视窗宽度减去左右边距 */
                max-height: 90vh;
                display: none;
                overflow: hidden;
            }

            .toilet-panel.active {
                display: flex;
                flex-direction: column;
            }

            .toilet-panel-header {
                display: flex;
                justify-content: space-between;
                margin-bottom: 15px;
            }

            .toilet-panel-filters {
                display: flex;
                gap: 20px;
                margin-bottom: 15px;
                align-items: center;
                justify-content: space-between;  /* 改为两端对齐 */
            }

            .filter-group {
                display: flex;
                gap: 20px;
                align-items: center;
            }

            .monitor-group {
                display: flex;
                gap: 20px;
                align-items: center;
                margin-left: auto;  /* 推到右侧 */
            }

            .toilet-filter select {
                padding: 5px;
                border: 1px solid #ddd;
                border-radius: 4px;
            }

            .monitor-all-btn {
                padding: 6px 12px;
                background: #4CAF50;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.3s;
            }

            .monitor-all-btn:hover {
                background: #388E3C;
            }

            .monitor-all-btn.stop {
                background: #f44336;
            }

            .monitor-all-btn.stop:hover {
                background: #d32f2f;
            }

            .toilet-panel-content {
                display: grid;
                grid-template-columns: repeat(2, minmax(280px, 1fr));  /* 两列，每列最小280px */
                gap: 20px;
                overflow-y: auto;
                padding-right: 10px;
                flex: 1;
                min-height: 200px;
                max-height: calc(90vh - 150px);
            }

            /* 美化滚动条 */
            .toilet-panel-content::-webkit-scrollbar {
                width: 8px;
            }

            .toilet-panel-content::-webkit-scrollbar-track {
                background: #f1f1f1;
                border-radius: 4px;
            }

            .toilet-panel-content::-webkit-scrollbar-thumb {
                background: #888;
                border-radius: 4px;
            }

            .toilet-panel-content::-webkit-scrollbar-thumb:hover {
                background: #555;
            }

            /* 调整头部和筛选器样式 */
            .toilet-panel-header,
            .toilet-panel-filters {
                flex-shrink: 0;  /* 防止压缩 */
            }

            .toilet-floor {
                background: #f8f9fa;  /* 更柔和的背景色 */
                border: 1px solid #e9ecef;  /* 更柔和的边框色 */
                border-radius: 12px;
                padding: 15px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.02);  /* 柔和的阴影 */
            }

            .toilet-floor-title {
                font-weight: bold;
                margin-bottom: 12px;
                padding-bottom: 8px;
                border-bottom: 1px solid #e9ecef;
                color: #495057;  /* 更柔和的文字颜色 */
            }

            .toilet-type {
                background: white;
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 12px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.02);  /* 轻微的阴影 */
            }

            .toilet-type:last-child {
                margin-bottom: 0;
            }

            .toilet-type-header {
                display: flex;
                justify-content: space-between;  /* 两端对齐 */
                align-items: center;
                margin-bottom: 10px;
            }

            .toilet-type-info {
                display: flex;
                align-items: center;
                justify-content: space-between;  /* 修改为两端对齐 */
                width: 100%;                     /* 占满整行 */
                padding-right: 10px;             /* 右侧留点间距 */
            }

            .toilet-type-title {
                font-weight: 500;
                color: #495057;
                margin-right: 10px;              /* 标题右侧间距 */
            }

            .toilet-type-stats {
                font-size: 12px;
                color: #6c757d;
                margin-bottom: 10px;
                padding: 4px 8px;
                background: #f8f9fa;
                border-radius: 4px;
            }

            .toilet-rooms {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                margin-top: 10px;                /* 与开关保持一定距离 */
            }

            .toilet-room {
                padding: 6px 12px;
                border-radius: 6px;
                font-size: 14px;
                transition: all 0.2s ease;
                border: 1px solid transparent;
            }

            .toilet-room.occupied {
                background: #fff3f3;  /* 更柔和的红色背景 */
                color: #dc3545;
                border-color: #ffcdd2;
            }

            .toilet-room.vacant {
                background: #f1f8f1;  /* 更柔和的绿色背景 */
                color: #28a745;
                border-color: #c3e6cb;
            }

            .toilet-room:hover {
                transform: translateY(-1px);
                box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            }

            .hidden {
                display: none;
            }

            .toilet-monitor-toggle {
                position: relative;
                display: inline-block;
                width: 40px;
                height: 20px;
                margin-left: auto;               /* 推到最右侧 */
            }

            .toilet-monitor-toggle input {
                opacity: 0;
                width: 0;
                height: 0;
            }

            .toilet-monitor-slider {
                position: absolute;
                cursor: pointer;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: #ccc;
                transition: .4s;
                border-radius: 20px;
            }

            .toilet-monitor-slider:before {
                position: absolute;
                content: "";
                height: 16px;
                width: 16px;
                left: 2px;
                bottom: 2px;
                background-color: white;
                transition: .4s;
                border-radius: 50%;
            }

            .toilet-monitor-toggle input:checked + .toilet-monitor-slider {
                background-color: #4CAF50;
            }

            .toilet-monitor-toggle input:checked + .toilet-monitor-slider:before {
                transform: translateX(20px);
            }

            .test-button {
                display: ${DEBUG.ENABLED ? 'block' : 'none'};
                margin-left: auto;
                padding: 6px 12px;
                background: #9c27b0;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.3s;
            }

            .test-button:hover {
                background: #7b1fa2;
            }

            .monitor-options {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-left: 10px;
            }

            .monitor-option-toggle {
                position: relative;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                font-size: 12px;
                color: #666;
            }

            .monitor-option-toggle .toilet-monitor-toggle {
                margin: 0;  /* 重置 margin */
            }

            .monitor-option-toggle input {
                opacity: 0;
                width: 0;
                height: 0;
            }
        `
    };

    // 厕所坑位类
    class ToiletRoom {
        constructor(element, floorInfo, type) {
            this.element = element;
            this.id = element.id;
            this.floor = floorInfo;
            this.type = type;
            this.number = element.querySelector('span').textContent;
            this.tipsElement = element.querySelector(CONFIG.SELECTORS.ROOM_STATUS);
            this.status = this.tipsElement.textContent;
            this.observer = null;
            this.lastStatus = this.status;
            this.isFirstUpdate = true;
            this.onStatusChange = null;
        }

        startMonitoring() {
            if (this.observer) {
                this.observer.disconnect();
            }

            this.observer = new MutationObserver(() => {
                const currentStatus = this.tipsElement.textContent;
                if (currentStatus !== this.lastStatus) {
                    const oldStatus = this.lastStatus;
                    this.status = currentStatus;
                    this.lastStatus = currentStatus;

                    if (!this.isFirstUpdate) {
                        this.onStatusChange?.(oldStatus, currentStatus);
                        this._dispatchStatusChange(currentStatus);
                    }
                    this.isFirstUpdate = false;
                }
            });

            this.observer.observe(this.tipsElement, CONFIG.OBSERVER.TEXT);
        }

        _dispatchStatusChange(status) {
            document.dispatchEvent(new CustomEvent(EVENTS.STATUS_CHANGED, {
                detail: {
                    floor: this.floor,
                    type: this.type,
                    number: this.number,
                    status: status
                }
            }));
        }

        stopMonitoring() {
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
        }

        destroy() {
            this.stopMonitoring();
            this.element = null;
            this.tipsElement = null;
        }
    }

    // 厕所类
    class Toilet {
        constructor(element, type, floorInfo) {
            this.type = type;
            this.rooms = Array.from(element.querySelectorAll(CONFIG.SELECTORS.TOILET_ROOMS))
                .map(el => new ToiletRoom(el, floorInfo, type));
        }

        startMonitoring() {
            this.rooms.forEach(room => room.startMonitoring());
        }

        stopMonitoring() {
            this.rooms.forEach(room => room.stopMonitoring());
        }

        destroy() {
            this.rooms.forEach(room => room.destroy());
            this.rooms = [];
        }
    }

    // 楼层类
    class FloorToilet {
        constructor(element) {
            this.floor = element.querySelector('.floor_info').textContent.replace('楼层:', '');
            this.maleToilet = new Toilet(element.querySelector('.toilet_male'), '男厕', this.floor);
            this.femaleToilet = new Toilet(element.querySelector('.toilet_female'), '女厕', this.floor);
        }

        startMonitoring() {
            this.maleToilet.startMonitoring();
            this.femaleToilet.startMonitoring();
        }

        stopMonitoring() {
            this.maleToilet.stopMonitoring();
            this.femaleToilet.stopMonitoring();
        }

        destroy() {
            this.maleToilet.destroy();
            this.femaleToilet.destroy();
        }
    }

    // UI 管理类
    class ToiletUI {
        constructor(manager) {
            this.panel = null;
            this.trigger = null;
            this.isVisible = false;
            this.hasOccupied = false;
            this.currentFloor = 'all';
            this.currentType = 'all';
            this.manager = manager;
            this.onlyVacant = false;
            this._createStyle();  // 只创建样式，不创建UI元素
        }

        _createStyle() {
            const style = document.createElement('style');
            style.textContent = UI.STYLES;
            document.head.appendChild(style);
        }

        // 分离创建触发按钮和面板的方法
        _createTrigger() {
            if (!this.trigger) {
                this.trigger = document.createElement('div');
                this.trigger.className = 'toilet-panel-trigger';
                this.trigger.innerHTML = '🚽';
                document.body.appendChild(this.trigger);

                // 添加点击事件
                this.trigger.addEventListener('click', () => {
                    this.toggle();
                });
            }
        }

        _createPanel() {
            if (!this.panel) {
                this.panel = document.createElement('div');
                this.panel.className = 'toilet-panel';
                this.panel.innerHTML = `
                    <div class="toilet-panel-header">
                        <div>厕所状态监控</div>
                        <div class="toilet-panel-close">✕</div>
                    </div>
                    <div class="toilet-panel-filters">
                        <div class="filter-group">
                            <div class="toilet-filter">
                                <label>楼层:</label>
                                <select class="floor-filter">
                                    <option value="all">全部</option>
                                </select>
                            </div>
                            <div class="toilet-filter">
                                <label>类型:</label>
                                <select class="type-filter">
                                    <option value="all">全部</option>
                                    <option value="男厕">男厕</option>
                                    <option value="女厕">女厕</option>
                                </select>
                            </div>
                        </div>
                        <div class="monitor-group">
                            <label class="monitor-option-toggle" title="监听筛选结果">
                                监听筛选结果
                                <label class="toilet-monitor-toggle">
                                    <input type="checkbox" class="monitor-all-checkbox">
                                    <span class="toilet-monitor-slider"></span>
                                </label>
                            </label>
                            <label class="monitor-option-toggle" title="仅在厕所变为空闲时发送通知">
                                仅监听空闲
                                <label class="toilet-monitor-toggle">
                                    <input type="checkbox" class="only-vacant-toggle">
                                    <span class="toilet-monitor-slider"></span>
                                </label>
                            </label>
                            <button class="test-button">模拟状态变化</button>
                        </div>
                    </div>
                    <div class="toilet-panel-content"></div>
                `;
                document.body.appendChild(this.panel);
                this._setupEventListeners();
            }
        }

        _createUI() {
            this._createTrigger();  // 创建触发按钮
            this._createPanel();    // 创建面板
        }

        _setupEventListeners() {
            // 关闭按钮事件
            this.panel.querySelector('.toilet-panel-close').addEventListener('click', () => {
                this.hide();
            });

            // 添加筛选器事件监听
            const floorFilter = this.panel.querySelector('.floor-filter');
            const typeFilter = this.panel.querySelector('.type-filter');

            floorFilter.addEventListener('change', () => {
                this.currentFloor = floorFilter.value;
                this._applyFilters();
            });

            typeFilter.addEventListener('change', () => {
                this.currentType = typeFilter.value;
                this._applyFilters();
            });

            // 修改监听全部按钮事件
            const monitorAllCheckbox = this.panel.querySelector('.monitor-all-checkbox');
            monitorAllCheckbox.addEventListener('change', () => {
                const visibleTypes = this._getVisibleTypes();
                const shouldCheck = monitorAllCheckbox.checked;

                visibleTypes.forEach(typeEl => {
                    const checkbox = typeEl.querySelector('.monitor-checkbox');
                    if (checkbox.checked !== shouldCheck) {
                        checkbox.checked = shouldCheck;
                        checkbox.dispatchEvent(new Event('change'));
                    }
                });
            });

            // 监听每个单独的开关变化
            document.addEventListener('TOILET_MONITOR_TOGGLE', () => {
                this._updateMonitorAllButton();
            });

            // 添加测试按钮事件
            const testButton = this.panel.querySelector('.test-button');
            testButton.addEventListener('click', () => {
                this._simulateStatusChange();
            });

            // 添加仅监听空闲开关事件
            const onlyVacantToggle = this.panel.querySelector('.only-vacant-toggle');
            onlyVacantToggle.addEventListener('change', () => {
                this.onlyVacant = onlyVacantToggle.checked;
                console.log(`仅监听空闲: ${this.onlyVacant ? '开启' : '关闭'}`);
            });
        }

        toggle() {
            if (this.isVisible) {
                this.hide();
            } else {
                this.show();
            }
        }

        show() {
            if (this.panel) {
                this.panel.classList.add('active');
                this.isVisible = true;
            }
        }

        hide() {
            if (this.panel) {
                this.panel.classList.remove('active');
                this.isVisible = false;
            }
        }

        updateStatus(detail) {
            const { floor, type, number, status } = detail;

            // 获取或创建楼层区域
            let floorEl = this.panel.querySelector(`.toilet-floor-${floor}`);
            if (!floorEl) {
                floorEl = this._createFloorElement(floor);
            }

            // 获取或创建类型区域
            let typeEl = floorEl.querySelector(`.toilet-type-${type}`);
            if (!typeEl) {
                typeEl = this._createTypeElement(type);
                floorEl.appendChild(typeEl);
            }

            // 更新房间状态
            let roomEl = typeEl.querySelector(`.toilet-room-${number}`);
            if (!roomEl) {
                roomEl = document.createElement('div');
                roomEl.className = 'toilet-room';
                roomEl.classList.add(`toilet-room-${number}`);
                typeEl.appendChild(roomEl);
            }

            // 更新文本和状态类名
            roomEl.textContent = `${number}号`;
            roomEl.classList.remove('occupied', 'vacant');
            roomEl.classList.add(this._getStatusClass(status));

            // 更新完状态后更新触发器状态
            this.updateTriggerStatus();
        }

        _createFloorElement(floor) {
            const el = document.createElement('div');
            el.className = `toilet-floor toilet-floor-${floor}`;
            el.setAttribute('data-floor', floor);
            el.innerHTML = `<div class="toilet-floor-title">${floor}层</div>`;
            this.panel.querySelector('.toilet-panel-content').appendChild(el);
            return el;
        }

        _createTypeElement(type, stats) {
            const el = document.createElement('div');
            el.className = `toilet-type toilet-type-${type}`;
            el.setAttribute('data-type', type);
            el.innerHTML = `
                <div class="toilet-type-header">
                    <div class="toilet-type-info">
                        <div class="toilet-type-title">
                            ${type} (使用中: ${stats.occupied}/${stats.total})
                        </div>
                        <label class="toilet-monitor-toggle" title="开启监听">
                            <input type="checkbox" class="monitor-checkbox" data-floor="${stats.floor}" data-type="${type}">
                            <span class="toilet-monitor-slider"></span>
                        </label>
                    </div>
                </div>
                <div class="toilet-rooms"></div>
            `;

            // 添加监听开关事件
            const toggleInput = el.querySelector('.monitor-checkbox');
            toggleInput.addEventListener('change', () => {
                const eventDetail = {
                    floor: toggleInput.dataset.floor,  // 从 dataset 获取 floor
                    type: type,
                    isActive: toggleInput.checked
                };
                document.dispatchEvent(new CustomEvent('TOILET_MONITOR_TOGGLE', { detail: eventDetail }));
            });

            return el;
        }

        destroy() {
            if (this.trigger) {
                this.trigger.remove();
                this.trigger = null;
            }
            if (this.panel) {
                this.panel.remove();
                this.panel = null;
            }
            this.isVisible = false;
            this.hasOccupied = false;
        }

        // 初始化所有状态
        initializeStatus(floors) {
            // 清空现有内容
            const content = this.panel.querySelector('.toilet-panel-content');
            content.innerHTML = '';

            // 按楼层排序
            floors.sort((a, b) => Number(a.floor) - Number(b.floor));

            // 遍历所有楼层和厕所，创建初始状态
            floors.forEach(floor => {
                const floorEl = this._createFloorElement(floor.floor);

                // 男厕所统计和显示
                const maleStats = this._calculateStats(floor.maleToilet.rooms);
                const maleTypeEl = this._createTypeElement('男厕', maleStats);
                floor.maleToilet.rooms.forEach(room => {
                    this._createRoomElement(maleTypeEl, room);
                });
                floorEl.appendChild(maleTypeEl);

                // 女厕所统计和显示
                const femaleStats = this._calculateStats(floor.femaleToilet.rooms);
                const femaleTypeEl = this._createTypeElement('女厕', femaleStats);
                floor.femaleToilet.rooms.forEach(room => {
                    this._createRoomElement(femaleTypeEl, room);
                });
                floorEl.appendChild(femaleTypeEl);
            });

            this.updateTriggerStatus();

            // 更新楼层筛选器选项
            const floorFilter = this.panel.querySelector('.floor-filter');
            const floorOptions = Array.from(new Set(floors.map(f => f.floor)))
                .sort((a, b) => Number(a) - Number(b));

            floorFilter.innerHTML = `
                <option value="all">全部</option>
                ${floorOptions.map(f => `<option value="${f}">${f}层</option>`).join('')}
            `;
        }

        _createRoomElement(typeEl, room) {
            const roomEl = document.createElement('div');
            roomEl.className = 'toilet-room';
            roomEl.textContent = `${room.number}号`;
            roomEl.classList.add(
                `toilet-room-${room.number}`,
                this._getStatusClass(room.status)
            );
            typeEl.querySelector('.toilet-rooms').appendChild(roomEl);
            return roomEl;
        }

        updateTriggerStatus() {
            if (!this.trigger) return;

            const content = this.panel.querySelector('.toilet-panel-content');
            const hasOccupied = content.querySelector('.toilet-room.occupied') !== null;

            if (hasOccupied) {
                this.trigger.classList.add('has-occupied');
            } else {
                this.trigger.classList.remove('has-occupied');
            }
        }

        // 新增：获取状态对应的类名
        _getStatusClass(status) {
            return status.trim() === STATUS.OCCUPIED ? 'occupied' : 'vacant';
        }

        _calculateStats(rooms) {
            const total = rooms.length;
            const occupied = rooms.filter(room => room.status.trim() === STATUS.OCCUPIED).length;
            return {
                total,
                occupied,
                vacant: total - occupied,
                occupancyRate: ((occupied / total) * 100).toFixed(1),
                floor: rooms[0]?.floor  // 添加 floor 信息
            };
        }

        _applyFilters() {
            const floors = this.panel.querySelectorAll('.toilet-floor');
            const types = this.panel.querySelectorAll('.toilet-type');

            // 应用筛选
            floors.forEach(floor => {
                const floorNum = floor.getAttribute('data-floor');
                floor.classList.toggle('hidden',
                    this.currentFloor !== 'all' && this.currentFloor !== floorNum);
            });

            types.forEach(type => {
                const typeName = type.getAttribute('data-type');
                type.classList.toggle('hidden',
                    this.currentType !== 'all' && this.currentType !== typeName);
            });

            // 更新监听按钮状态
            this._updateMonitorAllButton();
        }

        _updateMonitorAllButton() {
            const monitorAllCheckbox = this.panel.querySelector('.monitor-all-checkbox');
            const visibleTypes = this._getVisibleTypes();

            if (visibleTypes.length === 0) {
                monitorAllCheckbox.disabled = true;
                monitorAllCheckbox.parentElement.title = '无可监听内容';
                return;
            }

            monitorAllCheckbox.disabled = false;
            monitorAllCheckbox.parentElement.title = '监听筛选结果';

            const checkedCount = visibleTypes.filter(type =>
                type.querySelector('.monitor-checkbox').checked
            ).length;

            monitorAllCheckbox.checked = checkedCount === visibleTypes.length;
            monitorAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < visibleTypes.length;
        }

        _getVisibleTypes() {
            const visibleFloors = Array.from(this.panel.querySelectorAll('.toilet-floor:not(.hidden)'));
            return visibleFloors.flatMap(floor =>
                Array.from(floor.querySelectorAll('.toilet-type:not(.hidden)'))
            );
        }

        // 修改模拟方法
        _simulateStatusChange() {
            if (!DEBUG.ENABLED) return;  // 如果不是调试模式，直接返回

            // 获取所有可见的厕所房间
            const visibleRooms = Array.from(this.panel.querySelectorAll('.toilet-room:not(.hidden)'));
            if (visibleRooms.length === 0) return;

            // 随机选择一个房间
            const randomRoom = visibleRooms[Math.floor(Math.random() * visibleRooms.length)];
            const isOccupied = randomRoom.classList.contains('occupied');

            // 获取房间信息
            const floorEl = randomRoom.closest('.toilet-floor');
            const typeEl = randomRoom.closest('.toilet-type');
            const floor = floorEl.getAttribute('data-floor');
            const type = typeEl.getAttribute('data-type');
            const number = randomRoom.textContent.replace('号', '');
            const newStatus = isOccupied ? STATUS.VACANT : STATUS.OCCUPIED;

            // 找到对应的 ToiletRoom 实例
            const floorObj = this.manager.floors.find(f => f.floor === floor);
            if (floorObj) {
                const toilet = type === '男厕' ? floorObj.maleToilet : floorObj.femaleToilet;
                const room = toilet.rooms.find(r => r.number === number);
                if (room) {
                    const oldStatus = room.status;
                    room.status = newStatus;
                    room.lastStatus = newStatus;

                    // 触发回调
                    if (room.onStatusChange) {
                        room.onStatusChange(oldStatus, newStatus);
                    }
                }
            }

            // 触发状态变化事件
            document.dispatchEvent(new CustomEvent(EVENTS.STATUS_CHANGED, {
                detail: {
                    floor: floor,
                    type: type,
                    number: number,
                    status: newStatus
                }
            }));

            console.log(`模拟${floor}层${type} ${number}号状态变化: ${isOccupied ? '空闲' : '使用中'}`);
        }

        _resetUIState() {
            if (!this.panel) return;

            // 重置所有开关和筛选器
            this.panel.querySelectorAll('.monitor-checkbox, .only-vacant-toggle')
                .forEach(checkbox => checkbox.checked = false);

            this.panel.querySelectorAll('select')
                .forEach(filter => filter.value = 'all');

            // 重置状态
            this.currentFloor = 'all';
            this.currentType = 'all';
            this.onlyVacant = false;
        }
    }

    // 主管理类
    class ToiletManager {
        constructor() {
            this.iframeDoc = null;
            this.floors = [];
            this.ui = new ToiletUI(this);
            this.activeMonitors = new Set();
            this.lastNotification = null;
            this.notificationQueue = [];
            this.isProcessingQueue = false;
            this._setupEventListeners();
        }

        _setupEventListeners() {
            document.addEventListener(EVENTS.TAB_OPENED, (e) => {
                this._handleTabOpen(e);
                this.ui._createUI();  // 打开标签时创建UI
            });
            document.addEventListener(EVENTS.TAB_CLOSED, () => {
                this._handleTabClose();
                this.ui.destroy();    // 关闭标签时销毁UI
            });
            document.addEventListener(EVENTS.STATUS_CHANGED, (e) => {
                this._handleStatusChange(e);
                this.ui.updateStatus(e.detail);  // 更新UI状态
            });

            // 添加监听开关事件处理
            document.addEventListener('TOILET_MONITOR_TOGGLE', (e) => {
                const { floor, type, isActive } = e.detail;
                console.log(`监听状态变化: ${floor}层${type} ${isActive ? '开启' : '关闭'}监听`);

                const monitorKey = `${floor}-${type}`;
                if (isActive) {
                    this.startSpecificMonitor(floor, type);
                    this.activeMonitors.add(monitorKey);
                } else {
                    this.stopSpecificMonitor(floor, type);
                    this.activeMonitors.delete(monitorKey);
                }
            });
        }

        async _handleTabOpen(e) {
            try {
                this.iframeDoc = await this._waitForIframeContent(e.detail.iframe);
                this._init();
                this.startMonitoring();
            } catch (error) {
                console.error('初始化失败:', error.message);
                this.destroy();
            }
        }

        _handleTabClose() {
            this.destroy();
        }

        _handleStatusChange(e) {
            this.ui.updateStatus(e.detail);
            this.ui.updateTriggerStatus();
        }

        _init() {
            // 清理旧数据
            this.floors = [];
            this.activeMonitors.clear();

            // 初始化新数据
            const toiletMaps = this.iframeDoc.querySelectorAll(CONFIG.SELECTORS.TOILET_MAPS);
            this.floors = Array.from(toiletMaps).map(el => new FloorToilet(el));

            // 重置UI状态（只调用一次）
            this.ui._resetUIState();

            // 初始化UI状态
            this.ui.initializeStatus(this.floors);
        }

        startMonitoring() {
            this.floors.forEach(floor => floor.startMonitoring());
        }

        stopMonitoring() {
            this.floors.forEach(floor => floor.stopMonitoring());
        }

        destroy() {
            this.stopMonitoring();
            this.floors.forEach(floor => floor.destroy());
            this.floors = [];
            this.iframeDoc = null;
            this.ui.destroy();  // 销毁 UI
        }

        async _waitForIframeContent(iframe) {
            return new Promise((resolve, reject) => {
                const checkContent = setInterval(() => {
                    try {
                        const doc = iframe.contentDocument || iframe.contentWindow.document;
                        if (doc.querySelector(CONFIG.SELECTORS.TOILET_MAPS)) {
                            clearInterval(checkContent);
                            resolve(doc);
                        }
                    } catch (e) {
                        clearInterval(checkContent);
                        reject(new Error('无法访问iframe内容'));
                    }
                }, 500);
            });
        }

        startSpecificMonitor(floor, type) {
            const floorObj = this.floors.find(f => f.floor === floor);
            if (!floorObj) return;

            const toilet = type === '男厕' ? floorObj.maleToilet : floorObj.femaleToilet;
            toilet.rooms.forEach(room => {
                room.onStatusChange = (oldStatus, newStatus) => {
                    this._handleRoomStatusChange(floor, type, room, oldStatus, newStatus);
                };
            });
            console.log(`开始监听 ${floor}层${type}`);
        }

        stopSpecificMonitor(floor, type) {
            const floorObj = this.floors.find(f => f.floor === floor);
            if (!floorObj) return;

            const toilet = type === '男厕' ? floorObj.maleToilet : floorObj.femaleToilet;
            toilet.rooms.forEach(room => {
                room.onStatusChange = null;
            });
            console.log(`停止监听 ${floor}层${type}`);
        }

        _handleRoomStatusChange(floor, type, room, oldStatus, newStatus) {
            const monitorKey = `${floor}-${type}`;
            if (!this.activeMonitors.has(monitorKey)) return;

            if (this.ui.onlyVacant && newStatus !== STATUS.VACANT) {
                return;
            }

            const message = this._generateNotificationMessage(floor, type, room, oldStatus, newStatus);
            GM_notification({
                title: newStatus === STATUS.VACANT ?
                    NOTIFICATION.TITLE.VACANT :
                    NOTIFICATION.TITLE.OCCUPIED,
                text: message,
                image: NOTIFICATION.IMAGE,  // 添加图标
                highlight: newStatus === STATUS.VACANT ? NOTIFICATION.HIGHLIGHT : false,
                silent: newStatus === STATUS.VACANT ?
                    NOTIFICATION.SILENT.VACANT :
                    NOTIFICATION.SILENT.OCCUPIED,
                onclick: () => {
                    window.focus();
                    this.ui.show();
                }
            });
        }

        _generateNotificationMessage(floor, type, room, oldStatus, newStatus) {
            // 简化消息内容
            return `${floor}层${type} ${room.number}号`;
        }
    }

    // 标签监听器
    class TabWatcher {
        constructor() {
            this.hasFound = false;
            this.currentIframe = null;
            this.currentIframeSrc = null;
            this._init();
        }

        _init() {
            const observer = new MutationObserver(this._checkTabChanges.bind(this));
            observer.observe(document.body, CONFIG.OBSERVER.DOM);
        }

        _checkTabChanges() {
            const tabList = document.querySelector(CONFIG.SELECTORS.TAB_LIST);
            if (!tabList) return;

            const toiletTab = Array.from(tabList.getElementsByTagName('label'))
                .find(label => label.textContent.includes('厕所空位查询'));

            const iframe = document.querySelector(CONFIG.SELECTORS.TOILET_IFRAME);

            if (toiletTab) {
                if (!this.hasFound || !this.currentIframe) {
                    // 首次打开标签
                    if (iframe) {
                        this.hasFound = true;
                        this.currentIframe = iframe;
                        this.currentIframeSrc = iframe.src;
                        this._setupIframeRefreshListener(iframe);
                        document.dispatchEvent(new CustomEvent(EVENTS.TAB_OPENED, { detail: { iframe } }));
                    }
                } else if (iframe !== this.currentIframe) {
                    // iframe 元素改变，先触发关闭再触发打开
                    document.dispatchEvent(new CustomEvent(EVENTS.TAB_CLOSED));
                    this.currentIframe = iframe;
                    this.currentIframeSrc = iframe.src;
                    this._setupIframeRefreshListener(iframe);
                    document.dispatchEvent(new CustomEvent(EVENTS.TAB_OPENED, { detail: { iframe } }));
                }
            }
            else if (!toiletTab && this.hasFound) {
                // 标签关闭
                this.hasFound = false;
                this.currentIframe = null;
                this.currentIframeSrc = null;
                document.dispatchEvent(new CustomEvent(EVENTS.TAB_CLOSED));
            }
        }

        _setupIframeRefreshListener(iframe) {
            iframe.addEventListener('load', () => {
                try {
                    const doc = iframe.contentDocument || iframe.contentWindow.document;
                    const refreshButton = doc.querySelector('a[onclick="location.reload(true)"]');
                    if (refreshButton) {
                        refreshButton.addEventListener('click', () => {
                            // 点击刷新按钮时，先触发关闭事件
                            document.dispatchEvent(new CustomEvent(EVENTS.TAB_CLOSED));
                            setTimeout(() => {
                                document.dispatchEvent(new CustomEvent(EVENTS.TAB_OPENED, {
                                    detail: { iframe: this.currentIframe }
                                }));
                            }, 100);
                        });
                    }
                } catch (error) {
                    console.error('设置刷新按钮监听失败:', error);
                }
            });
        }
    }

    // 初始化
    new ToiletManager();
    new TabWatcher();
})(); 
