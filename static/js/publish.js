/**
 * 初始化发布表单
 */
function initPublishForm() {
    const form = document.getElementById('publish-form');
    const bodyInput = document.getElementById('publish-body');
    const previewArea = document.getElementById('md-preview');
    const coverUpload = document.getElementById('publish-cover-upload');

    if (!form) return;

    if (bodyInput && previewArea) {
        bodyInput.oninput = () => {
            if (typeof marked !== 'undefined') {
                previewArea.innerHTML = marked.parse(bodyInput.value || '预览区域...');
            }
            saveDraft();
        };

        bodyInput.onpaste = async (e) => {
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            for (const item of items) {
                if (item.type.indexOf("image") !== -1) {
                    const file = item.getAsFile();
                    const token = getCookie('github_token');
                    if (!token) { showNotification('请登录后粘贴图片', 'warning'); return; }
                    const statusEl = document.getElementById('publish-status');
                    if (statusEl) statusEl.innerText = '正在上传图片...';
                    try {
                        const imgUrl = await uploadCoverToGithub(file, token);
                        const pos = bodyInput.selectionStart;
                        const text = bodyInput.value;
                        const imgMd = `\n![Image](${imgUrl})\n`;
                        bodyInput.value = text.substring(0, pos) + imgMd + text.substring(bodyInput.selectionEnd);
                        if (typeof marked !== 'undefined') previewArea.innerHTML = marked.parse(bodyInput.value);
                        if (statusEl) statusEl.innerText = '图片已就绪';
                        saveDraft();
                    } catch (err) {
                        showNotification('图片上传失败: ' + err.message, 'error');
                        if (statusEl) statusEl.innerText = '图片上传失败';
                    }
                }
            }
        };
    }

    if (coverUpload) {
        coverUpload.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const imgPreview = document.getElementById('publish-cover-preview');
                    if (imgPreview) { imgPreview.src = ev.target.result; imgPreview.style.display = 'block'; }
                };
                reader.readAsDataURL(file);
            }
        };
    }

    loadDraft();
    form.onsubmit = publishNewPost;
    syncPublishButtonState();
}

function saveDraft() {
    const draft = {
        title: document.getElementById('publish-title').value,
        body: document.getElementById('publish-body').value,
        labels: document.getElementById('publish-labels').value,
        summary: document.getElementById('publish-summary').value
    };
    localStorage.setItem('gh_post_draft', JSON.stringify(draft));
}

function loadDraft() {
    const saved = localStorage.getItem('gh_post_draft');
    if (saved) {
        const data = JSON.parse(saved);
        document.getElementById('publish-title').value = data.title || '';
        document.getElementById('publish-body').value = data.body || '';
        document.getElementById('publish-labels').value = data.labels || '';
        document.getElementById('publish-summary').value = data.summary || '';
        const bodyInput = document.getElementById('publish-body');
        if (bodyInput) bodyInput.dispatchEvent(new Event('input'));
    }
}

function syncPublishButtonState() {
    const token = getCookie('github_token');
    const submitBtn = document.getElementById('submit-btn');
    if (!submitBtn) return;
    if (token && token !== 'undefined') {
        submitBtn.disabled = false;
        submitBtn.innerText = 'PUBLISH NOW';
        submitBtn.style.background = 'var(--accent)';
    } else {
        submitBtn.disabled = true;
        submitBtn.innerText = '请先登录';
        submitBtn.style.background = '#ccc';
    }
}

async function uploadCoverToGithub(file, token) {
    const timestamp = Date.now();
    const ext = file.name ? file.name.split('.').pop() : 'png';
    const fileName = `img_${timestamp}.${ext}`;
    const imgPath = `images/blog_${timestamp}/${fileName}`;
    
    // 直接上传到当前博客仓库
    const targetRepo = `${CONFIG.username}/${CONFIG.repo}`;
    const apiUrl = `https://api.github.com/repos/${targetRepo}/contents/${imgPath}`;

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
            const base64 = reader.result.split(',')[1];
            try {
                const res = await fetch(apiUrl, {
                    method: 'PUT',
                    headers: { 
                        'Authorization': `token ${token}`, 
                        'Content-Type': 'application/json',
                        'Accept': 'application/vnd.github.v3+json'
                    },
                    body: JSON.stringify({ 
                        message: `Upload blog image: ${fileName} [skip ci]`, 
                        content: base64, 
                        branch: CONFIG.branch || "main" 
                    })
                });
                
                if (!res.ok) {
                    const error = await res.json();
                    throw new Error(error.message || '上传失败');
                }
                
                // 【修复核心】直接返回 GitHub 的原始链接地址，不通过 CF 托管
                // 格式为: https://raw.githubusercontent.com/用户名/仓库名/分支名/路径
                const rawUrl = `https://raw.githubusercontent.com/${targetRepo}/${CONFIG.branch || "main"}/${imgPath}`;
                resolve(rawUrl);
            } catch (e) { 
                reject(e); 
            }
        };
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsDataURL(file);
    });
}

async function publishNewPost(e) {
    if (e) e.preventDefault();
    const token = getCookie('github_token');
    const titleVal = document.getElementById('publish-title').value.trim();
    const bodyVal = document.getElementById('publish-body').value.trim();
    const labelsVal = document.getElementById('publish-labels').value.split(',').map(l => l.trim()).filter(Boolean);
    const summaryVal = document.getElementById('publish-summary').value.trim();
    let coverUrl = document.getElementById('publish-cover').value.trim();
    const coverFile = document.getElementById('publish-cover-upload').files[0];
    const submitBtn = document.getElementById('submit-btn');

    if (!token || !titleVal || !bodyVal) { showNotification('请填写必填项', 'warning'); return; }

    try {
        submitBtn.disabled = true;
        submitBtn.innerText = '正在上传素材...';
        if (coverFile) coverUrl = await uploadCoverToGithub(coverFile, token);

        submitBtn.innerText = '正在提交文章...';
        let issueBody = "";
        if (coverUrl) issueBody += `[Cover] ${coverUrl}\n\n`;
        if (summaryVal) issueBody += `[Summary]\n${summaryVal}\n\n`;
        issueBody += `[Content]\n${bodyVal}`;

        const res = await fetch(`https://api.github.com/repos/${CONFIG.username}/${CONFIG.repo}/issues`, {
            method: 'POST',
            headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: titleVal, body: issueBody, labels: labelsVal })
        });
        if (!res.ok) throw new Error('Issue 创建失败');
        
        showNotification('发布成功！Actions 正在更新索引...', 'info');
        localStorage.removeItem('gh_post_draft');
        closePublishModal();
        setTimeout(() => location.reload(), 3000); 
    } catch (err) {
        showNotification(err.message, 'error');
        submitBtn.disabled = false;
        submitBtn.innerText = 'PUBLISH NOW';
    }
}

function openPublishModal() {
    const modal = document.getElementById('publish-modal');
    const content = document.getElementById('publish-modal-content');
    if (modal && content) { modal.style.display = 'block'; content.offsetHeight; content.classList.add('show'); initPublishForm(); }
}

function closePublishModal() {
    const modal = document.getElementById('publish-modal');
    const content = document.getElementById('publish-modal-content');
    if (content) content.classList.remove('show');
    setTimeout(() => { if (modal) modal.style.display = 'none'; }, 300);
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}