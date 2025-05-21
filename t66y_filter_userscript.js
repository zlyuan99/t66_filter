// ==UserScript==
// @name         T66y 技术交流区点赞过滤 & r9aeadS (Optimized)
// @namespace    http://tampermonkey.net/
// @version      2024-05-21
// @description  过滤https://t66y.com/thread0806.php?fid=7页面符合条件的帖子；t66y屏蔽10秒及r9aeadS优化
// @author       You & Gemini
// @match        *://t66y.com/*
// @match        *://*.t66y.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @grant        unsafeWindow
// @license      Apache License 2.0
// @run-at       document-start
// @downloadURL https://raw.githubusercontent.com/zlyuan99/t66_filter/main/t66y_filter_userscript.js // 请更新为你自己的链接
// @updateURL https://raw.githubusercontent.com/zlyuan99/t66_filter/main/t66y_filter_userscript.js // 请更新为你自己的链接
// ==/UserScript==

(function() {
    'use strict';

    // --- Start of Ad Blocking Logic ---
    function blockAds() {
        console.log('Tampermonkey: blockAds() initialized.');

        // 1. Neutralize specific ad-related functions early
        const adFunctionNames = ['spinit', 'spinit2', '_pop', 'popunder', 'ExoLoader', 'ExoVideoSlider', 'show_popup'];
        adFunctionNames.forEach(funcName => {
            // Check if function exists and hasn't been neutralized by this script before
            if (typeof window[funcName] !== 'function' || !window[funcName].isNeutralizedByT66yFilter) {
                window[funcName] = function() {
                    console.log(`Tampermonkey: Blocked ad function call: ${funcName}`);
                };
                window[funcName].isNeutralizedByT66yFilter = true; // Mark as neutralized
            }
        });

        // 2. Neutralize r9aeadS (critical for preventing the "去广告插件屏蔽" message)
        //    This runs at document-start, so it should define/override r9aeadS before page scripts try to use it.
        if (typeof unsafeWindow.r9aeadS_original_t66y === 'undefined') { // Backup original if not already done
            unsafeWindow.r9aeadS_original_t66y = window.r9aeadS;
        }
        window.r9aeadS = function() {
            console.log('Tampermonkey: window.r9aeadS call intercepted and neutralized.');
            // Attempt to restore content if it was already modified (fallback)
            const tpcContent = document.querySelector('.tpc_content:not(.tpc_content_backup)');
            const backupContent = document.querySelector('.tpc_content_backup');
            if (tpcContent && backupContent && tpcContent.innerHTML && tpcContent.innerHTML.includes('去广告插件屏蔽')) {
                if (backupContent.innerHTML) { // Ensure backup has content
                    console.log('Tampermonkey: Ad message found by neutralized r9aeadS; restoring from backup.');
                    tpcContent.innerHTML = backupContent.innerHTML;
                }
            }
        };
        window.r9aeadS.isNeutralizedByT66yFilter = true; // Mark as neutralized

        // 3. Add CSS rules to hide ad containers
        const adStyleID = 't66y-adblock-styles';
        if (!document.getElementById(adStyleID)) {
            const style = document.createElement('style');
            style.id = adStyleID;
            style.textContent = `
                [id*="ad-"]:not(img):not([id="adhtml"]), [class*="ad-"]:not(img),
                [id*="ads-"]:not(img):not([id="adshtml"]), [class*="ads-"]:not(img),
                [id*="banner"]:not(img), [class*="banner"]:not(img),
                iframe[src*="ads"], iframe[src*="banner"],
                #ad_thread, #ad_text, .adsbygoogle,
                [id^="aswift_"], [id^="google_ads_"],
                [src*="ads.exosrv.com"], [src*="redircdn.com"], [src*="exoclick.com"],
                [src*="juicyads.com"], [src*="popads.net"],
                .sptable_do_not_remove, /* Elements checked by r9aeadS */
                div.tips[style*="padding:0 10px"],
                div.tips script, /* Scripts inside tips */
                div[style*="margin-bottom:8px"] script /* Scripts like spinit2() container */ {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    width: 0 !important; /* Ensure dimensions are zero */
                    height: 0 !important;
                    overflow: hidden !important;
                    pointer-events: none !important;
                }
            `;
            // Append to head as early as possible
            if (document.head) {
                document.head.appendChild(style);
            } else {
                // Fallback if head is not ready (though @run-at document-start usually means it is)
                const Elem = document.documentElement || document.body;
                Elem.insertBefore(style, Elem.firstChild);
            }
        }

        // 4. Remove ad-related script and iframe tags via MutationObserver
        const adDomains = [
            'redircdn.com', 'exosrv.com', 'exoclick.com', 'juicyads.com', 'popads.net',
            'trafficjunky.com', 'adnxs.com', 'doubleclick.net'
        ];
        const adObserver = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE && (node.tagName === 'SCRIPT' || node.tagName === 'IFRAME')) {
                        const src = node.src || (node.getAttribute ? node.getAttribute('src') : '') || '';
                        if (adDomains.some(domain => src.includes(domain))) {
                            node.remove();
                            console.log('Tampermonkey: Removed ad element by MutationObserver:', src);
                        }
                    }
                });
            });
        });
        adObserver.observe(document.documentElement, { childList: true, subtree: true });

        // 5. Block window.open popups more safely
        const originalWindowOpen = window.open;
        window.open = function(url, name, features) {
            // Basic check for ad-like behavior or known ad URLs if needed
            // For now, just log and block.
            console.log(`Tampermonkey: window.open blocked. URL: ${url}`);
            return null; // Indicates blockage
        };
        window.open.isNeutralizedByT66yFilter = true;


        // 6. Content Backup and Restoration (as a robust fallback)
        function initializeContentBackup() {
            const tpcContent = document.querySelector('.tpc_content:not(.tpc_content_backup)');
            if (tpcContent) {
                let backupDiv = document.querySelector('.tpc_content_backup');
                if (!backupDiv) {
                    backupDiv = document.createElement('div');
                    backupDiv.className = 'tpc_content_backup';
                    backupDiv.style.display = 'none';
                    if (tpcContent.innerHTML && !tpcContent.innerHTML.includes('去广告插件屏蔽')) {
                        backupDiv.innerHTML = tpcContent.innerHTML;
                        tpcContent.parentNode.insertBefore(backupDiv, tpcContent.nextSibling);
                        console.log('Tampermonkey: .tpc_content initial content backed up.');
                    } else if (!tpcContent.innerHTML) {
                        tpcContent.parentNode.insertBefore(backupDiv, tpcContent.nextSibling);
                    }
                }

                const contentObserver = new MutationObserver(() => {
                    if (tpcContent.innerHTML && tpcContent.innerHTML.includes('去广告插件屏蔽')) {
                        const currentBackup = document.querySelector('.tpc_content_backup');
                        if (currentBackup && currentBackup.innerHTML) {
                            console.log('Tampermonkey: Ad message in .tpc_content (MutationObs); restoring.');
                            tpcContent.innerHTML = currentBackup.innerHTML;
                        }
                    }
                });
                contentObserver.observe(tpcContent, { childList: true, characterData: true, subtree: true });
            }
        }

        // 7. Image loading logic for 'ess-data'
        function loadEssDataImages() {
            const images = document.querySelectorAll('img[ess-data]');
            images.forEach(img => {
                const realSrc = img.getAttribute('ess-data');
                if (realSrc) {
                    img.src = realSrc;
                    img.style.cursor = 'pointer';
                    img.addEventListener('click', function(event) {
                        event.preventDefault();
                        event.stopPropagation(); // Crucial to stop other listeners like page's jQuery
                        const dataLink = img.getAttribute('data-link');
                        console.log(`Tampermonkey: img[ess-data] clicked. Opening: ${dataLink || realSrc}`);
                        window.open(dataLink || realSrc);
                    }, true); // Use capture phase
                    img.removeAttribute('ess-data'); // Prevent page's jQuery from processing it
                }
            });
        }

        // 8. Patch jQuery's css method (as a fallback if r9aeadS neutralization fails or runs before our override)
        function patchJQueryCssForAdDetection() {
            if (window.jQuery && window.jQuery.fn && window.jQuery.fn.jquery) {
                if (window.jQuery.fn.css.isPatchedByT66yFilter) return;

                const originalJQueryCss = window.jQuery.fn.css;
                window.jQuery.fn.css = function(propertyNameOrObject, value) {
                    if (typeof propertyNameOrObject === 'string' && arguments.length === 1) { // Only when getting CSS
                        const propName = propertyNameOrObject;
                        const selector = this.selector; // jQuery selector string
                        if ((selector === '.sptable_do_not_remove td' && propName === 'display') ||
                            (selector === '.tips' && propName === 'display') ||
                            (selector === '.tips' && propName === 'height') ||
                            (selector === '.tips' && propName === 'visibility')) {
                            // console.log(`Tampermonkey: jQuery.css patched for selector "${selector}", prop "${propName}". Returning safe value.`);
                            if (propName === 'display') return 'block'; // or any value that is not 'none'
                            if (propName === 'height') return 'auto';  // or any value not '0px' or '1px'
                            if (propName === 'visibility') return 'visible'; // or any value not 'hidden'
                        }
                    }
                    return originalJQueryCss.apply(this, arguments);
                };
                window.jQuery.fn.css.isPatchedByT66yFilter = true;
                console.log('Tampermonkey: jQuery.fn.css patched for ad detection.');
            } else {
                setTimeout(patchJQueryCssForAdDetection, 50); // Retry if jQuery not loaded
            }
        }

        // Execute post-DOM-load functions
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                patchJQueryCssForAdDetection();
                initializeContentBackup();
                loadEssDataImages();
            });
        } else { // DOM already loaded
            patchJQueryCssForAdDetection();
            initializeContentBackup();
            loadEssDataImages();
        }
        // Additional calls for dynamically added images or late loads
        setTimeout(loadEssDataImages, 1000);
        setTimeout(loadEssDataImages, 2500);

    } // --- End of Ad Blocking Logic ---

    blockAds(); // Execute ad blocking

    // 默认配置 (保持不变)
    const DEFAULT_CONFIG = {
        daysThreshold: 2,
        likeThreshold: 200,
        downloadThreshold: 500
    };

    // 配置项 (保持不变)
    const config = {
        daysThreshold: GM_getValue('daysThreshold', DEFAULT_CONFIG.daysThreshold),
        likeThreshold: GM_getValue('likeThreshold', DEFAULT_CONFIG.likeThreshold),
        downloadThreshold: GM_getValue('downloadThreshold', DEFAULT_CONFIG.downloadThreshold)
    };

    // 需要应用下载次数过滤的页面 (保持不变)
    const DOWNLOAD_FILTER_PAGES = ['fid=4', 'fid=25'];

    // 注册配置菜单 (保持不变)
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

    GM_registerMenuCommand('重置所有配置', () => {
        if (confirm('确定要重置所有配置到默认值吗？')) {
            Object.keys(DEFAULT_CONFIG).forEach(key => {
                GM_setValue(key, DEFAULT_CONFIG[key]);
            });
            location.reload();
        }
    });


    // 计算时间阈值 (保持不变)
    function getTimeThreshold() {
        const threshold = new Date();
        threshold.setDate(threshold.getDate() - config.daysThreshold);
        return threshold;
    }

    // 检查发帖时间是否在阈值内 (保持不变)
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

    // 获取点赞数 (保持不变)
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

    // 获取下载次数 (保持不变)
    function getDownloadCount(row) {
        try {
            const tds = Array.from(row.querySelectorAll('td'));
            if (!tds || tds.length < 2) {
                // console.warn('帖子行结构异常：td元素不足');
                return 0;
            }
            const downloadTd = tds[tds.length - 2];
            if (!downloadTd) {
                // console.warn('无法找到下载次数单元格');
                return 0;
            }
            const text = downloadTd.textContent.trim();
            const count = parseInt(text, 10);
            if (isNaN(count)) {
                // console.warn(`下载次数格式异常: ${text}`);
                return 0;
            }
            return count;
        } catch (e) {
            console.error('解析下载次数出错:', e);
            return 0;
        }
    }

    // 检查是否需要应用下载次数过滤 (保持不变)
    function shouldApplyDownloadFilter() {
        const currentUrl = window.location.search;
        return DOWNLOAD_FILTER_PAGES.some(page => currentUrl.includes(page));
    }

    // 处理单个帖子 (保持不变)
    function processRow(row) {
        if (!row || !row.classList?.contains('tr3')) {
            // console.warn('无效的帖子行元素');
            return;
        }

        const timeSpan = row.querySelector('td div.f12 span[data-timestamp]');
        const likeSpan = row.querySelector('span.s3');

        const isWithinThreshold = isPostWithinThreshold(timeSpan);
        const likeCount = getLikeCount(likeSpan);

        if (shouldApplyDownloadFilter()) {
            const downloadCount = getDownloadCount(row);
            if (downloadCount < config.downloadThreshold) {
                row.style.display = 'none';
                return;
            }
        }

        if (!isWithinThreshold && likeCount < config.likeThreshold) {
            row.style.display = 'none';
        }
    }

    // 使用 MutationObserver 监听动态内容 (帖子列表) (保持不变)
    const postListObserver = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE && node.classList?.contains('tr3')) {
                    processRow(node);
                } else if (node.nodeType === Node.ELEMENT_NODE && node.matches('tr.tr3.t_one.tac')) { // In case it's added directly with all classes
                    processRow(node);
                } else if (node.nodeType === Node.ELEMENT_NODE && node.querySelector) { // Check deeper if a container was added
                    const newRows = node.querySelectorAll('tr.tr3.t_one.tac');
                    newRows.forEach(processRow);
                }
            });
        });
    });

    // 初始化处理 (保持不变)
    function init() {
        try {
            const rows = document.querySelectorAll('tr.tr3.t_one.tac');
            rows.forEach(processRow);

            const container = document.querySelector('table.t_msg>tbody') || document.querySelector('form[name="FORM"] table>tbody') || document.querySelector('div#main') || document.body;
             // Adjusted selector for a more likely container, or fallback to body
            if (container) {
                postListObserver.observe(container, { childList: true, subtree: true });
            } else {
                // console.warn('未找到帖子容器，动态内容监听未启用');
            }
        } catch (e) {
            console.error('初始化过程出错:', e);
        }
    }

    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', init);
    } else {
        init(); // DOM already loaded
    }

})();