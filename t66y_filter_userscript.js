// ==UserScript==
// @name         T66y 技术交流区点赞过滤 & t66y cleaner
// @namespace    http://tampermonkey.net/
// @version      2024-02-17
// @description  过滤https://t66y.com/thread0806.php?fid=7页面符合条件的帖子；t66y屏蔽10秒
// @author       You
// @match        *://t66y.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @license      Apache License 2.0
// @run-at       document-start
// @downloadURL https://update.sleazyfork.org/scripts/487491/t66y%20cleaner.user.js
// @updateURL https://update.sleazyfork.org/scripts/487491/t66y%20cleaner.meta.js
// ==/UserScript==

(function() {
    'use strict';

    // 广告屏蔽功能（在脚本开始时就执行）
    function blockAds() {
        // 拦截全局广告函数
        const adFunctions = ['spinit', 'spinit2', 'r9aeadS', '_pop', 'popunder', 'ExoLoader', 'ExoVideoSlider', 'show_popup'];
        adFunctions.forEach(func => {
            if (func !== 'r9aeadS') {
                window[func] = function() { console.log(`已阻止广告函数 ${func}`); };
                Object.defineProperty(window, func, {
                    configurable: false,
                    writable: false
                });
            }
        });

        // 添加CSS规则屏蔽广告容器
        const style = document.createElement('style');
        style.textContent = `
            [id*="ad-"]:not(img), [class*="ad-"]:not(img), 
            [id*="ads-"]:not(img), [class*="ads-"]:not(img),
            [id*="banner"]:not(img), [class*="banner"]:not(img),
            iframe[src*="ads"], iframe[src*="banner"],
            #ad_thread, #ad_text, .adsbygoogle,
            [id^="aswift_"], [id^="google_ads_"],
            [src*="ads.exosrv.com"],
            [src*="redircdn.com"],
            [src*="exoclick.com"],
            [src*="juicyads.com"],
            [src*="popads.net"] { 
                display: none !important; 
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
            }
        `;
        document.head.appendChild(style);

        // 移除广告相关的script标签
        const adDomains = [
            'redircdn.com',
            'exosrv.com',
            'exoclick.com',
            'juicyads.com',
            'popads.net',
            'trafficjunky.com',
            'adnxs.com',
            'doubleclick.net'
        ];

        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.tagName === 'SCRIPT' || node.tagName === 'IFRAME') {
                        const src = node.src || '';
                        if (adDomains.some(domain => src.includes(domain))) {
                            node.remove();
                            console.log('已移除广告元素:', src);
                        }
                    }
                });
            });
        });

        // 监听 document，确保能捕获到动态添加的元素
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });

        // 阻止弹窗
        window.open = function() { console.log('已阻止弹窗'); };

        // 处理图片加载
        function loadImages() {
            const images = document.querySelectorAll('img[ess-data]');
            images.forEach(img => {
                const realSrc = img.getAttribute('ess-data');
                if (realSrc) {
                    img.src = realSrc;
                    img.style.cursor = 'pointer';
                    img.addEventListener('click', function(e) {
                        e.preventDefault();
                        window.open(realSrc);
                    });
                }
            });
        }

        // 重写r9aeadS函数，防止其影响正常内容显示
        window.r9aeadS = function() {
            console.log('已阻止广告检测');
            loadImages();
        };

        // 确保图片加载
        document.addEventListener('DOMContentLoaded', loadImages);
        setTimeout(loadImages, 1000); // 额外延迟加载一次，以防万一
    }

    // 立即执行广告屏蔽
    blockAds();

    // 默认配置
    const DEFAULT_CONFIG = {
        daysThreshold: 2,
        likeThreshold: 200,
        downloadThreshold: 500
    };

    // 配置项
    const config = {
        daysThreshold: GM_getValue('daysThreshold', DEFAULT_CONFIG.daysThreshold),
        likeThreshold: GM_getValue('likeThreshold', DEFAULT_CONFIG.likeThreshold),
        downloadThreshold: GM_getValue('downloadThreshold', DEFAULT_CONFIG.downloadThreshold)
    };

    // 需要应用下载次数过滤的页面
    const DOWNLOAD_FILTER_PAGES = ['fid=4', 'fid=25'];

    // 注册配置菜单
    GM_registerMenuCommand('设置过滤天数', () => {
        const days = prompt('请输入过滤天数（默认2天）:', config.daysThreshold);
        if (days !== null && !isNaN(days) && days >= 0) {
            GM_setValue('daysThreshold', parseInt(days, 10));
            location.reload();
        }
    });

    GM_registerMenuCommand('设置点赞阈值', () => {
        const likes = prompt('请输入最小点赞数（默认200）:', config.likeThreshold);
        if (likes !== null && !isNaN(likes) && likes >= 0) {
            GM_setValue('likeThreshold', parseInt(likes, 10));
            location.reload();
        }
    });

    GM_registerMenuCommand('设置下载次数阈值', () => {
        const downloads = prompt('请输入最小下载次数（默认500次）:', config.downloadThreshold);
        if (downloads !== null && !isNaN(downloads) && downloads >= 0) {
            GM_setValue('downloadThreshold', parseInt(downloads, 10));
            location.reload();
        }
    });

    // 重置所有配置
    GM_registerMenuCommand('重置所有配置', () => {
        if (confirm('确定要重置所有配置到默认值吗？')) {
            Object.keys(DEFAULT_CONFIG).forEach(key => {
                GM_setValue(key, DEFAULT_CONFIG[key]);
            });
            location.reload();
        }
    });

    // 计算时间阈值
    function getTimeThreshold() {
        const threshold = new Date();
        threshold.setDate(threshold.getDate() - config.daysThreshold);
        return threshold;
    }

    // 检查发帖时间是否在阈值内
    function isPostWithinThreshold(timeSpan) {
        try {
            if (!timeSpan) return false;
            const timestamp = timeSpan.getAttribute('data-timestamp')?.replace('s', '');
            if (!timestamp) return false;
            const postTime = new Date(parseInt(timestamp, 10) * 1000);
            return postTime > getTimeThreshold();
        } catch (e) {
            console.error('解析发帖时间出错:', e);
            return false;
        }
    }

    // 获取点赞数
    function getLikeCount(likeSpan) {
        try {
            if (!likeSpan) return 0;
            const count = parseInt(likeSpan.textContent.trim(), 10);
            return isNaN(count) ? 0 : count;
        } catch (e) {
            console.error('解析点赞数出错:', e);
            return 0;
        }
    }

    // 获取下载次数
    function getDownloadCount(row) {
        try {
            const tds = Array.from(row.querySelectorAll('td'));
            // 确保至少有两个td元素
            if (!tds || tds.length < 2) {
                console.warn('帖子行结构异常：td元素不足');
                return 0;
            }
            // 获取倒数第二个td元素（下载次数）
            const downloadTd = tds[tds.length - 2];
            if (!downloadTd) {
                console.warn('无法找到下载次数单元格');
                return 0;
            }
            const text = downloadTd.textContent.trim();
            const count = parseInt(text, 10);
            if (isNaN(count)) {
                console.warn(`下载次数格式异常: ${text}`);
                return 0;
            }
            return count;
        } catch (e) {
            console.error('解析下载次数出错:', e);
            return 0;
        }
    }

    // 检查是否需要应用下载次数过滤
    function shouldApplyDownloadFilter() {
        const currentUrl = window.location.search;
        return DOWNLOAD_FILTER_PAGES.some(page => currentUrl.includes(page));
    }

    // 处理单个帖子
    function processRow(row) {
        if (!row || !row.classList?.contains('tr3')) {
            console.warn('无效的帖子行元素');
            return;
        }

        const timeSpan = row.querySelector('td div.f12 span[data-timestamp]');
        const likeSpan = row.querySelector('span.s3');
        
        const isWithinThreshold = isPostWithinThreshold(timeSpan);
        const likeCount = getLikeCount(likeSpan);
        
        // 检查是否需要应用下载次数过滤
        if (shouldApplyDownloadFilter()) {
            const downloadCount = getDownloadCount(row);
            if (downloadCount < config.downloadThreshold) {
                row.style.display = 'none';
                return;
            }
        }

        // 应用原有的时间和点赞过滤
        if (!isWithinThreshold && likeCount < config.likeThreshold) {
            row.style.display = 'none';
        }
    }

    // 使用 MutationObserver 监听动态内容
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE && node.classList?.contains('tr3')) {
                    processRow(node);
                }
            });
        });
    });

    // 初始化处理
    function init() {
        try {
            const rows = document.querySelectorAll('tr.tr3.t_one.tac');
            if (!rows || rows.length === 0) {
                console.warn('未找到任何帖子行');
                return;
            }

            rows.forEach(processRow);

            // 监听动态内容
            const container = document.querySelector('tbody');
            if (container) {
                observer.observe(container, { childList: true, subtree: true });
            } else {
                console.warn('未找到tbody容器，动态内容监听未启用');
            }
        } catch (e) {
            console.error('初始化过程出错:', e);
        }
    }

    // 页面加载完成后初始化
    window.addEventListener('DOMContentLoaded', init);
})();