/**
 * 初始化发布表单
 */
function initPublishForm() {
    const form = document.getElementById('publish-form');
    const bodyInput = document.getElementById('publish-body');
    const previewArea = document.getElementById('md-preview');

    if (!form) return;

    if (bodyInput && previewArea) {
        bodyInput.oninput = () => {
            if (typeof marked !== 'undefined') {
                previewArea.innerHTML = marked.parse(bodyInput.value || '预览区域...');
            }
        };
    }

    form.onsubmit = publishNewPost;
    syncPublishButtonState();
}

/**
 * 同步按钮状态
 */
function syncPublishButtonState() {
    const token = getCookie('github_token');
    const submitBtn = document.getElementById('submit-btn');
    if (!submitBtn) return;

    if (token) {
        submitBtn.disabled = false;
        submitBtn.innerText = 'PUBLISH NOW';
        submitBtn.style.background = '#333';
        submitBtn.style.cursor = 'pointer';
    } else {
        submitBtn.disabled = true;
        submitBtn.innerText = '请先登录';
        submitBtn.style.background = '#ccc';
        submitBtn.style.cursor = 'not-allowed';
    }
}

/**
 * 上传图片
 */
async function uploadCoverToGithub(file, token) {
    const timestamp = Date.now();
    const ext = file.name.split('.').pop().toLowerCase();
    const imgPath = `images/blog_${timestamp}/cover.${ext}`;
    const apiUrl = `https://api.github.com/repos/${CONFIG.username}/${CONFIG.repo}/contents/${imgPath}`;

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
            const base64 = reader.result.split(',')[1];
            try {
                const res = await fetch(apiUrl, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ message: `Upload: ${imgPath}`, content: base64 })
                });
                if (!res.ok) throw new Error('图片上传失败');
                resolve(`https://github.com/${CONFIG.username}/${CONFIG.repo}/blob/main/${imgPath}?raw=true`);
            } catch (e) { reject(e); }
        };
        reader.readAsDataURL(file);
    });
}

/**
 * 核心发布逻辑 - 已补全 References
 */
async function publishNewPost(e) {
    if (e) e.preventDefault();
    
    const token = getCookie('github_token');
    const titleVal = document.getElementById('publish-title').value.trim();
    const bodyVal = document.getElementById('publish-body').value.trim();
    const labelsVal = document.getElementById('publish-labels').value.split(',').map(l => l.trim()).filter(Boolean);
    const summaryVal = document.getElementById('publish-summary').value.trim();
    const referenceVal = document.getElementById('publish-reference').value.trim(); // [补全] 获取引用内容
    let coverUrl = document.getElementById('publish-cover').value.trim();
    const coverFile = document.getElementById('publish-cover-upload').files[0];
    const progressEl = document.getElementById('publish-progress');

    if (!token || !titleVal || !bodyVal) {
        showNotification('请检查登录状态及必填项', 'warning');
        return;
    }

    try {
        if (progressEl) {
            progressEl.style.display = 'block';
            progressEl.textContent = '正在处理...';
        }

        if (coverFile) {
            coverUrl = await uploadCoverToGithub(coverFile, token);
        }

        // 构造 Issue 正文
        let issueBody = "";
        if (coverUrl) issueBody += `[Cover] ${coverUrl}\n\n`;
        if (summaryVal) issueBody += `[Summary]\n${summaryVal}\n\n`;
        
        // [补全] 拼接引用板块
        if (referenceVal) issueBody += `[References]\n${referenceVal}\n\n`;

        issueBody += `[Content]\n${bodyVal}`;

        const res = await fetch(`https://api.github.com/repos/${CONFIG.username}/${CONFIG.repo}/issues`, {
            method: 'POST',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title: titleVal, body: issueBody, labels: labelsVal })
        });

        if (!res.ok) throw new Error('GitHub 发布失败');
        
        showNotification('发布成功！', 'info');
        e.target.reset();
        
        // [补全] 手动清除预览区域
        const previewArea = document.getElementById('md-preview');
        if (previewArea) previewArea.innerHTML = '';

        closePublishModal();
        if (typeof fetchPosts === 'function') setTimeout(fetchPosts, 2000);

    } catch (err) {
        showNotification(err.message, 'error');
    } finally {
        if (progressEl) progressEl.style.display = 'none';
    }
}

function openPublishModal() {
    const modal = document.getElementById('publish-modal');
    const content = document.getElementById('publish-modal-content');
    if (!modal || !content) return;
    modal.style.display = 'block';
    setTimeout(() => content.classList.add('show'), 50);
    syncPublishButtonState();
}

function closePublishModal() {
    const modal = document.getElementById('publish-modal');
    const content = document.getElementById('publish-modal-content');
    if (!content) return;
    content.classList.remove('show');
    setTimeout(() => { modal.style.display = 'none'; }, 300);
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}