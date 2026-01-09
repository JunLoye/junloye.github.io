const publishForm = document.getElementById('publish-form');
const publishBody = document.getElementById('publish-body');
const mdPreview = document.getElementById('md-preview');

if (publishBody && mdPreview) {
    publishBody.oninput = () => {
        mdPreview.innerHTML = marked.parse(publishBody.value || '预览区域...');
    };
}

if (publishForm) {
    publishForm.onsubmit = publishNewPost;
}

async function uploadCoverToGithub(file, token) {
    if (!file || !token) throw new Error('缺少图片或登录已失效');
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
                    body: JSON.stringify({ message: `Upload cover: ${imgPath}`, content: base64 })
                });
                if (!res.ok) throw new Error('图片上传失败');
                resolve(`https://github.com/${CONFIG.username}/${CONFIG.repo}/blob/main/${imgPath}?raw=true`);
            } catch (e) { reject(e); }
        };
        reader.readAsDataURL(file);
    });
}

function openPublishModal() {
    const modal = document.getElementById('publish-modal');
    const content = document.getElementById('publish-modal-content');
    if (!modal || !content) return;
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    setTimeout(() => content.classList.add('show'), 50);
    updateAuthUI();
}

function closePublishModal() {
    const modal = document.getElementById('publish-modal');
    const content = document.getElementById('publish-modal-content');
    if (!content || !content.classList.contains('show')) return;
    content.classList.remove('show');
    setTimeout(() => {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }, 300);
}

async function publishNewPost(e) {
    e.preventDefault();
    const token = getCookie('github_token');
    const title = document.getElementById('publish-title').value.trim();
    const body = document.getElementById('publish-body').value.trim();
    const labels = document.getElementById('publish-labels').value.split(',').map(l => l.trim()).filter(Boolean);
    const summary = document.getElementById('publish-summary').value.trim();
    let cover = document.getElementById('publish-cover').value.trim();
    const coverFile = document.getElementById('publish-cover-upload').files[0];
    const progressEl = document.getElementById('publish-progress');

    if (!token) return showNotification('请先登录', 'warning');

    try {
        if (progressEl) progressEl.style.display = 'block';
        if (coverFile) {
            if (progressEl) progressEl.textContent = '正在上传封面...';
            cover = await uploadCoverToGithub(coverFile, token);
        }

        if (progressEl) progressEl.textContent = '正在发布到 GitHub Issues...';
        let issueBody = '';
        if (cover) issueBody += `### 🖼️ 封面图链接\n${cover}\n\n`;
        if (summary) issueBody += `### 📖 文章简述\n${summary}\n\n`;
        issueBody += `### 📄 正文内容\n${body}\n`;

        const res = await fetch(`https://api.github.com/repos/${CONFIG.username}/${CONFIG.repo}/issues`, {
            method: 'POST',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title, body: issueBody, labels })
        });

        if (!res.ok) throw new Error('发布请求被 GitHub 拒绝，请检查权限');
        
        showNotification('发布成功！', 'info');
        closePublishModal();
        
        e.target.reset();
        if (document.getElementById('md-preview')) document.getElementById('md-preview').innerHTML = '';
        
        setTimeout(fetchPosts, 2000);
    } catch (err) {
        showNotification(err.message, 'error');
    } finally {
        if (progressEl) progressEl.style.display = 'none';
    }
}