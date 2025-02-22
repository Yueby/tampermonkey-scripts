// ==UserScript==
// @name         X Draw Helper
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  X Draw Helper, helps to quickly conduct draws
// @author       Yueby
// @match        https://x.com/*
// @require      https://cdn.jsdelivr.net/npm/axios@1.6.7/dist/axios.min.js
// ==/UserScript==

(function () {
    'use strict';

    // 全局 AbortController
    let currentAbortController = null;

    // 语言包定义
    const LANGUAGES = {
        en: {
            name: 'English',
            drawHelper: 'Draw Helper',
            loading: 'Loading...',
            loadingRetweets: 'Loading retweets...',
            loadingLikes: 'Loading likes...',
            loginRequired: 'Failed to get data. Please make sure you are logged in and refresh the page!',
            useOnTweet: 'Please use Draw Helper on a tweet page!',
            retweets: 'Retweets',
            likes: 'Likes',
            draw: 'Draw',
            export: 'Export',
            close: 'Close',
            filters: 'Filters',
            followingMe: 'Following me',
            hasRetweeted: 'Has retweeted',
            hasLiked: 'Has liked',
            qualifiedUsers: 'Qualified Users',
            selectFilters: 'Please select filters',
            noQualifiedUsers: 'No qualified users',
            people: 'people',
            startDraw: 'Start Draw',
            noUsers: 'No users found',
            notEnoughUsers: 'Only ${count} qualified users!',
            drawResult: 'Draw Result',
            congratulations: 'Congratulations to the following users:',
            following: 'Following',
            followingYou: 'Follows you',
            interactionType: 'Interaction Type',
            username: 'Username',
            handle: 'Handle',
            avatarUrl: 'Avatar URL',
            bio: 'Bio',
            yes: 'Yes',
            no: 'No',
            retweetType: 'Retweet',
            likeType: 'Like',
            madeWith: 'Made with ❤️ by'
        },
        zh: {
            name: '中文',
            drawHelper: '抽奖助手',
            loading: '加载中...',
            loadingRetweets: '正在获取转发数据...',
            loadingLikes: '正在获取点赞数据...',
            loginRequired: '获取数据失败，请登录后刷新页面！',
            useOnTweet: '请在推文页面使用抽奖助手！',
            retweets: '转发',
            likes: '点赞',
            draw: '抽奖',
            export: '导出',
            close: '关闭',
            filters: '筛选条件',
            followingMe: '已关注我',
            hasRetweeted: '已转发',
            hasLiked: '已点赞',
            qualifiedUsers: '符合条件的用户',
            selectFilters: '请选择筛选条件',
            noQualifiedUsers: '暂无符合条件的用户',
            people: '人',
            startDraw: '开始抽奖',
            noUsers: '暂无用户数据',
            notEnoughUsers: '仅有 ${count} 位符合条件的用户',
            drawResult: '抽奖结果',
            congratulations: '恭喜以下用户中奖：',
            following: '已关注',
            followingYou: '关注了你',
            interactionType: '互动类型',
            username: '用户名',
            handle: '用户ID',
            avatarUrl: '头像链接',
            bio: '个人简介',
            yes: '是',
            no: '否',
            retweetType: '转发',
            likeType: '点赞',
            madeWith: '开发者：❤️',
            loadingRetry: '加载失败，正在重试...',
            loadingNoMore: '没有更多数据了',
            loadingError: '加载出错，请稍后再试'
        },
        ja: {
            name: '日本語',
            drawHelper: '抽選ツール',
            loading: '読み込み中...',
            loadingRetweets: 'リツイートデータを取得中...',
            loadingLikes: 'いいねデータを取得中...',
            loginRequired: 'データの取得に失敗しました。ログインして再度お試しください。',
            useOnTweet: 'ツイート画面で使用してください。',
            retweets: 'リツイート',
            likes: 'いいね',
            draw: '抽選',
            export: 'エクスポート',
            close: '閉じる',
            filters: 'フィルター',
            followingMe: 'フォロワー',
            hasRetweeted: 'リツイート済',
            hasLiked: 'いいね済',
            qualifiedUsers: '対象ユーザー',
            selectFilters: 'フィルターを選択',
            noQualifiedUsers: '対象ユーザーがいません',
            people: '名',
            startDraw: '抽選開始',
            noUsers: 'ユーザーがいません',
            notEnoughUsers: '対象ユーザーは${count}名のみです',
            drawResult: '抽選結果',
            congratulations: '当選者は以下の通りです：',
            following: 'フォロー中',
            followingYou: 'フォローされています',
            interactionType: 'アクション',
            username: 'ユーザー名',
            handle: 'アカウントID',
            avatarUrl: 'アイコンURL',
            bio: 'プロフィール',
            yes: 'はい',
            no: 'いいえ',
            retweetType: 'リツイート',
            likeType: 'いいね',
            madeWith: '開発者：❤️'
        }
    };

    // 当前语言
    let currentLang = localStorage.getItem('x-draw-helper-lang') || 'en';

    // 全局数据管理
    const globalData = {
        retweets: [],
        likes: [],
        filters: {
            followed_by: false,
            retweet: false,
            like: false
        },
        drawCount: 1,
        qualifiedUsers: [],
        updateQualifiedUsers() {
            const hasActiveFilters = Object.values(this.filters).some(value => value);
            const allUsers = new Map();

            // 先处理转发用户
            this.retweets.forEach(user => {
                allUsers.set(user.handle, { ...user, hasRetweet: true });
            });
            // 再处理点赞用户
            this.likes.forEach(user => {
                if (allUsers.has(user.handle)) {
                    const existingUser = allUsers.get(user.handle);
                    allUsers.set(user.handle, { ...existingUser, hasLike: true });
                } else {
                    allUsers.set(user.handle, { ...user, hasLike: true });
                }
            });

            if (!hasActiveFilters) {
                this.qualifiedUsers = Array.from(allUsers.values());
                return;
            }

            // 应用筛选条件
            this.qualifiedUsers = Array.from(allUsers.values()).filter(user => {
                if (this.filters.followed_by && !user.followed_by) return false;
                if (this.filters.retweet && !user.hasRetweet) return false;
                if (this.filters.like && !user.hasLike) return false;
                return true;
            });
        },
        toggleFilter(filter) {
            this.filters[filter] = !this.filters[filter];
            this.updateQualifiedUsers();
        },
        setDrawCount(count) {
            this.drawCount = count;
        },
        performDraw() {
            if (this.qualifiedUsers.length === 0) {
                return { success: false, message: 'noQualifiedUsers' };
            }
            if (this.drawCount > this.qualifiedUsers.length) {
                return { success: false, message: 'notEnoughUsers', count: this.qualifiedUsers.length };
            }

            // 随机抽取用户
            const winners = [];
            const tempUsers = [...this.qualifiedUsers];
            for (let i = 0; i < this.drawCount; i++) {
                const index = Math.floor(Math.random() * tempUsers.length);
                winners.push(tempUsers[index]);
                tempUsers.splice(index, 1);
            }

            return { success: true, winners };
        }
    };

    // 获取翻译文本
    function t(key, params = {}) {
        const text = LANGUAGES[currentLang][key] || LANGUAGES.en[key];
        return text.replace(/\${(\w+)}/g, (_, p) => params[p]);
    }

    // 匹配推文URL的正则表达式
    const tweetUrlPattern = /https:\/\/x\.com\/[^/]+\/status\/\d+/;

    // 创建抽奖按钮（改为角标）
    function createDrawButton() {
        const button = document.createElement('div');
        button.id = 'draw-helper-button';
        button.innerHTML = `
            <div class="draw-helper-toggle" data-translation-key="drawHelper" style="
                position: fixed;
                top: 50%;
                right: -30px;
                transform: translateY(-50%);
                background-color: #1D9BF0;
                color: white;
                padding: 10px;
                border-radius: 8px 0 0 8px;
                cursor: pointer;
                z-index: 9999;
                font-size: 14px;
                writing-mode: vertical-rl;
                text-orientation: mixed;
                transition: right 0.3s ease;
            ">
            </div>
        `;

        const toggle = button.querySelector('.draw-helper-toggle');

        toggle.addEventListener('mouseover', () => {
            toggle.style.right = '0';
        });

        toggle.addEventListener('mouseout', () => {
            toggle.style.right = '-30px';
        });

        toggle.addEventListener('click', handleDrawPanel);
        document.body.appendChild(button);
        UITranslator.translateContainer(button);
    }

    // 检查URL并更新UI显示状态
    function updateButtonVisibility() {
        const button = document.getElementById('draw-helper-button');
        const panel = document.querySelector('.draw-helper-panel');
        const resultPopup = document.querySelector('.draw-result-popup');
        const isValidPage = tweetUrlPattern.test(window.location.href);

        // 更新按钮显示状态
        if (button) {
            button.style.display = isValidPage ? 'block' : 'none';
        }

        // 如果不在有效页面，关闭所有面板
        if (!isValidPage) {
            if (panel) {
                panel.remove();
            }
            if (resultPopup) {
                resultPopup.remove();
            }
        }
    }

    // Twitter API 请求方法
    async function fetchTwitterData(endpoint, variables, csrfToken, loadingDiv, loadingKey, maxRetries = 3, abortController) {
        const features = {
            "profile_label_improvements_pcf_label_in_post_enabled": true,
            "rweb_tipjar_consumption_enabled": true,
            "responsive_web_graphql_exclude_directive_enabled": true,
            "verified_phone_label_enabled": false,
            "creator_subscriptions_tweet_preview_api_enabled": true,
            "responsive_web_graphql_timeline_navigation_enabled": true,
            "responsive_web_graphql_skip_user_profile_image_extensions_enabled": false,
            "premium_content_api_read_enabled": false,
            "communities_web_enable_tweet_community_results_fetch": true,
            "c9s_tweet_anatomy_moderator_badge_enabled": true,
            "responsive_web_grok_analyze_button_fetch_trends_enabled": false,
            "responsive_web_grok_analyze_post_followups_enabled": false,
            "responsive_web_jetfuel_frame": false,
            "responsive_web_grok_share_attachment_enabled": true,
            "articles_preview_enabled": true,
            "responsive_web_edit_tweet_api_enabled": true,
            "graphql_is_translatable_rweb_tweet_is_translatable_enabled": true,
            "view_counts_everywhere_api_enabled": true,
            "longform_notetweets_consumption_enabled": true,
            "responsive_web_twitter_article_tweet_consumption_enabled": true,
            "tweet_awards_web_tipping_enabled": false,
            "responsive_web_grok_analysis_button_from_backend": true,
            "creator_subscriptions_quote_tweet_preview_enabled": false,
            "freedom_of_speech_not_reach_fetch_enabled": true,
            "standardized_nudges_misinfo": true,
            "tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled": true,
            "rweb_video_timestamps_enabled": true,
            "longform_notetweets_rich_text_read_enabled": true,
            "longform_notetweets_inline_media_enabled": true,
            "responsive_web_grok_image_annotation_enabled": false,
            "responsive_web_enhance_cards_enabled": false
        };

        let hasNextPage = true;
        let cursor = null;
        const result = [];
        let totalProcessed = 0;

        const makeRequest = async (retryCount) => {
            const vars = {
                ...variables,
                count: 20,
                includePromotedContent: true,
                cursor: cursor || undefined
            };

            try {
                const response = await axios.get(
                    `https://x.com/i/api/graphql/${endpoint}?variables=${encodeURIComponent(JSON.stringify(vars))}&features=${encodeURIComponent(JSON.stringify(features))}`,
                    {
                        headers: {
                            'authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
                            'x-csrf-token': csrfToken,
                            'x-twitter-auth-type': 'OAuth2Session',
                            'x-twitter-active-user': 'yes',
                            'content-type': 'application/json'
                        },
                        signal: abortController?.signal
                    }
                );

                return response.data;
            } catch (error) {
                if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
                    throw new Error('请求被取消');
                }
                throw error;
            }
        };

        while (hasNextPage) {
            let lastError;
            let success = false;

            for (let retryCount = 0; retryCount < maxRetries && !success; retryCount++) {
                try {
                    const data = await makeRequest(retryCount);
                    const timeline = data.data?.retweeters_timeline?.timeline || data.data?.favoriters_timeline?.timeline;
                    
                    // 检查是否有timeline数据
                    if (!timeline) {
                        console.log('没有timeline数据');
                        hasNextPage = false;
                        break;
                    }

                    // 检查是否有终止指令
                    if (timeline.instructions.some(instruction => instruction.type === 'TimelineTerminateTimeline')) {
                        console.log('遇到终止指令，数据获取完成');
                        hasNextPage = false;
                        break;
                    }

                    const addEntriesInstruction = timeline.instructions.find(instruction => 
                        instruction.type === 'TimelineAddEntries'
                    );

                    // 如果没有AddEntries指令，说明没有更多数据
                    if (!addEntriesInstruction?.entries) {
                        console.log('没有更多数据');
                        hasNextPage = false;
                        break;
                    }

                    // 处理用户数据
                    const users = addEntriesInstruction.entries
                        .filter(entry => entry.entryId?.startsWith('user-'))
                        .map(entry => {
                            const result = entry.content?.itemContent?.user_results?.result;
                            const legacy = result?.legacy || {};
                            const restId = result?.rest_id;
                            
                            return {
                                username: legacy.name || '未知用户',
                                handle: legacy.screen_name || restId || '未知ID',
                                avatarUrl: legacy.profile_image_url_https || '',
                                bio: legacy.description || '',
                                following: legacy.following || false,
                                followed_by: legacy.followed_by || false
                            };
                        })
                        .filter(user => user.handle !== '未知ID');

                    if (users.length > 0) {
                        totalProcessed += users.length;
                        console.log(`获取到 ${users.length} 个用户数据（总计：${totalProcessed}）`);
                        result.push(...users);
                        
                        // 更新加载提示
                        if (loadingDiv && loadingKey) {
                            loadingDiv.textContent = `${t(loadingKey)} (${totalProcessed})`;
                        }
                    } else {
                        console.log('本页没有有效的用户数据');
                    }

                    // 获取下一页的cursor
                    const bottomCursor = addEntriesInstruction.entries.find(entry => 
                        entry.content?.cursorType === 'Bottom'
                    );

                    if (bottomCursor?.content?.value && bottomCursor.content.value !== cursor) {
                        cursor = bottomCursor.content.value;
                        console.log('获取到新的cursor:', cursor);
                    } else {
                        console.log('没有找到新的cursor，数据获取完成');
                        hasNextPage = false;
                    }

                    success = true;

                } catch (error) {
                    lastError = error;
                    console.warn(`请求失败，尝试重试 ${retryCount + 1}/${maxRetries}:`, error);
                    
                    if (retryCount === maxRetries - 1) {
                        console.warn('达到最大重试次数，停止获取');
                        hasNextPage = false;
                        throw lastError;
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
                }
            }
        }

        console.log(`数据获取完成，总共获取到 ${result.length} 个用户`);
        return result;
    }

    // 获取互动用户数据
    async function getInteractionUsers() {
        // 如果存在正在进行的请求，取消它
        if (currentAbortController) {
            currentAbortController.abort();
        }

        // 创建新的 AbortController
        currentAbortController = new AbortController();

        const result = {
            retweets: [],
            likes: []
        };

        let loadingDiv;
        try {
            const currentUrl = window.location.href.replace(/\/$/, '');
            const tweetId = currentUrl.split('/status/')[1]?.split('/')[0];
            
            if (!tweetId) {
                throw new Error('无效的推文链接');
            }

            // 创建加载状态提示
            loadingDiv = document.createElement('div');
            loadingDiv.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #15202B;
                color: white;
                padding: 20px;
                border-radius: 16px;
                box-shadow: 0 0 10px rgba(0,0,0,0.5);
                z-index: 10000;
                border: 1px solid #38444D;
            `;
            loadingDiv.dataset.translationKey = 'loading';
            document.body.appendChild(loadingDiv);
            UITranslator.translate(loadingDiv);

            // 获取认证信息
            const csrfToken = document.cookie.split('; ').find(row => row.startsWith('ct0='))?.split('=')[1];
            if (!csrfToken) {
                throw new Error('未找到CSRF Token，请确保已登录');
            }

            // 并行获取转发和点赞数据
            console.log('开始获取用户数据...');
            const [retweets, likes] = await Promise.all([
                // 获取转发数据
                (async () => {
                    loadingDiv.dataset.translationKey = 'loadingRetweets';
                    UITranslator.translate(loadingDiv);
                    console.log('开始获取转发用户数据...');
                    const data = await fetchTwitterData(
                        'niCJ2QyTuAgZWv01E7mqJQ/Retweeters',
                        { tweetId },
                        csrfToken,
                        loadingDiv,
                        'loadingRetweets',
                        3,
                        currentAbortController
                    );
                    console.log(`转发用户数据获取完成，原始数据数量：${data.length}`);
                    return data;
                })(),
                // 获取点赞数据
                (async () => {
                    loadingDiv.dataset.translationKey = 'loadingLikes';
                    UITranslator.translate(loadingDiv);
                    console.log('开始获取点赞用户数据...');
                    const data = await fetchTwitterData(
                        'aLZ5wrqDYuDm9c_xNl667w/Favoriters',
                        { tweetId },
                        csrfToken,
                        loadingDiv,
                        'loadingLikes',
                        3,
                        currentAbortController
                    );
                    console.log(`点赞用户数据获取完成，原始数据数量：${data.length}`);
                    return data;
                })()
            ]);

            result.retweets = retweets;
            result.likes = likes;

            // 统计重复用户
            const retweetHandles = new Set(result.retweets.map(u => u.handle));
            const likeHandles = new Set(result.likes.map(u => u.handle));
            const duplicateCount = [...retweetHandles].filter(h => likeHandles.has(h)).length;
            console.log(`同时转发和点赞的用户数量：${duplicateCount}`);

        } catch (error) {
            console.error('获取互动数据时出错：', error);
            const messageDiv = document.createElement('div');
            UITranslator.register(messageDiv, error.message === '未找到CSRF Token，请确保已登录' ? 'loginRequired' : 'loadingError');
            alert(messageDiv.textContent);
        } finally {
            // 确保加载提示被移除
            if (loadingDiv?.parentNode) {
                loadingDiv.remove();
            }
        }

        return result;
    }

    // 处理面板显示
    async function handleDrawPanel() {
        const currentUrl = window.location.href;
        if (!tweetUrlPattern.test(currentUrl)) {
            const messageDiv = document.createElement('div');
            UITranslator.register(messageDiv, 'useOnTweet');
            alert(messageDiv.textContent);
            return;
        }

        // 如果已经存在面板，先移除
        const existingPanel = document.querySelector('.draw-helper-panel');
        if (existingPanel) {
            existingPanel.remove();
        }

        // 如果存在结果弹窗，也移除
        const existingResult = document.querySelector('.draw-result-popup');
        if (existingResult) {
            existingResult.remove();
        }

        // 获取互动数据
        const interactionData = await getInteractionUsers();

        // 更新全局数据
        globalData.retweets = interactionData.retweets;
        globalData.likes = interactionData.likes;

        // 创建面板
        const panelHTML = `
            <div class="draw-helper-panel" style="
                position: fixed;
                top: 50%;
                right: 20px;
                transform: translateY(-50%);
                background: #15202B;
                color: white;
                border-radius: 16px;
                box-shadow: 0 0 10px rgba(0,0,0,0.5);
                z-index: 10000;
                border: 1px solid #38444D;
                width: 400px;
                max-height: 80vh;
                display: flex;
                flex-direction: column;
            ">
                <!-- 标题栏 -->
                <div style="
                    padding: 16px;
                    border-bottom: 1px solid #38444D;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <h3 data-translation-key="drawHelper" style="margin: 0; color: white;"></h3>
                    <div style="display: flex; align-items: center;">
                        <div class="lang-switch-container" style="
                            display: flex;
                            gap: 8px;
                            align-items: center;
                            margin-left: auto;
                            margin-right: 8px;
                        ">
                            <select class="lang-switch" style="
                                background: #273340;
                                color: white;
                                border: 1px solid #38444D;
                                border-radius: 4px;
                                padding: 4px 8px;
                                cursor: pointer;
                                font-size: 14px;
                            ">
                                ${Object.entries(LANGUAGES).map(([lang, data]) => `
                                    <option value="${lang}" ${currentLang === lang ? 'selected' : ''}>
                                        ${data.name}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        <button class="draw-helper-close" style="
                            background: none;
                            border: none;
                            color: #71767B;
                            cursor: pointer;
                            font-size: 20px;
                            padding: 4px;
                        ">×</button>
                    </div>
                </div>

                <!-- 标签页 -->
                <div class="draw-helper-tabs" style="
                    display: flex;
                    border-bottom: 1px solid #38444D;
                ">
                    <button class="draw-helper-tab" data-tab="retweets" style="
                        flex: 1;
                        padding: 12px;
                        background: none;
                        border: none;
                        color: white;
                        cursor: pointer;
                        border-bottom: 2px solid #1D9BF0;
                        text-align: center;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 4px;
                    ">
                        <span data-translation-key="retweets"></span>
                        <span style="font-size: 12px; color: #71767B;">${interactionData.retweets.length}</span>
                    </button>
                    <button class="draw-helper-tab" data-tab="likes" style="
                        flex: 1;
                        padding: 12px;
                        background: none;
                        border: none;
                        color: #71767B;
                        cursor: pointer;
                        border-bottom: 2px solid transparent;
                        text-align: center;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 4px;
                    ">
                        <span data-translation-key="likes"></span>
                        <span style="font-size: 12px; color: #71767B;">${interactionData.likes.length}</span>
                    </button>
                    <button class="draw-helper-tab" data-tab="draw" style="
                        flex: 1;
                        padding: 12px;
                        background: none;
                        border: none;
                        color: #71767B;
                        cursor: pointer;
                        border-bottom: 2px solid transparent;
                        text-align: center;
                    ">
                        <span data-translation-key="draw"></span>
                    </button>
                </div>

                <!-- 内容区域 -->
                <div class="draw-helper-content" style="
                    flex: 1;
                    overflow-y: auto;
                    padding: 16px;
                ">
                    ${renderUserList(interactionData.retweets)}
                </div>

                <!-- 底部工具栏 -->
                <div style="
                    padding: 16px;
                    border-top: 1px solid #38444D;
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                ">
                    <button class="draw-helper-export" data-translation-key="export" style="
                        padding: 8px 16px;
                        background: #1D9BF0;
                        color: white;
                        border: none;
                        border-radius: 20px;
                        cursor: pointer;
                        font-weight: bold;
                        transition: background-color 0.2s;
                    "></button>
                </div>

                <!-- 页脚 -->
                <div style="
                    padding: 8px 16px;
                    border-top: 1px solid #38444D;
                    text-align: center;
                    font-size: 12px;
                    color: #71767B;
                ">
                    <span data-translation-key="madeWith"></span> <a href="https://github.com/yueby" target="_blank" class="author-link" style="
                        color: #1D9BF0;
                        text-decoration: none;
                        transition: color 0.2s;
                    ">Yueby</a>
                </div>
            </div>
        `;

        // 添加面板到页面
        const panelDiv = document.createElement('div');
        panelDiv.innerHTML = panelHTML;
        document.body.appendChild(panelDiv);

        // 初始化翻译
        UITranslator.translateContainer(panelDiv);

        // 添加事件监听器
        const panel = panelDiv.querySelector('.draw-helper-panel');
        const closeButton = panelDiv.querySelector('.draw-helper-close');
        const exportButton = panelDiv.querySelector('.draw-helper-export');
        const tabs = panelDiv.querySelectorAll('.draw-helper-tab');
        const content = panelDiv.querySelector('.draw-helper-content');
        const langSwitch = panelDiv.querySelector('.lang-switch');

        // 语言切换事件
        langSwitch.addEventListener('change', () => {
            currentLang = langSwitch.value;
            localStorage.setItem('x-draw-helper-lang', currentLang);
            UITranslator.updateAll();
        });

        // 关闭按钮事件
        closeButton.addEventListener('click', () => {
            panelDiv.remove();
        });

        // 导出按钮事件
        exportButton.addEventListener('click', () => {
            exportData(interactionData);
        });

        // 标签页切换事件
        tabs.forEach(tab => {
            if (tab.dataset.tab === 'retweets' || tab.dataset.tab === 'likes' || tab.dataset.tab === 'draw') {
                tab.addEventListener('click', () => {
                    // 更新标签页样式
                    tabs.forEach(t => {
                        t.style.color = '#71767B';
                        t.style.borderBottom = '2px solid transparent';
                        // 更新数字颜色
                        const countSpan = t.querySelector('span:last-child');
                        if (countSpan) {
                            countSpan.style.color = '#71767B';
                        }
                    });
                    tab.style.color = 'white';
                    tab.style.borderBottom = '2px solid #1D9BF0';
                    // 更新当前标签的数字颜色
                    const countSpan = tab.querySelector('span:last-child');
                    if (countSpan) {
                        countSpan.style.color = '#1D9BF0';
                    }

                    // 更新内容
                    if (tab.dataset.tab === 'draw') {
                        content.innerHTML = renderDrawPanel(interactionData);
                        // 更新全局数据中的符合条件用户列表
                        globalData.updateQualifiedUsers();
                        initDrawPanel(content);
                    } else {
                        content.innerHTML = renderUserList(interactionData[tab.dataset.tab]);
                        UITranslator.translateContainer(content);
                    }
                });
            }
        });

        // 添加按钮悬停效果
        exportButton.addEventListener('mouseover', () => {
            exportButton.style.backgroundColor = '#1A8CD8';
        });
        exportButton.addEventListener('mouseout', () => {
            exportButton.style.backgroundColor = '#1D9BF0';
        });

        // 添加数据计数
        if (content) {
            content.dataset.retweetCount = interactionData.retweets.length;
            content.dataset.likeCount = interactionData.likes.length;
        }
    }

    // 渲染用户列表
    function renderUserList(users) {
        if (!users || users.length === 0) {
            const noUsersDiv = document.createElement('div');
            noUsersDiv.style.cssText = 'text-align: center; color: #71767B;';
            noUsersDiv.dataset.translationKey = 'noUsers';
            return noUsersDiv.outerHTML;
        }

        return users.map(user => `
            <div style="
                padding: 12px;
                border: 1px solid #38444D;
                border-radius: 12px;
                margin-bottom: 12px;
                display: flex;
                gap: 12px;
                align-items: start;
            ">
                <img src="${user.avatarUrl}" alt="${user.username}" style="
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                ">
                <div style="flex: 1;">
                    <div style="
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        gap: 8px;
                    ">
                        <div>
                            <div style="font-weight: bold; margin-bottom: 2px;">${user.username}</div>
                            <div style="color: #71767B; font-size: 14px;">@${user.handle}</div>
                        </div>
                        <div style="display: flex; gap: 4px;">
                            ${user.following ?
                `<span data-translation-key="following" style="color: #1D9BF0; font-size: 12px; border: 1px solid #1D9BF0; padding: 2px 6px; border-radius: 12px;"></span>` : ''}
                            ${user.followed_by ?
                `<span data-translation-key="followingYou" style="color: #00BA7C; font-size: 12px; border: 1px solid #00BA7C; padding: 2px 6px; border-radius: 12px;"></span>` : ''}
                        </div>
                    </div>
                    ${user.bio ? `<div style="color: #E7E9EA; font-size: 14px; margin-top: 4px;">${user.bio}</div>` : ''}
                </div>
            </div>
        `).join('');
    }

    // 导出数据为CSV
    function exportData(data) {
        // 创建CSV内容
        const rows = [[
            t('interactionType'),
            t('username'),
            t('handle'),
            t('avatarUrl'),
            t('bio'),
            t('following'),
            t('followingYou')
        ]];

        // 添加转发用户
        data.retweets.forEach(user => {
            rows.push([
                t('retweetType'),
                user.username,
                user.handle,
                user.avatarUrl,
                user.bio,
                user.following ? t('yes') : t('no'),
                user.followed_by ? t('yes') : t('no')
            ]);
        });

        // 添加点赞用户
        data.likes.forEach(user => {
            rows.push([
                t('likeType'),
                user.username,
                user.handle,
                user.avatarUrl,
                user.bio,
                user.following ? t('yes') : t('no'),
                user.followed_by ? t('yes') : t('no')
            ]);
        });

        // 生成CSV内容
        const csvContent = '\uFEFF' + rows.map(row =>
            row.map(cell =>
                typeof cell === 'string' ?
                    `"${cell.replace(/"/g, '""')}"` :
                    cell
            ).join(',')
        ).join('\n');

        // 下载文件
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const now = new Date();
        const timestamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
        link.download = `x_draw_data_${timestamp}.csv`;
        link.click();
    }

    // UI翻译管理器
    const UITranslator = {
        // 注册需要翻译的元素
        register(element, key, params = {}) {
            element.dataset.translationKey = key;
            if (Object.keys(params).length > 0) {
                element.dataset.translationParams = JSON.stringify(params);
            }
            this.translate(element);
        },

        // 翻译单个元素
        translate(element) {
            const key = element.dataset.translationKey;
            const params = element.dataset.translationParams ? JSON.parse(element.dataset.translationParams) : {};
            if (key) {
                if (element.tagName === 'INPUT' && element.type === 'button') {
                    element.value = t(key, params);
                } else {
                    element.textContent = t(key, params);
                }
            }
        },

        // 翻译容器内的所有元素
        translateContainer(container) {
            const elements = container.querySelectorAll('[data-translation-key]');
            elements.forEach(element => this.translate(element));
        },

        // 更新所有已注册元素的翻译
        updateAll() {
            this.translateContainer(document);
        }
    };

    // 渲染抽签面板
    function renderDrawPanel(data) {
        // 获取所有用户作为初始结果（去重）
        const allUsers = new Map();
        // 先处理转发用户
        data.retweets.forEach(user => {
            allUsers.set(user.handle, { ...user, hasRetweet: true });
        });
        // 再处理点赞用户，如果已存在则更新状态
        data.likes.forEach(user => {
            if (allUsers.has(user.handle)) {
                const existingUser = allUsers.get(user.handle);
                allUsers.set(user.handle, { ...existingUser, hasLike: true });
            } else {
                allUsers.set(user.handle, { ...user, hasLike: true });
            }
        });
        const initialUsers = Array.from(allUsers.values());

        return `
            <div style="padding: 16px;">
                <div style="
                    border: 1px solid #38444D;
                    border-radius: 12px;
                    padding: 16px;
                    margin-bottom: 16px;
                ">
                    <h4 data-translation-key="filters" style="margin: 0 0 12px 0; color: white;"></h4>
                    <div style="
                        display: flex;
                        flex-wrap: wrap;
                        gap: 8px;
                    ">
                        <button class="draw-filter" data-filter="followed_by" data-translation-key="followingMe" style="
                            font-size: 13px;
                            color: #E7E9EA;
                            background: #273340;
                            padding: 6px 12px;
                            border-radius: 16px;
                            border: 1px solid #38444D;
                            cursor: pointer;
                            transition: all 0.2s ease;
                            user-select: none;
                        "></button>
                        <button class="draw-filter" data-filter="retweet" data-translation-key="hasRetweeted" style="
                            font-size: 13px;
                            color: #E7E9EA;
                            background: #273340;
                            padding: 6px 12px;
                            border-radius: 16px;
                            border: 1px solid #38444D;
                            cursor: pointer;
                            transition: all 0.2s ease;
                            user-select: none;
                        "></button>
                        <button class="draw-filter" data-filter="like" data-translation-key="hasLiked" style="
                            font-size: 13px;
                            color: #E7E9EA;
                            background: #273340;
                            padding: 6px 12px;
                            border-radius: 16px;
                            border: 1px solid #38444D;
                            cursor: pointer;
                            transition: all 0.2s ease;
                            user-select: none;
                        "></button>
                    </div>
                </div>

                <div style="
                    border: 1px solid #38444D;
                    border-radius: 12px;
                    padding: 16px;
                    margin-bottom: 16px;
                ">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <h4 data-translation-key="qualifiedUsers" style="margin: 0; color: white;"></h4>
                        <div style="color: #1D9BF0; display: flex; align-items: center; gap: 4px;">
                            <span class="qualified-count"></span>
                            <span data-translation-key="people"></span>
                        </div>
                    </div>
                    <div class="qualified-users" style="
                        max-height: 200px;
                        overflow-y: auto;
                        color: #E7E9EA;
                        font-size: 14px;
                        padding-right: 8px;
                    ">
                    </div>
                </div>

                <div style="
                    display: flex;
                    gap: 12px;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <input type="number" class="draw-count" value="${globalData.drawCount}" min="1" style="
                            width: 60px;
                            padding: 8px;
                            border: 1px solid #38444D;
                            border-radius: 8px;
                            background: #273340;
                            color: white;
                            outline: none;
                        ">
                        <span data-translation-key="people" style="color: #E7E9EA;"></span>
                    </div>
                    <button class="draw-button" data-translation-key="startDraw" style="
                        padding: 8px 16px;
                        background: #1D9BF0;
                        color: white;
                        border: none;
                        border-radius: 20px;
                        cursor: pointer;
                        font-weight: bold;
                        transition: background-color 0.2s;
                    "></button>
                </div>
            </div>
        `;
    }

    // 更新所有UI文本
    function updateUIText() {
        UITranslator.updateAll();
    }

    // 添加抽签面板的事件监听
    function initDrawPanel(content) {
        // 筛选条件变化事件
        const filterButtons = content.querySelectorAll('.draw-filter');
        const qualifiedUsersDiv = content.querySelector('.qualified-users');
        const qualifiedCountSpan = content.querySelector('.qualified-count');

        filterButtons.forEach(button => {
            // 移除旧的事件监听器
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);

            // 根据当前状态设置按钮样式
            const filter = newButton.dataset.filter;
            if (globalData.filters[filter]) {
                newButton.style.background = '#1D9BF0';
                newButton.style.borderColor = '#1D9BF0';
                newButton.style.color = 'white';
            } else {
                newButton.style.background = '#273340';
                newButton.style.borderColor = '#38444D';
                newButton.style.color = '#E7E9EA';
            }

            newButton.addEventListener('click', () => {
                const filter = newButton.dataset.filter;
                globalData.toggleFilter(filter);

                // 更新按钮样式
                if (globalData.filters[filter]) {
                    newButton.style.background = '#1D9BF0';
                    newButton.style.borderColor = '#1D9BF0';
                    newButton.style.color = 'white';
                } else {
                    newButton.style.background = '#273340';
                    newButton.style.borderColor = '#38444D';
                    newButton.style.color = '#E7E9EA';
                }

                // 更新UI显示
                updateQualifiedUsersList(content);
            });

            // 添加悬停效果
            newButton.addEventListener('mouseover', () => {
                if (!globalData.filters[newButton.dataset.filter]) {
                    newButton.style.background = '#3A444C';
                }
            });
            newButton.addEventListener('mouseout', () => {
                if (!globalData.filters[newButton.dataset.filter]) {
                    newButton.style.background = '#273340';
                }
            });
        });

        // 抽奖按钮点击事件
        const drawButton = content.querySelector('.draw-button');
        const drawCountInput = content.querySelector('.draw-count');

        // 移除旧的事件监听器
        const newDrawButton = drawButton.cloneNode(true);
        drawButton.parentNode.replaceChild(newDrawButton, drawButton);

        newDrawButton.addEventListener('click', () => {
            const result = globalData.performDraw();
            if (!result.success) {
                const messageDiv = document.createElement('div');
                if (result.message === 'noQualifiedUsers') {
                    UITranslator.register(messageDiv, 'noQualifiedUsers');
                } else if (result.message === 'notEnoughUsers') {
                    UITranslator.register(messageDiv, 'notEnoughUsers', { count: result.count });
                }
                alert(messageDiv.textContent);
                return;
            }
            handleDrawResult(result.winners);
        });

        // 数字输入框限制
        const newDrawCountInput = drawCountInput.cloneNode(true);
        drawCountInput.parentNode.replaceChild(newDrawCountInput, drawCountInput);

        newDrawCountInput.value = globalData.drawCount;
        newDrawCountInput.addEventListener('input', () => {
            const value = parseInt(newDrawCountInput.value);
            if (isNaN(value) || value < 1) {
                newDrawCountInput.value = 1;
                globalData.setDrawCount(1);
            } else {
                globalData.setDrawCount(value);
            }
        });

        // 更新UI显示
        updateQualifiedUsersList(content);
        UITranslator.translateContainer(content);
    }

    // 处理抽奖结果显示
    function handleDrawResult(winners) {
        // 关闭已存在的结果页面
        const existingResult = document.querySelector('.draw-result-popup');
        if (existingResult) {
            existingResult.remove();
        }

        // 创建结果弹窗
        const resultDiv = document.createElement('div');
        resultDiv.className = 'draw-result-popup';
        resultDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #15202B;
            border-radius: 16px;
            box-shadow: 0 0 10px rgba(0,0,0,0.5);
            z-index: 10001;
            border: 1px solid #38444D;
            width: 400px;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
        `;

        // 标题区域
        const titleDiv = document.createElement('div');
        titleDiv.style.cssText = `
            padding: 20px;
            border-bottom: 1px solid #38444D;
            text-align: center;
        `;
        titleDiv.innerHTML = `
            <h4 data-translation-key="drawResult" style="color: #1D9BF0; margin: 0 0 8px 0;">🎉 <span></span> 🎉</h4>
            <div data-translation-key="congratulations" style="color: #E7E9EA;"></div>
        `;
        resultDiv.appendChild(titleDiv);

        // 结果区域（可滚动）
        const contentDiv = document.createElement('div');
        contentDiv.style.cssText = `
            padding: 20px;
            overflow-y: auto;
            max-height: calc(80vh - 160px);
        `;
        contentDiv.innerHTML = renderUserList(winners);
        resultDiv.appendChild(contentDiv);

        // 底部按钮区域
        const buttonDiv = document.createElement('div');
        buttonDiv.style.cssText = `
            padding: 16px;
            border-top: 1px solid #38444D;
            text-align: center;
        `;
        const closeButton = document.createElement('button');
        closeButton.dataset.translationKey = 'close';
        closeButton.style.cssText = `
            padding: 8px 24px;
            background: #1D9BF0;
            color: white;
            border: none;
            border-radius: 20px;
            cursor: pointer;
            font-weight: bold;
            transition: background-color 0.2s;
        `;
        closeButton.addEventListener('mouseover', () => {
            closeButton.style.backgroundColor = '#1A8CD8';
        });
        closeButton.addEventListener('mouseout', () => {
            closeButton.style.backgroundColor = '#1D9BF0';
        });
        closeButton.addEventListener('click', () => resultDiv.remove());
        buttonDiv.appendChild(closeButton);
        resultDiv.appendChild(buttonDiv);

        document.body.appendChild(resultDiv);
        UITranslator.translateContainer(resultDiv);
    }

    // 更新合格用户列表显示
    function updateQualifiedUsersList(container) {
        const qualifiedUsersDiv = container.querySelector('.qualified-users');
        const qualifiedCountSpan = container.querySelector('.qualified-count');

        if (qualifiedUsersDiv) {
            if (globalData.qualifiedUsers.length > 0) {
                qualifiedUsersDiv.innerHTML = globalData.qualifiedUsers.map(user =>
                    `<div style="margin-bottom: 4px;">@${user.handle}</div>`
                ).join('');
            } else {
                const noUsersDiv = document.createElement('div');
                noUsersDiv.style.cssText = 'text-align: center; color: #71767B;';
                noUsersDiv.dataset.translationKey = 'noUsers';
                qualifiedUsersDiv.innerHTML = '';
                qualifiedUsersDiv.appendChild(noUsersDiv);
                UITranslator.translate(noUsersDiv);
            }
        }

        if (qualifiedCountSpan) {
            qualifiedCountSpan.textContent = globalData.qualifiedUsers.length;
        }
    }

    // 初始化
    function init() {
        createDrawButton();
        updateButtonVisibility();

        // 监听URL变化
        const observer = new MutationObserver((mutations) => {
            if (window.location.href !== lastUrl) {
                lastUrl = window.location.href;
                updateButtonVisibility();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // 记录上一次的URL
    let lastUrl = window.location.href;

    // 页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(); 