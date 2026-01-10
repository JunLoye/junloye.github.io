/**
 * 开启 Q&A 弹窗
 * @param {boolean} pushState 是否推送历史记录
 */
function openQA(pushState = true) {
    const overlay = document.getElementById('qa-overlay');
    const content = document.getElementById('qa-content');
    if (!content) return; // 确保模板已加载

    if (pushState) history.pushState({ page: 'qa' }, "Q&A | Jun Loye", "#qa");
    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden'; // 禁止背景滚动
    setTimeout(() => content.classList.add('show'), 50); // 触发 CSS 过渡动画
}

/**
 * 点击关闭按钮的逻辑
 */
function closeQA() {
    if (window.location.hash === '#qa') history.back();
    else realCloseQA();
}

/**
 * 真正执行关闭动画和隐藏
 */
function realCloseQA() {
    const overlay = document.getElementById('qa-overlay');
    const content = document.getElementById('qa-content');
    if (!content || !content.classList.contains('show')) return;
    
    content.classList.remove('show');
    setTimeout(() => {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
    }, 300); // 等待过渡动画结束
}