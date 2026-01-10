/**
 * 开启 Q&A 弹窗
 * @param {boolean} pushState 是否推送历史记录，默认开启
 */
function openQA(pushState = true) {
    const overlay = document.getElementById('qa-overlay');
    const content = document.getElementById('qa-content');
    if (!content) return; 

    // 处理路由
    if (pushState) {
        history.pushState({ page: 'qa' }, "Q&A | Jun Loye", "#qa");
    }
    
    // 显示容器
    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden'; // 锁定背景滚动
    
    // 异步触发动画效果
    setTimeout(() => {
        content.classList.add('show');
    }, 50);
}

/**
 * 触发关闭动作
 */
function closeQA() {
    // 如果当前 URL 带有 #qa，则执行回退操作
    if (window.location.hash === '#qa') {
        history.back();
    } else {
        realCloseQA();
    }
}

/**
 * 执行关闭动画及清理
 */
function realCloseQA() {
    const overlay = document.getElementById('qa-overlay');
    const content = document.getElementById('qa-content');
    if (!content || !content.classList.contains('show')) return;
    
    content.classList.remove('show');
    
    // 等待 300ms 动画完成后隐藏容器
    setTimeout(() => {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
    }, 300);
}