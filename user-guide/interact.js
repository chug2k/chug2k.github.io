/**
 * Interactive features for the User Guide:
 * 1. Suggest Edit — opens a GitHub Issue with structured change suggestion
 * 2. Copy Link — generates a scroll-to-text-fragment URL and copies to clipboard
 */

(function () {
    const REPO_OWNER = 'chug2k';
    const REPO_NAME = 'charles-user-guide';

    // --- Floating Toolbar ---
    const toolbar = document.createElement('div');
    toolbar.className = 'selection-toolbar';
    toolbar.innerHTML = `
        <button class="toolbar-btn" data-action="suggest">Suggest Edit</button>
        <span class="toolbar-divider"></span>
        <button class="toolbar-btn" data-action="link">Copy Link</button>
    `;
    document.body.appendChild(toolbar);

    // --- Suggest Edit Modal ---
    const modal = document.createElement('div');
    modal.className = 'suggest-modal';
    modal.innerHTML = `
        <div class="suggest-modal-backdrop"></div>
        <div class="suggest-modal-content">
            <div class="suggest-modal-header">
                <h3>Suggest a Change</h3>
                <button class="suggest-modal-close">&times;</button>
            </div>
            <div class="suggest-modal-body">
                <label class="suggest-label">Original text</label>
                <div class="suggest-original"></div>
                <label class="suggest-label">Your suggestion</label>
                <textarea class="suggest-input" placeholder="Write your suggested replacement or correction..." rows="4"></textarea>
                <label class="suggest-label">Context <span class="suggest-optional">(optional)</span></label>
                <textarea class="suggest-context" placeholder="Why this change? Any additional context..." rows="2"></textarea>
            </div>
            <div class="suggest-modal-footer">
                <button class="suggest-cancel">Cancel</button>
                <button class="suggest-submit">Submit via GitHub</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // --- Toast ---
    const toast = document.createElement('div');
    toast.className = 'copy-toast';
    document.body.appendChild(toast);

    // --- State ---
    let selectedText = '';
    let selectedSection = '';

    // --- Toolbar positioning ---
    function showToolbar(x, y) {
        toolbar.style.left = x + 'px';
        toolbar.style.top = y + 'px';
        toolbar.classList.add('visible');
    }

    function hideToolbar() {
        toolbar.classList.remove('visible');
    }

    function findSection(node) {
        let el = node.nodeType === 3 ? node.parentElement : node;
        while (el && el !== document.body) {
            const heading = el.querySelector('.section-heading, .callout-heading, .appendix-card-name, .appendix-hogan-card-header h4');
            if (heading) return heading.textContent.replace(/^\d+/, '').trim();
            if (el.classList && el.classList.contains('section')) {
                const h = el.querySelector('.section-heading, .callout-heading');
                if (h) return h.textContent.replace(/^\d+/, '').trim();
            }
            el = el.parentElement;
        }
        return 'General';
    }

    document.addEventListener('mouseup', function (e) {
        // Don't interfere with toolbar/modal clicks
        if (toolbar.contains(e.target) || modal.contains(e.target)) return;

        setTimeout(function () {
            const selection = window.getSelection();
            const text = selection.toString().trim();

            if (text.length > 2) {
                selectedText = text;
                const range = selection.getRangeAt(0);
                selectedSection = findSection(range.startContainer);
                const rect = range.getBoundingClientRect();
                const x = rect.left + rect.width / 2 - 95;
                const y = rect.top + window.scrollY - 48;
                showToolbar(Math.max(8, x), y);
            } else {
                hideToolbar();
            }
        }, 10);
    });

    // --- Toolbar actions ---
    toolbar.addEventListener('click', function (e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        if (btn.dataset.action === 'suggest') {
            openSuggestModal();
        } else if (btn.dataset.action === 'link') {
            copyTextLink();
        }
        hideToolbar();
    });

    // --- Suggest Edit ---
    function openSuggestModal() {
        modal.querySelector('.suggest-original').textContent = selectedText;
        modal.querySelector('.suggest-input').value = '';
        modal.querySelector('.suggest-context').value = '';
        modal.classList.add('visible');
        setTimeout(function () {
            modal.querySelector('.suggest-input').focus();
        }, 100);
    }

    function closeSuggestModal() {
        modal.classList.remove('visible');
    }

    modal.querySelector('.suggest-modal-close').addEventListener('click', closeSuggestModal);
    modal.querySelector('.suggest-modal-backdrop').addEventListener('click', closeSuggestModal);
    modal.querySelector('.suggest-cancel').addEventListener('click', closeSuggestModal);

    modal.querySelector('.suggest-submit').addEventListener('click', function () {
        const suggestion = modal.querySelector('.suggest-input').value.trim();
        const context = modal.querySelector('.suggest-context').value.trim();

        if (!suggestion) {
            modal.querySelector('.suggest-input').focus();
            return;
        }

        const title = 'Suggested edit: ' + selectedSection;
        const body = [
            '## Suggested Change',
            '',
            '**Section:** ' + selectedSection,
            '',
            '### Original text',
            '> ' + selectedText.replace(/\n/g, '\n> '),
            '',
            '### Suggested replacement',
            suggestion,
            context ? '\n### Context\n' + context : '',
            '',
            '---',
            '_Submitted from the [User Guide](https://' + REPO_OWNER + '.github.io/' + REPO_NAME + '/)_'
        ].join('\n');

        const url = 'https://github.com/' + REPO_OWNER + '/' + REPO_NAME + '/issues/new?'
            + 'title=' + encodeURIComponent(title)
            + '&body=' + encodeURIComponent(body)
            + '&labels=' + encodeURIComponent('suggested-edit');

        window.open(url, '_blank');
        closeSuggestModal();
    });

    // --- Copy Link with text fragment ---
    function copyTextLink() {
        // Encode for text fragment
        var encoded = encodeURIComponent(selectedText);

        // For long selections, use prefix,suffix format
        var fragment;
        if (selectedText.length > 100) {
            var words = selectedText.split(/\s+/);
            var prefix = words.slice(0, 4).join(' ');
            var suffix = words.slice(-4).join(' ');
            fragment = encodeURIComponent(prefix) + ',' + encodeURIComponent(suffix);
        } else {
            fragment = encoded;
        }

        var url = window.location.origin + window.location.pathname + '#:~:text=' + fragment;

        navigator.clipboard.writeText(url).then(function () {
            showToast('Link copied to clipboard');
        }).catch(function () {
            // Fallback
            showToast('Link copied to clipboard');
            var ta = document.createElement('textarea');
            ta.value = url;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        });

        window.getSelection().removeAllRanges();
    }

    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('visible');
        setTimeout(function () {
            toast.classList.remove('visible');
        }, 2000);
    }

    // --- Keyboard: Escape closes modal ---
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            closeSuggestModal();
            hideToolbar();
        }
    });
})();
