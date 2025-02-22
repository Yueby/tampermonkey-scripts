// ==UserScript==
// @name         Booth Cookies Extractor
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  从Booth网站提取必要的cookies
// @author       Yueby
// @match        https://manage.booth.pm/*
// @match        https://booth.pm/*
// @match        https://accounts.booth.pm/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM_notification
// ==/UserScript==

(function() {
    'use strict';

    // 添加动画样式
    const style = document.createElement('style');
    style.textContent = `
        @import url('https://fonts.googleapis.com/icon?family=Material+Icons');
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .booth-session-btn {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 10000;
            width: 56px;
            height: 56px;
            background-color: #ffffff;
            color: #5f6368;
            border: none;
            border-radius: 16px;
            cursor: pointer;
            font-size: 24px;
            box-shadow: rgba(0, 0, 0, 0.05) 0px 6px 24px 0px, rgba(0, 0, 0, 0.08) 0px 0px 0px 1px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            padding: 0;
            overflow: hidden;
        }
        .booth-session-btn:hover {
            background-color: #f8f9fa;
            transform: translateY(-1px);
            box-shadow: rgba(0, 0, 0, 0.1) 0px 10px 30px 0px, rgba(0, 0, 0, 0.08) 0px 0px 0px 1px;
        }
        .booth-session-btn:active {
            transform: translateY(1px);
        }
        .booth-session-btn.loading {
            opacity: 0.7;
            cursor: not-allowed;
            transform: none;
            background-color: #f8f9fa;
        }
        .booth-session-btn .icon {
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
        }
        .booth-session-btn .material-icons {
            font-size: 24px;
            color: #5f6368;
            transition: all 0.3s ease;
        }
        .booth-session-btn:hover .material-icons {
            color: #1a73e8;
        }
        .booth-session-btn .spinner {
            position: absolute;
            width: 24px;
            height: 24px;
            border: 2.5px solid rgba(26, 115, 232, 0.2);
            border-top: 2.5px solid #1a73e8;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s ease;
        }
        .booth-session-btn.loading .icon {
            opacity: 0;
            visibility: hidden;
        }
        .booth-session-btn.loading .spinner {
            opacity: 1;
            visibility: visible;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        @keyframes success-fade {
            0% { transform: scale(0.8); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
        }
    `;
    document.head.appendChild(style);

    // 创建按钮
    const button = document.createElement('button');
    button.className = 'booth-session-btn';
    button.innerHTML = `
        <div class="icon">
            <span class="material-icons">cookie</span>
        </div>
        <div class="spinner"></div>
    `;

    // 从响应头中提取cookie值和过期时间
    function extractCookieInfo(headers) {
        const setCookieHeader = headers.split('\n').find(line =>
            line.toLowerCase().startsWith('set-cookie:') &&
            line.includes('_plaza_session_nktz7u=')
        );

        if (setCookieHeader) {
            const cookieValue = setCookieHeader
                .split(';')[0]
                .split('=')
                .slice(1)
                .join('=')
                .trim();

            // 提取 expires 字段
            const expiresMatch = setCookieHeader.match(/expires=([^;]+)/i);
            const expires = expiresMatch ? new Date(expiresMatch[1].trim()).toISOString() : null;

            return {
                value: cookieValue,
                expires: expires
            };
        }
        return null;
    }

    // 设置按钮状态
    function setButtonState(state) {
        const icon = button.querySelector('.icon .material-icons');
        
        if (state === 'loading') {
            button.classList.add('loading');
            icon.textContent = 'cookie';
        } else if (state === 'success') {
            button.classList.remove('loading');
            icon.textContent = 'check_circle';
            icon.style.color = '#34a853';
            setTimeout(() => {
                icon.textContent = 'cookie';
                icon.style.color = '';
            }, 2000);
        } else if (state === 'error') {
            button.classList.remove('loading');
            icon.textContent = 'error';
            icon.style.color = '#ea4335';
            setTimeout(() => {
                icon.textContent = 'cookie';
                icon.style.color = '';
            }, 2000);
        } else {
            button.classList.remove('loading');
            icon.textContent = 'cookie';
            icon.style.color = '';
        }
    }

    // 点击事件处理
    button.addEventListener('click', () => {
        if (button.classList.contains('loading')) return;

        console.log('========= 开始获取Session =========');
        setButtonState('loading');

        // 发送请求获取登录页面
        GM_xmlhttpRequest({
            method: 'GET',
            url: 'https://manage.booth.pm/orders',
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1'
            },
            onload: function(response) {
                console.log('响应状态:', response.status);
                console.log('响应头:', response.responseHeaders);

                const cookieInfo = extractCookieInfo(response.responseHeaders);
                if (cookieInfo) {
                    const cookieObj = {
                        _plaza_session_nktz7u: cookieInfo.value,
                        updated_at: new Date().toISOString(),
                        expires_at: cookieInfo.expires
                    };

                    // 复制到剪贴板
                    GM_setClipboard(JSON.stringify(cookieObj, null, 2));

                    // 显示通知
                    const expiresText = cookieInfo.expires 
                        ? `\n过期时间: ${new Date(cookieInfo.expires).toLocaleString()}`
                        : '';
                    GM_notification({
                        text: `Session已复制到剪贴板${expiresText}`,
                        title: '获取成功',
                        timeout: 5000
                    });

                    // 控制台输出
                    console.log('获取到的Session:', cookieObj);
                    console.log('提示：此Session值会定期更新，建议：');
                    console.log('1. 及时使用获取到的值');
                    console.log('2. 如果访问出现401错误，请重新获取');

                    setButtonState('success');
                } else {
                    console.log('未找到_plaza_session_nktz7u');
                    GM_notification({
                        text: '未找到有效的 Session',
                        title: '获取失败',
                        timeout: 3000
                    });
                    setButtonState('error');
                }
            },
            onerror: function(error) {
                console.error('请求出错:', error);
                GM_notification({
                    text: '请求出错，请检查网络连接',
                    title: '错误',
                    timeout: 3000
                });
                setButtonState('error');
            }
        });
    });

    // 添加按钮到页面
    document.body.appendChild(button);
})(); 