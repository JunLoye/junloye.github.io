function openAbout(pushState = true) {
    const overlay = document.getElementById('about-overlay');
    const content = document.getElementById('about-content');
    if (!content) return; // 防护：如果组件还没加载

    if (pushState) history.pushState({ page: 'about' }, "About | Jun Loye", "#about");
    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
    setTimeout(() => content.classList.add('show'), 50);
}

function closeAbout() {
    if (window.location.hash === '#about') history.back();
    else realCloseAbout();
}

function realCloseAbout() {
    const overlay = document.getElementById('about-overlay');
    const content = document.getElementById('about-content');
    if (!content || !content.classList.contains('show')) return;
    content.classList.remove('show');
    setTimeout(() => {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
    }, 300);
}