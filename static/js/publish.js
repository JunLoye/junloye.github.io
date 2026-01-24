/**
 * 初始化发布表单与事件监听
 */
function initPublishForm() {
    const form = document.getElementById('publish-form');
    const bodyInput = document.getElementById('publish-body');
    const previewArea = document.getElementById('md-preview');
    const coverUpload = document.getElementById('publish-cover-upload');

    if (!form) return;

    // 1. 实时预览
    if (bodyInput && previewArea) {
        bodyInput.oninput = () => {
            if (typeof marked !== 'undefined') {
                previewArea.innerHTML = marked.parse(bodyInput.value || '预览区域...');
            }
            saveDraft();
        };

        // 2. 粘贴图片自动上传功能
        bodyInput.onpaste = async (e) => {
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            for (const item of items) {
                if (item.type.indexOf("image") !== -1) {
                    const file = item.getAsFile();
                    const token = getCookie('github_token');
                    if (!token) {
                        showNotification('请先登录以支持图片上传', 'warning');
                        return;
                    }
                    
                    const statusEl = document.getElementById('publish-status');
                    statusEl.innerText = '正在上传粘贴的图片...';
                    
                    try {
                        const imgUrl = await uploadCoverToGithub(file, token);
                        const pos = bodyInput.selectionStart;
                        const text = bodyInput.value;
                        const imgMd = `\n![Image](${imgUrl})\n`;
                        bodyInput.value = text.substring(0, pos) + imgMd + text.substring(bodyInput.selectionEnd);
                        if (typeof marked !== 'undefined') {
                            previewArea.innerHTML = marked.parse(bodyInput.value);
                        }
                        statusEl.innerText = '图片上传成功';
                    } catch (err) {
                        statusEl.innerText = '图片上传失败';
                        showNotification(err.message, 'error');
                    }
                }
            }
        };
    }

    // 3. 封面文件选择预览
    if (coverUpload) {
        coverUpload.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const preview = document.getElementById('publish-cover-preview');
                    preview.src = ev.target.result;
                    preview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        };
    }

    loadDraft();
    form.onsubmit = publishNewPost;
    syncPublishButtonState();
}

/**
 * 草稿持久化
 */
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
        const draft = JSON.parse(saved);
        document.getElementById('publish-title').value = draft.title || '';
        document.getElementById('publish-body').value = draft.body || '';
        document.getElementById('publish-labels').value = draft.labels || '';
        document.getElementById('publish-summary').value = draft.summary || '';
        // 触发预览更新
        const bodyInput = document.getElementById('publish-body');
        if (bodyInput) bodyInput.dispatchEvent(new Event('input'));
    }
}

/**
 * 同步发布按钮状态（严谨判断）
 */
function syncPublishButtonState() {
    const token = getCookie('github_token');
    const submitBtn = document.getElementById('submit-btn');
    if (!submitBtn) return;

    if (token && token !== 'undefined') {
        submitBtn.disabled = false;
        submitBtn.innerText = 'PUBLISH NOW';
        submitBtn.style.background = 'var(--accent)';
        submitBtn.style.cursor = 'pointer';
    } else {
        submitBtn.disabled = true;
        submitBtn.innerText = '请先登录';
        submitBtn.style.background = 'var(--line)';
        submitBtn.style.cursor = 'not-allowed';
    }
}

/**
 * 上传图片核心函数
 */
async function uploadCoverToGithub(file, token) {
    const timestamp = Date.now();
    const ext = file.name ? file.name.split('.').pop().toLowerCase() : 'png';
    const fileName = `img_${timestamp}.${ext}`;
    const imgPath = `images/blog_${timestamp}/${fileName}`;
    const targetRepo = "JunLoye/blog_files";
    const apiUrl = `https://api.github.com/repos/${targetRepo}/contents/${imgPath}`;

    const reader = new FileReader();
    const base64Content = await new Promise((resolve) => {
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(file);
    });

    const res = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            message: `Upload asset: ${imgPath}`, 
            content: base64Content,
            branch: "main" 
        })
    });
    
    if (!res.ok) throw new Error('GitHub 上传失败');
    return `https://blog-images.loyejun.workers.dev/${imgPath}`;
}

/**
 * 核心发布逻辑
 */
async function publishNewPost(e) {
    if (e) e.preventDefault();
    
    const token = getCookie('github_token');
    const titleVal = document.getElementById('publish-title').value.trim();
    const bodyVal = document.getElementById('publish-body').value.trim();
    const labelsVal = document.getElementById('publish-labels').value.split(',').map(l => l.trim()).filter(Boolean);
    const summaryVal = document.getElementById('publish-summary').value.trim();
    const referenceVal = document.getElementById('publish-reference').value.trim(); 
    let coverUrl = document.getElementById('publish-cover').value.trim();
    const coverFile = document.getElementById('publish-cover-upload').files[0];
    const progressEl = document.getElementById('publish-progress');
    const submitBtn = document.getElementById('submit-btn');

    if (!token || !titleVal || !bodyVal) {
        showNotification('请检查内容完整性', 'warning');
        return;
    }

    try {
        submitBtn.disabled = true;
        submitBtn.innerText = '正在提交...';
        if (progressEl) {
            progressEl.style.display = 'block';
            progressEl.textContent = '🚀 正在上传并同步至 GitHub...';
        }

        if (coverFile) {
            coverUrl = await uploadCoverToGithub(coverFile, token);
        }

        let issueBody = "";
        if (coverUrl) issueBody += `[Cover] ${coverUrl}\n\n`;
        if (summaryVal) issueBody += `[Summary]\n${summaryVal}\n\n`;
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

        if (!res.ok) throw new Error('GitHub API 调用失败');
        
        showNotification('发布成功！', 'info');
        localStorage.removeItem('gh_post_draft'); // 成功后清除草稿
        
        closePublishModal();
        if (typeof fetchPosts === 'function') setTimeout(fetchPosts, 1500);

    } catch (err) {
        showNotification(err.message, 'error');
        submitBtn.disabled = false;
        submitBtn.innerText = '重试发布';
    } finally {
        if (progressEl) progressEl.style.display = 'none';
    }
}

/**
 * 弹窗开启逻辑修复
 */
function openPublishModal() {
    const modal = document.getElementById('publish-modal');
    const content = document.getElementById('publish-modal-content');
    if (!modal || !content) return;
    
    modal.style.display = 'block';
    // 强制重绘后再添加 class 以触发动画
    content.getBoundingClientRect();
    content.classList.add('show');
    
    initPublishForm();
}

function closePublishModal() {
    const modal = document.getElementById('publish-modal');
    const content = document.getElementById('publish-modal-content');
    if (!content || !modal) return;
    
    content.classList.remove('show');
    setTimeout(() => { 
        modal.style.display = 'none'; 
    }, 300);
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}