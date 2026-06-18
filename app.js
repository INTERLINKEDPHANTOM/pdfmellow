// Set up PDF.js Global Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// Application State
let loadedFiles = []; // Array of { id, name, data (Uint8Array) }
let pageList = [];   // Array of { id, fileId, originalPageNum, localRotation (0, 90, 180, 270), textEdits: [] }
let selectedPageIds = new Set(); // Set of page IDs currently selected for bulk operations
let nextFileId = 1;
let nextPageId = 1;
let dragSourceEl = null;

// Text Editor State
let activeEditingPageId = null;
let currentTextContentItems = [];
let currentViewport = null;

// Watermark & Page Numbering Settings Configurations
let watermarkConfig = {
    text: 'CONFIDENTIAL',
    size: 48,
    color: '#ff0000',
    opacity: 0.15,
    rotation: 45
};

let pageNumConfig = {
    format: 'simple',
    position: 'bottom-center',
    size: 10,
    color: '#9ca3af'
};

// DOM Elements
const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
const selectBtn = document.getElementById('select-btn');
const activeWorkspace = document.getElementById('active-workspace');
const featureInfo = document.getElementById('feature-info');
const pagesGrid = document.getElementById('pages-grid');
const loadingIndicator = document.getElementById('loading-indicator');
const loadingText = document.getElementById('loading-text');

// Actions Dashboard & Mode Routing Elements
const actionsDashboard = document.getElementById('actions-dashboard');
const uploadContainer = document.getElementById('upload-container');
const backToDashboardBtn = document.getElementById('back-to-dashboard-btn');
const uploadZoneTitle = document.getElementById('upload-zone-title');
const uploadZoneDesc = document.getElementById('upload-zone-desc');
const emptyBadge = document.getElementById('empty-badge');
const emptyMainIcon = document.getElementById('empty-main-icon');
const emptyBulletsList = document.getElementById('empty-bullets-list');
const workspaceTitle = document.getElementById('workspace-title');
const workspaceDesc = document.getElementById('workspace-desc');
const compressSettingsCard = document.getElementById('compress-settings-card');
const compLevelInput = document.getElementById('comp-level-input');
const compLevelVal = document.getElementById('comp-level-val');
const compOrigSize = document.getElementById('comp-orig-size');
const compEstSize = document.getElementById('comp-est-size');
const compReduction = document.getElementById('comp-reduction');

let currentAppMode = null; // 'merge', 'edit-text', 'rotate', 'delete', 'all-edit', 'rearrange', 'compress'
let originalFileSize = 0;
let compressionQuality = 0.6; // Default to 60%
let currentDownloadUrl = null; // Keeps track of compiled/compressed PDF Blob URL

// Toolbar Buttons
const addMoreBtn = document.getElementById('add-more-btn');
const addMoreInput = document.getElementById('add-more-input');
const rotateAllBtn = document.getElementById('rotate-all-btn');
const clearAllBtn = document.getElementById('clear-all-btn');
const downloadBtn = document.getElementById('download-btn');

// Selection Toolbar Elements
const selectionToolbar = document.getElementById('selection-toolbar');
const selectionCount = document.getElementById('selection-count');
const selectAllBtn = document.getElementById('select-all-btn');
const deselectAllBtn = document.getElementById('deselect-all-btn');
const bulkRotateBtn = document.getElementById('bulk-rotate-btn');
const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
const bulkExtractBtn = document.getElementById('bulk-extract-btn');

// Modal Elements
const privacyModal = document.getElementById('privacy-modal');
const privacyShieldBtn = document.getElementById('privacy-shield-btn');
const modalCloseBtn = document.getElementById('modal-close-btn');
const offlineTestLink = document.getElementById('offline-test-link');
const coffeeDonateModal = document.getElementById('coffee-donate-modal');
const coffeeDonateBtn = document.getElementById('coffee-donate-btn');
const coffeeCloseBtn = document.getElementById('coffee-close-btn');
const notificationContainer = document.getElementById('notification-container');

// Text Editor Modal Elements
const editorModal = document.getElementById('editor-modal');
const editorModalTitle = document.getElementById('editor-modal-title');
const editorCanvas = document.getElementById('editor-canvas');
const editorWorkspace = document.getElementById('editor-workspace');
const editorTextLayer = document.getElementById('editor-text-layer');
const editorLoading = document.getElementById('editor-loading');
const editorCancelBtn = document.getElementById('editor-cancel-btn');
const editorSaveBtn = document.getElementById('editor-save-btn');
const editorAddTextBtn = document.getElementById('editor-add-text-btn');
const editorPrevBtn = document.getElementById('editor-prev-btn');
const editorNextBtn = document.getElementById('editor-next-btn');

// Workspace Settings Sidebar Elements
const workspaceSettingsSidebar = document.getElementById('workspace-settings-sidebar');
const watermarkSettingsCard = document.getElementById('watermark-settings-card');
const pagenumSettingsCard = document.getElementById('pagenum-settings-card');
const wmTextInput = document.getElementById('wm-text-input');
const wmSizeInput = document.getElementById('wm-size-input');
const wmSizeVal = document.getElementById('wm-size-val');
const wmColorInput = document.getElementById('wm-color-input');
const wmOpacityInput = document.getElementById('wm-opacity-input');
const wmOpacityVal = document.getElementById('wm-opacity-val');
const wmRotationInput = document.getElementById('wm-rotation-input');
const wmRotationVal = document.getElementById('wm-rotation-val');
const pnFormatSelect = document.getElementById('pn-format-select');
const pnPositionSelect = document.getElementById('pn-position-select');
const pnSizeInput = document.getElementById('pn-size-input');
const pnSizeVal = document.getElementById('pn-size-val');
const pnColorInput = document.getElementById('pn-color-input');
const editorPageIndicator = document.getElementById('editor-page-indicator');
const editorModeStatus = document.getElementById('editor-mode-status');
const editorRotateBtn = document.getElementById('editor-rotate-btn');
const editorDeleteBtn = document.getElementById('editor-delete-btn');

// FAQ & Legal Modal Elements
const faqSection = document.getElementById('faq-section');
const legalModal = document.getElementById('legal-modal');
const legalModalClose = document.getElementById('legal-modal-close');
const privacyPolicyLink = document.getElementById('privacy-policy-link');
const termsLink = document.getElementById('terms-link');
const legalTabs = document.querySelectorAll('.legal-tab-btn');
const legalTabContents = document.querySelectorAll('.legal-tab-content');

// Editor Manual Add State
let isAddingTextMode = false;

// Initialize Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // File upload triggers
    selectBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    
    // Dashboard actions click handling
    const actionCards = document.querySelectorAll('.action-card');
    actionCards.forEach(card => {
        card.addEventListener('click', () => {
            const mode = card.getAttribute('data-action');
            selectAppMode(mode);
        });
    });

    // Back to dashboard button
    if (backToDashboardBtn) {
        backToDashboardBtn.addEventListener('click', () => {
            currentAppMode = null;
            toggleLoading(false);
        });
    }

    const workspaceBackBtn = document.getElementById('workspace-back-btn');
    if (workspaceBackBtn) {
        workspaceBackBtn.addEventListener('click', () => {
            clearWorkspace();
            currentAppMode = null;
            toggleLoading(false);
        });
    }
    
    addMoreBtn.addEventListener('click', () => addMoreInput.click());
    addMoreInput.addEventListener('change', handleFileSelect);

    // Drag and drop for upload zone
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadZone.addEventListener(eventName, highlight, false);
    });
    ['dragleave', 'drop'].forEach(eventName => {
        uploadZone.addEventListener(eventName, unhighlight, false);
    });
    uploadZone.addEventListener('drop', handleDrop, false);

    // Toolbar Operations
    rotateAllBtn.addEventListener('click', rotateAllPages);
    clearAllBtn.addEventListener('click', clearWorkspace);
    downloadBtn.addEventListener('click', exportPDF);

    // Bulk Operations Toolbar
    selectAllBtn.addEventListener('click', selectAllPages);
    deselectAllBtn.addEventListener('click', deselectAllPages);
    bulkRotateBtn.addEventListener('click', bulkRotatePages);
    bulkDeleteBtn.addEventListener('click', bulkDeletePages);
    if (bulkExtractBtn) {
        bulkExtractBtn.addEventListener('click', extractSelectedPages);
    }

    // Modals & Info Links
    privacyShieldBtn.addEventListener('click', () => showModal(true));
    offlineTestLink.addEventListener('click', (e) => {
        e.preventDefault();
        showModal(true);
    });
    modalCloseBtn.addEventListener('click', () => showModal(false));
    privacyModal.addEventListener('click', (e) => {
        if (e.target === privacyModal) showModal(false);
    });

    // Buy the Developer a Coffee Modal listeners
    if (coffeeDonateBtn) {
        coffeeDonateBtn.addEventListener('click', () => {
            if (coffeeDonateModal) coffeeDonateModal.style.display = 'flex';
        });
    }
    if (coffeeCloseBtn) {
        coffeeCloseBtn.addEventListener('click', () => {
            if (coffeeDonateModal) coffeeDonateModal.style.display = 'none';
        });
    }
    if (coffeeDonateModal) {
        coffeeDonateModal.addEventListener('click', (e) => {
            if (e.target === coffeeDonateModal) {
                coffeeDonateModal.style.display = 'none';
            }
        });
    }

    // Text Editor Modal Events
    editorCancelBtn.addEventListener('click', closeTextEditor);
    editorSaveBtn.addEventListener('click', saveTextEdits);

    // Watermark Settings Listeners
    if (wmTextInput) {
        wmTextInput.addEventListener('input', (e) => {
            watermarkConfig.text = e.target.value || '';
            updateWatermarkPreviews();
        });
    }
    if (wmSizeInput) {
        wmSizeInput.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            watermarkConfig.size = val;
            if (wmSizeVal) wmSizeVal.textContent = val;
            updateWatermarkPreviews();
        });
    }
    if (wmColorInput) {
        wmColorInput.addEventListener('input', (e) => {
            watermarkConfig.color = e.target.value;
            updateWatermarkPreviews();
        });
    }
    if (wmOpacityInput) {
        wmOpacityInput.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            watermarkConfig.opacity = val;
            if (wmOpacityVal) wmOpacityVal.textContent = Math.round(val * 100);
            updateWatermarkPreviews();
        });
    }
    if (wmRotationInput) {
        wmRotationInput.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            watermarkConfig.rotation = val;
            if (wmRotationVal) wmRotationVal.textContent = val;
            updateWatermarkPreviews();
        });
    }

    // Page Numbers Settings Listeners
    if (pnFormatSelect) {
        pnFormatSelect.addEventListener('change', (e) => {
            pageNumConfig.format = e.target.value;
        });
    }
    if (pnPositionSelect) {
        pnPositionSelect.addEventListener('change', (e) => {
            pageNumConfig.position = e.target.value;
        });
    }
    if (pnSizeInput) {
        pnSizeInput.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            pageNumConfig.size = val;
            if (pnSizeVal) pnSizeVal.textContent = val;
        });
    }
    if (pnColorInput) {
        pnColorInput.addEventListener('input', (e) => {
            pageNumConfig.color = e.target.value;
        });
    }

    // PDF Compression Settings Listener
    if (compLevelInput) {
        compLevelInput.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            if (compLevelVal) compLevelVal.textContent = val;
            compressionQuality = val / 100;
            updateCompressionStats();
        });
    }

    // Toggle Add Text Mode
    if (editorAddTextBtn) {
        editorAddTextBtn.addEventListener('click', () => {
            isAddingTextMode = !isAddingTextMode;
            if (isAddingTextMode) {
                editorWorkspace.style.cursor = 'crosshair';
                editorModeStatus.style.display = 'inline-block';
                editorAddTextBtn.classList.add('active');
            } else {
                disableAddTextMode();
            }
        });
    }

    // Capture Workspace Click
    if (editorWorkspace) {
        editorWorkspace.addEventListener('click', handleWorkspaceClick);
    }

    // Page Navigation Controls inside Editor
    if (editorPrevBtn) {
        editorPrevBtn.addEventListener('click', () => navigatePage(-1));
    }
    if (editorNextBtn) {
        editorNextBtn.addEventListener('click', () => navigatePage(1));
    }

    // Sidebar Page Action Button Event Listeners
    if (editorRotateBtn) {
        editorRotateBtn.addEventListener('click', editorRotateActivePage);
    }
    if (editorDeleteBtn) {
        editorDeleteBtn.addEventListener('click', editorDeleteActivePage);
    }

    // Legal Modal trigger links
    if (privacyPolicyLink) {
        privacyPolicyLink.addEventListener('click', (e) => {
            e.preventDefault();
            openLegalModal('privacy-policy-tab');
        });
    }
    if (termsLink) {
        termsLink.addEventListener('click', (e) => {
            e.preventDefault();
            openLegalModal('terms-tab');
        });
    }
    if (legalModalClose) {
        legalModalClose.addEventListener('click', () => {
            if (legalModal) legalModal.style.display = 'none';
        });
    }
    if (legalModal) {
        legalModal.addEventListener('click', (e) => {
            if (e.target === legalModal) {
                legalModal.style.display = 'none';
            }
        });
    }

    // Legal Tab switching
    legalTabs.forEach(tabBtn => {
        tabBtn.addEventListener('click', () => {
            const targetTab = tabBtn.getAttribute('data-tab');
            
            // Toggle button active class
            legalTabs.forEach(btn => btn.classList.remove('active'));
            tabBtn.classList.add('active');
            
            // Toggle tab content display
            legalTabContents.forEach(content => {
                if (content.id === targetTab) {
                    content.style.display = 'block';
                } else {
                    content.style.display = 'none';
                }
            });
        });
    });

    // FAQ Accordion functionality
    const faqQuestions = document.querySelectorAll('.faq-question');
    faqQuestions.forEach(question => {
        question.addEventListener('click', () => {
            const faqItem = question.parentElement;
            const isActive = faqItem.classList.contains('active');
            
            // Collapse all other FAQ items for a clean accordion effect
            document.querySelectorAll('.faq-item').forEach(item => {
                item.classList.remove('active');
            });
            
            // If the clicked one wasn't active, expand it
            if (!isActive) {
                faqItem.classList.add('active');
            }
        });
    });

    // Initialize layout state
    toggleLoading(false);
});

function openLegalModal(tabId) {
    if (!legalModal) return;
    legalModal.style.display = 'flex';
    
    // Switch to target tab
    legalTabs.forEach(btn => {
        if (btn.getAttribute('data-tab') === tabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    legalTabContents.forEach(content => {
        if (content.id === tabId) {
            content.style.display = 'block';
        } else {
            content.style.display = 'none';
        }
    });
}

// Drag and drop zone styling helpers
function highlight(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadZone.classList.add('dragover');
}

// Unhighlight drag and drop zone
function unhighlight(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadZone.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const dt = e.dataTransfer;
    const files = dt.files;
    processUploadedFiles(files);
}

function handleFileSelect(e) {
    const files = e.target.files;
    processUploadedFiles(files);
    e.target.value = ''; // Reset file inputs
}

// Show/Hide Loading
function toggleLoading(show, text = 'Processing PDF pages locally...') {
    if (show) {
        loadingIndicator.style.display = 'flex';
        loadingText.textContent = text;
        if (actionsDashboard) actionsDashboard.style.display = 'none';
        if (uploadContainer) uploadContainer.style.display = 'none';
        if (featureInfo) featureInfo.style.display = 'none';
        if (activeWorkspace) activeWorkspace.style.display = 'none';
        if (faqSection) faqSection.style.display = 'none';
    } else {
        loadingIndicator.style.display = 'none';
        if (pageList.length > 0) {
            if (activeWorkspace) activeWorkspace.style.display = 'flex';
            if (actionsDashboard) actionsDashboard.style.display = 'none';
            if (uploadContainer) uploadContainer.style.display = 'none';
            if (featureInfo) featureInfo.style.display = 'none';
            if (faqSection) faqSection.style.display = 'none';
            applyModeLimitations();
        } else {
            if (activeWorkspace) activeWorkspace.style.display = 'none';
            if (currentAppMode) {
                if (actionsDashboard) actionsDashboard.style.display = 'none';
                if (uploadContainer) uploadContainer.style.display = 'block';
                if (featureInfo) featureInfo.style.display = 'none';
                if (faqSection) faqSection.style.display = 'none';
            } else {
                if (actionsDashboard) actionsDashboard.style.display = 'block';
                if (uploadContainer) uploadContainer.style.display = 'none';
                if (featureInfo) featureInfo.style.display = 'grid';
                if (faqSection) faqSection.style.display = 'block';
            }
        }
    }
}

const modeDetails = {
    'all-edit': {
        title: 'All-in-One PDF Editor',
        icon: 'fa-screwdriver-wrench',
        badge: 'Universal Editor',
        description: 'Edit, combine, and organize PDF documents in a single offline workspace.',
        bullets: [
            { icon: 'fa-layer-group', text: 'Merge multiple PDF files in any order' },
            { icon: 'fa-rotate', text: 'Rotate individual pages or entire documents' },
            { icon: 'fa-trash-can', text: 'Delete unwanted pages instantly' },
            { icon: 'fa-file-export', text: 'Extract selected pages to a standalone PDF' }
        ]
    },
    'merge': {
        title: 'Merge PDFs',
        icon: 'fa-layer-group',
        badge: 'Combine Files',
        description: 'Combine multiple files or page ranges into a single PDF document.',
        bullets: [
            { icon: 'fa-plus', text: 'Add and combine multiple PDF documents' },
            { icon: 'fa-sort', text: 'Drag pages to change their compilation sequence' },
            { icon: 'fa-shield-halved', text: '100% offline local page compilation' }
        ]
    },
    'rearrange': {
        title: 'Rearrange Pages',
        icon: 'fa-arrows-left-right-to-line',
        badge: 'Page Reorder',
        description: 'Drag and drop page previews to rearrange their sequence in your document.',
        bullets: [
            { icon: 'fa-up-down-left-right', text: 'Drag and drop page cards to reorder' },
            { icon: 'fa-sort', text: 'Instantly view updated sequence indexes' },
            { icon: 'fa-file-pdf', text: 'Export compilation instantly to local downloads' }
        ]
    },
    'compress': {
        title: 'Compress PDF',
        icon: 'fa-compress',
        badge: 'Compress Size',
        description: 'Reduce file size offline by optimizing page resolutions and image compression quality.',
        bullets: [
            { icon: 'fa-file-arrow-down', text: 'Select Low, Medium, or High compression level' },
            { icon: 'fa-gauge-high', text: 'Instantly view estimated size and percentage savings' },
            { icon: 'fa-shield-halved', text: '100% secure offline client-side optimization' }
        ]
    },
    'edit-text': {
        title: 'Edit PDF Text',
        icon: 'fa-signature',
        badge: 'Direct Text Editor',
        description: 'Modify or whiteout existing text layers directly in your browser.',
        bullets: [
            { icon: 'fa-pen-to-square', text: 'Double-click to modify spelling and sentences' },
            { icon: 'fa-square-plus', text: 'Click anywhere to insert new text blocks' },
            { icon: 'fa-font', text: 'Supports clean system and web fonts' }
        ]
    },
    'rotate': {
        title: 'Rotate Pages',
        icon: 'fa-rotate-right',
        badge: 'Page Orientation',
        description: 'Fix upside-down pages or change page orientation layouts.',
        bullets: [
            { icon: 'fa-arrow-rotate-right', text: 'Rotate 90° clockwise or counterclockwise' },
            { icon: 'fa-table-cells', text: 'Apply to single pages or in bulk' },
            { icon: 'fa-file-pdf', text: 'Live orientation canvas rendering' }
        ]
    },
    'delete': {
        title: 'Delete Pages',
        icon: 'fa-trash-can',
        badge: 'Page Remover',
        description: 'Strip out slides, sheets, or appendices with a single click.',
        bullets: [
            { icon: 'fa-trash', text: 'Delete selected pages instantly' },
            { icon: 'fa-square-check', text: 'Select multiple pages to delete in bulk' },
            { icon: 'fa-circle-exclamation', text: 'Safely process files locally' }
        ]
    },
    'extract': {
        title: 'Extract Pages',
        icon: 'fa-file-export',
        badge: 'Page Extractor',
        description: 'Extract specific pages into a new standalone PDF file.',
        bullets: [
            { icon: 'fa-scissors', text: 'Cut specific page ranges out' },
            { icon: 'fa-copy', text: 'Extract multiple pages in original quality' },
            { icon: 'fa-file-pdf', text: 'Save directly to your local computer' }
        ]
    },
    'watermark': {
        title: 'Watermark PDF',
        icon: 'fa-wand-magic-sparkles',
        badge: 'Security Stamp',
        description: 'Overlay custom text watermarks across your document pages.',
        bullets: [
            { icon: 'fa-heading', text: 'Enter custom overlay text values' },
            { icon: 'fa-circle-half-stroke', text: 'Fine-tune opacity, rotation, size, and color' },
            { icon: 'fa-eye', text: 'Real-time CSS preview overlays' }
        ]
    },
    'pagenum': {
        title: 'Add Page Numbers',
        icon: 'fa-list-ol',
        badge: 'Page Labels',
        description: 'Stamp sequential page numbering in customized styles.',
        bullets: [
            { icon: 'fa-list-check', text: 'Select bottom/top and center/left/right coordinates' },
            { icon: 'fa-font', text: 'Customize font sizes, families, and colors' },
            { icon: 'fa-repeat', text: 'Auto-computes sequence ranges' }
        ]
    }
};

// Select specific app feature mode and customize upload copies
function selectAppMode(mode) {
    currentAppMode = mode;
    
    const details = modeDetails[mode];
    if (details) {
        uploadZoneTitle.textContent = details.title;
        uploadZoneDesc.textContent = details.description;
        if (emptyBadge) emptyBadge.textContent = details.badge;
        if (emptyMainIcon) {
            emptyMainIcon.className = `fa-solid ${details.icon}`;
        }
        if (emptyBulletsList) {
            emptyBulletsList.innerHTML = details.bullets.map(bullet => `
                <div class="empty-bullet">
                    <i class="fa-solid ${bullet.icon}"></i>
                    <span>${bullet.text}</span>
                </div>
            `).join('');
        }
    }
    
    toggleLoading(false);
}

// Read and process uploaded files
async function processUploadedFiles(files) {
    const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf');
    if (pdfFiles.length === 0) {
        showNotification('Please select valid PDF files.', 'error');
        return;
    }

    toggleLoading(true, `Reading ${pdfFiles.length} file(s)...`);

    for (const file of pdfFiles) {
        try {
            originalFileSize += file.size;
            const data = await readFileAsArrayBuffer(file);
            const uint8Array = new Uint8Array(data);
            const fileId = nextFileId++;
            
            // Load document in PDF.js to extract pages (slice to prevent detaching)
            const loadingTask = pdfjsLib.getDocument({ data: uint8Array.slice(0) });
            const pdfDoc = await loadingTask.promise;
            const numPages = pdfDoc.numPages;

            // Cache the loaded PDF document object to avoid parsing multiple times
            loadedFiles.push({
                id: fileId,
                name: file.name,
                data: uint8Array,
                pdfDoc: pdfDoc
            });

            for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                pageList.push({
                    id: `page-${nextPageId++}`,
                    fileId: fileId,
                    fileName: file.name,
                    originalPageNum: pageNum,
                    localRotation: 0,
                    textEdits: []
                });
            }
        } catch (err) {
            console.error('Error processing PDF:', err);
            showNotification(`Error loading "${file.name}": Not a valid PDF or encrypted.`, 'error');
        }
    }

    await renderWorkspace();
    toggleLoading(false);
    showNotification(`Imported ${pdfFiles.length} PDF file(s) successfully!`);

    // Mode-specific direct routing
    if (pageList.length > 0) {
        if (currentAppMode === 'edit-text') {
            // Automatically open text editor on the first page immediately
            openTextEditor(pageList[0].id);
        } else if (currentAppMode === 'delete') {
            showNotification('Check the pages you want to remove, then click "Delete Selected" in the top bar.', 'info');
        } else if (currentAppMode === 'rotate') {
            showNotification('Click the Rotate icon on any page card, or check multiple cards to rotate them together.', 'info');
        } else if (currentAppMode === 'extract') {
            showNotification('Check the pages you want to keep, then click "Extract Selected" in the top bar.', 'info');
        } else if (currentAppMode === 'watermark') {
            showNotification('Use the right sidebar to configure your watermark text, opacity, and rotation. It overlays live on the page thumbnails.', 'info');
        } else if (currentAppMode === 'pagenum') {
            showNotification('Use the right sidebar to select a page number format, layout, and placement style.', 'info');
        }
    }
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
    });
}

// Render Grid of Pages
async function renderWorkspace() {
    pagesGrid.innerHTML = '';
    
    // Configure toolbars, headers and sidebar configurations based on app mode
    applyModeLimitations();
    
    // Process pages sequentially to maintain canvas render quality
    for (const pageItem of pageList) {
        const pageCard = createPageCardElement(pageItem);
        pagesGrid.appendChild(pageCard);
        
        // Asynchronously render the canvas thumbnail
        renderPageThumbnail(pageItem, pageCard.querySelector('canvas'));
    }
    
    updateCardNavigationButtons();
}

function applyModeLimitations() {
    const isAllEdit = currentAppMode === 'all-edit';
    
    // 1. Sidebar handling
    const sidebar = document.getElementById('workspace-settings-sidebar');
    const watermarkCard = document.getElementById('watermark-settings-card');
    const pagenumCard = document.getElementById('pagenum-settings-card');
    
    if (sidebar) {
        if (isAllEdit) {
            sidebar.style.display = 'flex';
            if (watermarkCard) watermarkCard.style.display = 'flex';
            if (pagenumCard) pagenumCard.style.display = 'flex';
            if (compressSettingsCard) compressSettingsCard.style.display = 'flex';
            updateCompressionStats();
        } else if (currentAppMode === 'watermark') {
            sidebar.style.display = 'flex';
            if (watermarkCard) watermarkCard.style.display = 'flex';
            if (pagenumCard) pagenumCard.style.display = 'none';
            if (compressSettingsCard) compressSettingsCard.style.display = 'none';
        } else if (currentAppMode === 'pagenum') {
            sidebar.style.display = 'flex';
            if (watermarkCard) watermarkCard.style.display = 'none';
            if (pagenumCard) pagenumCard.style.display = 'flex';
            if (compressSettingsCard) compressSettingsCard.style.display = 'none';
        } else if (currentAppMode === 'compress') {
            sidebar.style.display = 'flex';
            if (watermarkCard) watermarkCard.style.display = 'none';
            if (pagenumCard) pagenumCard.style.display = 'none';
            if (compressSettingsCard) compressSettingsCard.style.display = 'flex';
            updateCompressionStats();
        } else {
            sidebar.style.display = 'none';
            if (watermarkCard) watermarkCard.style.display = 'none';
            if (pagenumCard) pagenumCard.style.display = 'none';
            if (compressSettingsCard) compressSettingsCard.style.display = 'none';
        }
    }
    
    // 2. Toolbar left actions handling
    const addMoreBtn = document.getElementById('add-more-btn');
    const rotateAllBtn = document.getElementById('rotate-all-btn');
    
    // Rotate All is only shown in rotate or all-edit mode
    if (rotateAllBtn) {
        rotateAllBtn.style.display = (isAllEdit || currentAppMode === 'rotate') ? 'inline-flex' : 'none';
    }
    
    // Add More PDFs is only relevant for modes that handle multiple files: merge, rearrange, all-edit
    if (addMoreBtn) {
        const canAddMore = (isAllEdit || currentAppMode === 'merge' || currentAppMode === 'rearrange');
        addMoreBtn.style.display = canAddMore ? 'inline-flex' : 'none';
    }
    
    // 3. Selection toolbar right button visibility
    const bulkExtractBtn = document.getElementById('bulk-extract-btn');
    const bulkRotateBtn = document.getElementById('bulk-rotate-btn');
    const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
    
    if (bulkExtractBtn) {
        bulkExtractBtn.style.display = (isAllEdit || currentAppMode === 'extract') ? 'inline-flex' : 'none';
    }
    if (bulkRotateBtn) {
        bulkRotateBtn.style.display = (isAllEdit || currentAppMode === 'rotate') ? 'inline-flex' : 'none';
    }
    if (bulkDeleteBtn) {
        bulkDeleteBtn.style.display = (isAllEdit || currentAppMode === 'delete') ? 'inline-flex' : 'none';
    }

    // 4. Update Workspace Header Title/Desc
    const workspaceTitle = document.getElementById('workspace-title');
    const workspaceDesc = document.getElementById('workspace-desc');
    if (workspaceTitle && workspaceDesc) {
        const details = modeDetails[currentAppMode];
        if (details) {
            workspaceTitle.textContent = details.title;
            workspaceDesc.textContent = details.description;
        } else {
            workspaceTitle.textContent = 'PDF Editor';
            workspaceDesc.textContent = 'Perform PDF page operations offline in your browser.';
        }
    }
}

function updateWatermarkPreviews() {
    const overlays = document.querySelectorAll('.watermark-preview-overlay');
    overlays.forEach(overlay => {
        overlay.style.display = currentAppMode === 'watermark' ? 'block' : 'none';
        overlay.textContent = watermarkConfig.text;
        overlay.style.fontSize = `${watermarkConfig.size / 3.5}px`;
        overlay.style.color = watermarkConfig.color;
        overlay.style.opacity = watermarkConfig.opacity;
        overlay.style.transform = `translate(-50%, -50%) rotate(${watermarkConfig.rotation}deg)`;
    });
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function updateCompressionStats() {
    if (!compOrigSize || !compEstSize || !compReduction) return;
    
    compOrigSize.textContent = formatBytes(originalFileSize);
    
    // Smooth saving ratio estimation based on quality curve
    const savingRatio = 1 - (0.05 + 0.5 * Math.pow(compressionQuality, 1.5));
    
    const estSize = Math.max(1024, Math.round(originalFileSize * (1 - savingRatio)));
    compEstSize.textContent = formatBytes(estSize);
    compReduction.textContent = `${Math.round(savingRatio * 100)}% smaller`;
}

// Update card navigation buttons (Move Left / Move Right) based on position in DOM
function updateCardNavigationButtons() {
    const cards = Array.from(pagesGrid.querySelectorAll('.page-card'));
    cards.forEach((card, idx) => {
        const controls = card.querySelector('.page-controls');
        if (controls && controls.children.length === 5) {
            const btnLeft = controls.children[0];
            const btnRight = controls.children[4];
            
            // First page: disable move left
            const isFirst = idx === 0;
            btnLeft.disabled = isFirst;
            btnLeft.style.opacity = isFirst ? '0.4' : '1';
            btnLeft.style.cursor = isFirst ? 'not-allowed' : 'pointer';
            
            // Last page: disable move right
            const isLast = idx === cards.length - 1;
            btnRight.disabled = isLast;
            btnRight.style.opacity = isLast ? '0.4' : '1';
            btnRight.style.cursor = isLast ? 'not-allowed' : 'pointer';
        }
    });
}

// Create Card DOM Node
function createPageCardElement(pageItem) {
    const card = document.createElement('div');
    card.className = 'page-card' + (selectedPageIds.has(pageItem.id) ? ' selected' : '');
    card.id = pageItem.id;
    
    const isAllEdit = currentAppMode === 'all-edit';
    const showRearrange = isAllEdit || ['merge', 'rearrange'].includes(currentAppMode);
    card.setAttribute('draggable', showRearrange ? 'true' : 'false');
    if (!showRearrange) {
        card.style.cursor = 'default';
    }

    // Add select checkbox container (Top Right)
    const selectContainer = document.createElement('div');
    selectContainer.className = 'page-select-container';
    
    // Checkbox container visibility based on mode
    const showCheckbox = isAllEdit || ['rotate', 'delete', 'extract'].includes(currentAppMode);
    selectContainer.style.display = showCheckbox ? 'block' : 'none';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'page-select-checkbox';
    checkbox.checked = selectedPageIds.has(pageItem.id);
    
    checkbox.addEventListener('click', (e) => {
        e.stopPropagation(); // Avoid opening editor modal or triggering drag
    });
    
    checkbox.addEventListener('change', (e) => {
        if (checkbox.checked) {
            selectedPageIds.add(pageItem.id);
            card.classList.add('selected');
        } else {
            selectedPageIds.delete(pageItem.id);
            card.classList.remove('selected');
        }
        updateSelectionToolbar();
    });

    selectContainer.appendChild(checkbox);
    card.appendChild(selectContainer);

    // Add source file badge
    const badge = document.createElement('div');
    badge.className = 'source-badge';
    badge.textContent = pageItem.fileName;
    badge.title = pageItem.fileName;
    card.appendChild(badge);

    // Canvas Container
    const thumbContainer = document.createElement('div');
    thumbContainer.className = 'thumbnail-container';
    
    const showEdit = isAllEdit || currentAppMode === 'edit-text';
    thumbContainer.style.cursor = showEdit ? 'pointer' : (showCheckbox ? 'pointer' : 'default');
    
    // Clicking the thumbnail behavior depends on mode
    thumbContainer.addEventListener('click', (e) => {
        e.stopPropagation();
        if (showEdit) {
            openTextEditor(pageItem.id);
        } else if (showCheckbox) {
            // Toggle selection checkbox for easier bulk actions
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
        }
    });
    
    const canvas = document.createElement('canvas');
    thumbContainer.appendChild(canvas);
    
    // Live Watermark Preview Overlay
    const wmOverlay = document.createElement('div');
    wmOverlay.className = 'watermark-preview-overlay';
    wmOverlay.style.display = (isAllEdit || currentAppMode === 'watermark') ? 'block' : 'none';
    wmOverlay.textContent = watermarkConfig.text;
    wmOverlay.style.fontSize = `${watermarkConfig.size / 3.5}px`;
    wmOverlay.style.color = watermarkConfig.color;
    wmOverlay.style.opacity = watermarkConfig.opacity;
    wmOverlay.style.transform = `translate(-50%, -50%) rotate(${watermarkConfig.rotation}deg)`;
    
    thumbContainer.appendChild(wmOverlay);
    card.appendChild(thumbContainer);

    // Page Info Label
    const info = document.createElement('div');
    info.className = 'page-info-tag';
    
    // Append edit count indicator if any edits exist
    const editCount = pageItem.textEdits ? pageItem.textEdits.length : 0;
    info.textContent = `Page ${pageItem.originalPageNum}${editCount > 0 ? ` (${editCount} edits)` : ''}`;
    card.appendChild(info);

    // Action buttons inside card
    const controls = document.createElement('div');
    controls.className = 'page-controls';

    // Move Left button (accessibility/touch fallback)
    const btnLeft = document.createElement('button');
    btnLeft.className = 'control-btn';
    btnLeft.innerHTML = '<i class="fa-solid fa-angle-left"></i>';
    btnLeft.title = 'Move Left';
    btnLeft.style.display = showRearrange ? 'inline-flex' : 'none';
    btnLeft.addEventListener('click', (e) => {
        e.stopPropagation();
        movePageOrder(pageItem.id, -1);
    });

    // Rotate button
    const btnRotate = document.createElement('button');
    btnRotate.className = 'control-btn';
    btnRotate.innerHTML = '<i class="fa-solid fa-rotate"></i>';
    btnRotate.title = 'Rotate 90°';
    btnRotate.style.display = (isAllEdit || currentAppMode === 'rotate') ? 'inline-flex' : 'none';
    btnRotate.addEventListener('click', (e) => {
        e.stopPropagation();
        rotatePage(pageItem.id);
    });

    // Edit Text button (WYSIWYG Layer)
    const btnEdit = document.createElement('button');
    btnEdit.className = 'control-btn';
    btnEdit.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>';
    btnEdit.title = 'Edit Page Text';
    btnEdit.style.display = showEdit ? 'inline-flex' : 'none';
    btnEdit.addEventListener('click', (e) => {
        e.stopPropagation();
        openTextEditor(pageItem.id);
    });

    // Delete button
    const btnDelete = document.createElement('button');
    btnDelete.className = 'control-btn btn-delete';
    btnDelete.innerHTML = '<i class="fa-solid fa-trash"></i>';
    btnDelete.title = 'Remove Page';
    btnDelete.style.display = (isAllEdit || currentAppMode === 'delete') ? 'inline-flex' : 'none';
    btnDelete.addEventListener('click', (e) => {
        e.stopPropagation();
        removePage(pageItem.id);
    });

    // Move Right button
    const btnRight = document.createElement('button');
    btnRight.className = 'control-btn';
    btnRight.innerHTML = '<i class="fa-solid fa-angle-right"></i>';
    btnRight.title = 'Move Right';
    btnRight.style.display = showRearrange ? 'inline-flex' : 'none';
    btnRight.addEventListener('click', (e) => {
        e.stopPropagation();
        movePageOrder(pageItem.id, 1);
    });

    controls.appendChild(btnLeft);
    controls.appendChild(btnRotate);
    controls.appendChild(btnEdit);
    controls.appendChild(btnDelete);
    controls.appendChild(btnRight);

    // Hide controls if none are shown to save vertical space
    const anyControlShown = showRearrange || isAllEdit || currentAppMode === 'rotate' || currentAppMode === 'edit-text' || currentAppMode === 'delete';
    if (!anyControlShown) {
        controls.style.display = 'none';
    } else {
        controls.style.display = 'flex';
    }
    card.appendChild(controls);

    // Setup drag & drop event listeners
    card.addEventListener('dragstart', handleDragStart, false);
    card.addEventListener('dragover', handleDragOver, false);
    card.addEventListener('dragenter', handleDragEnter, false);
    card.addEventListener('dragleave', handleDragLeave, false);
    card.addEventListener('drop', handlePageDrop, false);
    card.addEventListener('dragend', handleDragEnd, false);

    return card;
}

// Render PDF Page onto Canvas
async function renderPageThumbnail(pageItem, canvas) {
    const file = loadedFiles.find(f => f.id === pageItem.fileId);
    if (!file) return;

    try {
        const pdfDoc = file.pdfDoc;
        const page = await pdfDoc.getPage(pageItem.originalPageNum);
        
        // Initial render dimensions
        const viewport = page.getViewport({ scale: 1.0 });
        
        // Fit within 150px width card
        const scale = 150 / viewport.width;
        const scaledViewport = page.getViewport({ scale: scale, rotation: pageItem.localRotation });

        const context = canvas.getContext('2d');
        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        const renderContext = {
            canvasContext: context,
            viewport: scaledViewport
        };
        await page.render(renderContext).promise;
    } catch (err) {
        console.error('Error rendering thumbnail:', err);
    }
}

// Page Actions
function rotatePage(pageId) {
    const pageItem = pageList.find(p => p.id === pageId);
    if (pageItem) {
        pageItem.localRotation = (pageItem.localRotation + 90) % 360;
        
        // Re-render thumbnail
        const card = document.getElementById(pageId);
        if (card) {
            const canvas = card.querySelector('canvas');
            renderPageThumbnail(pageItem, canvas);
        }
    }
}

function removePage(pageId) {
    const index = pageList.findIndex(p => p.id === pageId);
    if (index > -1) {
        pageList.splice(index, 1);
        
        // Clean up bulk selection state if the deleted page was selected
        if (selectedPageIds.has(pageId)) {
            selectedPageIds.delete(pageId);
            updateSelectionToolbar();
        }
        
        const card = document.getElementById(pageId);
        if (card) {
            card.style.transform = 'scale(0.8)';
            card.style.opacity = '0';
            setTimeout(() => {
                card.remove();
                if (pageList.length === 0) {
                    clearWorkspace();
                }
            }, 200);
        }
    }
}

function movePageOrder(pageId, direction) {
    const index = pageList.findIndex(p => p.id === pageId);
    if (index === -1) return;
    
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= pageList.length) return;

    // Swap elements in state array
    const temp = pageList[index];
    pageList[index] = pageList[targetIndex];
    pageList[targetIndex] = temp;

    // Swap elements in the DOM directly for instantaneous visual feedback (wrapped in smooth animate helper)
    const cards = Array.from(pagesGrid.querySelectorAll('.page-card'));
    const cardEl = cards[index];
    const targetEl = cards[targetIndex];
    
    animateGridRearrange(() => {
        if (direction === 1) {
            pagesGrid.insertBefore(cardEl, targetEl.nextSibling);
        } else {
            pagesGrid.insertBefore(cardEl, targetEl);
        }
    });
    
    // Update navigation buttons status
    updateCardNavigationButtons();
}

function rotateAllPages() {
    pageList.forEach(pageItem => {
        pageItem.localRotation = (pageItem.localRotation + 90) % 360;
    });
    
    // Re-render all canvases
    pageList.forEach(pageItem => {
        const card = document.getElementById(pageItem.id);
        if (card) {
            renderPageThumbnail(pageItem, card.querySelector('canvas'));
        }
    });
    
    showNotification('Rotated all pages 90°');
}

function updateSelectionToolbar() {
    if (selectedPageIds.size > 0) {
        selectionCount.textContent = `${selectedPageIds.size} page(s) selected`;
        selectionToolbar.style.display = 'flex';
    } else {
        selectionToolbar.style.display = 'none';
    }
}

function selectAllPages() {
    pageList.forEach(pageItem => {
        selectedPageIds.add(pageItem.id);
        const card = document.getElementById(pageItem.id);
        if (card) {
            card.classList.add('selected');
            const checkbox = card.querySelector('.page-select-checkbox');
            if (checkbox) checkbox.checked = true;
        }
    });
    updateSelectionToolbar();
}

function deselectAllPages() {
    selectedPageIds.clear();
    pageList.forEach(pageItem => {
        const card = document.getElementById(pageItem.id);
        if (card) {
            card.classList.remove('selected');
            const checkbox = card.querySelector('.page-select-checkbox');
            if (checkbox) checkbox.checked = false;
        }
    });
    updateSelectionToolbar();
}

function bulkRotatePages() {
    if (selectedPageIds.size === 0) return;
    
    selectedPageIds.forEach(pageId => {
        const pageItem = pageList.find(p => p.id === pageId);
        if (pageItem) {
            pageItem.localRotation = (pageItem.localRotation + 90) % 360;
            const card = document.getElementById(pageId);
            if (card) {
                const canvas = card.querySelector('canvas');
                renderPageThumbnail(pageItem, canvas);
            }
        }
    });
    
    showNotification(`Rotated ${selectedPageIds.size} selected page(s) 90°`);
}

function bulkDeletePages() {
    if (selectedPageIds.size === 0) return;
    
    if (!confirm(`Are you sure you want to delete all ${selectedPageIds.size} selected page(s)?`)) return;
    
    const idsToDelete = Array.from(selectedPageIds);
    selectedPageIds.clear();
    updateSelectionToolbar();
    
    idsToDelete.forEach(pageId => {
        removePage(pageId);
    });
    
    showNotification(`Deleted ${idsToDelete.length} page(s)`);
}

function clearWorkspace() {
    loadedFiles = [];
    pageList = [];
    selectedPageIds.clear();
    if (selectionToolbar) selectionToolbar.style.display = 'none';
    nextFileId = 1;
    nextPageId = 1;
    pagesGrid.innerHTML = '';
    originalFileSize = 0;
    currentAppMode = null; // Return to Quick Actions Dashboard
    toggleLoading(false);
    showNotification('Workspace cleared.');
}

// FLIP Animation helper for smooth transitions when DOM order changes
function animateGridRearrange(actionFn) {
    const cards = Array.from(pagesGrid.querySelectorAll('.page-card'));
    
    // First: Record initial positions of all cards (except the one actively dragged)
    const positions = cards.map(card => {
        const rect = card.getBoundingClientRect();
        return {
            element: card,
            top: rect.top,
            left: rect.left
        };
    });
    
    // Execute the actual DOM modification
    actionFn();
    
    // Last & Invert: Compute deltas and apply inversion transform
    positions.forEach(pos => {
        // Skip animating the actively dragged card, as it is controlled by cursor
        if (pos.element.classList.contains('dragging')) return;
        
        const rect = pos.element.getBoundingClientRect();
        const deltaX = pos.left - rect.left;
        const deltaY = pos.top - rect.top;
        
        if (deltaX !== 0 || deltaY !== 0) {
            // Apply inverted position immediately with no transition
            pos.element.style.transition = 'none';
            pos.element.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
            
            // Force reflow
            pos.element.offsetHeight;
            
            // Play: Trigger transition to final position
            pos.element.style.transition = 'transform 0.4s cubic-bezier(0.25, 1, 0.35, 1)';
            pos.element.style.transform = '';
            
            // Clear styles once transition is done
            const onTransitionEnd = (e) => {
                if (e.propertyName === 'transform') {
                    pos.element.style.transition = '';
                    pos.element.removeEventListener('transitionend', onTransitionEnd);
                }
            };
            pos.element.addEventListener('transitionend', onTransitionEnd);
        }
    });
}

// Drag & Drop Sorting Logic
function handleDragStart(e) {
    this.classList.add('dragging');
    dragSourceEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.id);
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault(); // Necessary. Allows us to drop.
    }
    e.dataTransfer.dropEffect = 'move';

    if (dragSourceEl && dragSourceEl !== this) {
        const rect = this.getBoundingClientRect();
        // Determine mouse cursor position relative to the target card
        const relX = e.clientX - rect.left;
        const isPastHalfwayX = relX > rect.width / 2;

        const parent = this.parentNode;
        const siblings = Array.from(parent.children);
        const sourceIdx = siblings.indexOf(dragSourceEl);
        const targetIdx = siblings.indexOf(this);
        
        if (sourceIdx > -1 && targetIdx > -1) {
            // Dragging forward: only swap if cursor is past 50% midpoint of target
            if (sourceIdx < targetIdx) {
                if (isPastHalfwayX && this.nextSibling !== dragSourceEl) {
                    animateGridRearrange(() => {
                        parent.insertBefore(dragSourceEl, this.nextSibling);
                    });
                }
            } 
            // Dragging backward: only swap if cursor is before 50% midpoint of target
            else if (sourceIdx > targetIdx) {
                if (!isPastHalfwayX && this.previousSibling !== dragSourceEl) {
                    animateGridRearrange(() => {
                        parent.insertBefore(dragSourceEl, this);
                    });
                }
            }
        }
    }
    return false;
}

function handleDragEnter(e) {
    if (dragSourceEl !== this) {
        this.classList.add('dragover');
    }
}

function handleDragLeave(e) {
    this.classList.remove('dragover');
}

function handlePageDrop(e) {
    e.stopPropagation();
    e.preventDefault();
    return false;
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    const cards = document.querySelectorAll('.page-card');
    cards.forEach(card => card.classList.remove('dragover'));

    // Synchronize pageList state array order based on final DOM ordering
    const newPageList = [];
    const cardElements = pagesGrid.querySelectorAll('.page-card');
    cardElements.forEach(cardEl => {
        const pageItem = pageList.find(p => p.id === cardEl.id);
        if (pageItem) {
            newPageList.push(pageItem);
        }
    });

    pageList = newPageList;

    // Directly update navigation button states in-place instead of re-rendering all canvases
    updateCardNavigationButtons();
}

// Open Text Editor Modal
async function openTextEditor(pageId) {
    activeEditingPageId = pageId;
    const pageItem = pageList.find(p => p.id === pageId);
    const file = loadedFiles.find(f => f.id === pageItem.fileId);
    if (!pageItem || !file) return;

    // Update Page Navigation Sidebar Elements
    const currentIndex = pageList.findIndex(p => p.id === pageId);
    if (editorPageIndicator) {
        editorPageIndicator.textContent = `Page ${currentIndex + 1} of ${pageList.length}`;
    }
    if (editorPrevBtn) {
        editorPrevBtn.disabled = currentIndex === 0;
        editorPrevBtn.style.opacity = currentIndex === 0 ? '0.4' : '1';
        editorPrevBtn.style.cursor = currentIndex === 0 ? 'not-allowed' : 'pointer';
    }
    if (editorNextBtn) {
        editorNextBtn.disabled = currentIndex === pageList.length - 1;
        editorNextBtn.style.opacity = currentIndex === pageList.length - 1 ? '0.4' : '1';
        editorNextBtn.style.cursor = currentIndex === pageList.length - 1 ? 'not-allowed' : 'pointer';
    }

    editorModalTitle.textContent = `Edit Text — Page ${pageItem.originalPageNum} of ${file.name}`;
    editorModal.style.display = 'flex';
    editorLoading.style.display = 'flex';
    editorWorkspace.style.display = 'none';

    try {
        const pdfDoc = file.pdfDoc;
        const page = await pdfDoc.getPage(pageItem.originalPageNum);
        
        // Large render scale for visual accuracy in workspace
        currentViewport = page.getViewport({ scale: 1.5, rotation: pageItem.localRotation });
        
        editorCanvas.width = currentViewport.width;
        editorCanvas.height = currentViewport.height;
        
        editorWorkspace.style.width = `${currentViewport.width}px`;
        editorWorkspace.style.height = `${currentViewport.height}px`;
        
        const context = editorCanvas.getContext('2d');
        const renderContext = {
            canvasContext: context,
            viewport: currentViewport
        };
        await page.render(renderContext).promise;

        // Fetch text layout metadata
        const textContent = await page.getTextContent();
        currentTextContentItems = textContent.items;

        editorTextLayer.innerHTML = '';

        const existingEdits = pageItem.textEdits || [];

        currentTextContentItems.forEach((item, index) => {
            // Skip layout spacers or blank blocks
            if (!item.str || item.str.trim() === '') return;

            const transform = item.transform;
            
            // Convert page coordinates (0,0 bottom-left) to browser coordinates (top-left)
            const [x, y] = currentViewport.convertToViewportPoint(transform[4], transform[5]);
            
            // PDF font size is represented by vertical transform scale
            const fontSize = Math.abs(transform[3]) * 1.5;
            const width = item.width * 1.5;
            
            const textDiv = document.createElement('div');
            textDiv.className = 'editable-text-item';
            textDiv.contentEditable = 'true';
            textDiv.dataset.index = index;

            // Check if there was an existing edit
            const savedEdit = existingEdits.find(e => e.index === index);
            textDiv.textContent = savedEdit ? savedEdit.newText : item.str;

            if (savedEdit) {
                textDiv.classList.add('modified');
            }

            // Position CSS overlay (offset top by fontSize to align baseline with canvas)
            textDiv.style.left = `${x}px`;
            textDiv.style.top = `${y - fontSize}px`;
            textDiv.style.fontSize = `${fontSize}px`;
            textDiv.style.minWidth = `${Math.max(width, 15)}px`;

            // Apply font configurations if parsed
            const fontStyle = textContent.styles[item.fontName];
            if (fontStyle) {
                textDiv.style.fontFamily = fontStyle.fontFamily;
                
                // Generic style fallback mappings
                const nameLower = fontStyle.fontFamily.toLowerCase();
                if (nameLower.includes('sans')) {
                    textDiv.style.fontFamily = 'sans-serif';
                } else if (nameLower.includes('serif')) {
                    textDiv.style.fontFamily = 'serif';
                } else if (nameLower.includes('mono') || nameLower.includes('courier')) {
                    textDiv.style.fontFamily = 'monospace';
                }
            }

            // Bind change updates
            textDiv.addEventListener('input', () => {
                if (textDiv.textContent !== item.str) {
                    textDiv.classList.add('modified');
                } else {
                    textDiv.classList.remove('modified');
                }
            });

            editorTextLayer.appendChild(textDiv);
        });

        // Re-draw any manually added custom text boxes
        existingEdits.forEach(edit => {
            if (typeof edit.index === 'string' && edit.index.startsWith('new-')) {
                const [x, y] = currentViewport.convertToViewportPoint(edit.x, edit.y);
                const fontSize = edit.fontSize * 1.5;
                const width = edit.width * 1.5;

                const textDiv = document.createElement('div');
                textDiv.className = 'editable-text-item modified';
                textDiv.contentEditable = 'true';
                textDiv.dataset.index = edit.index;
                textDiv.dataset.xPdf = edit.x;
                textDiv.dataset.yPdf = edit.y;
                textDiv.dataset.fontSizePdf = edit.fontSize;

                textDiv.textContent = edit.newText;

                textDiv.style.left = `${x}px`;
                textDiv.style.top = `${y - fontSize}px`;
                textDiv.style.fontSize = `${fontSize}px`;
                textDiv.style.minWidth = `${Math.max(width, 15)}px`;
                textDiv.style.fontFamily = 'sans-serif';

                textDiv.addEventListener('input', () => {
                    textDiv.classList.add('modified');
                });

                editorTextLayer.appendChild(textDiv);
            }
        });

        editorLoading.style.display = 'none';
        editorWorkspace.style.display = 'block';

    } catch (err) {
        console.error('Error loading text editor page:', err);
        showNotification('Failed to render page for editing.', 'error');
        closeTextEditor();
    }
}

function closeTextEditor() {
    editorModal.style.display = 'none';
    activeEditingPageId = null;
    currentTextContentItems = [];
    currentViewport = null;
    editorTextLayer.innerHTML = '';
    disableAddTextMode();
}

function disableAddTextMode() {
    isAddingTextMode = false;
    if (editorWorkspace) editorWorkspace.style.cursor = 'default';
    if (editorModeStatus) editorModeStatus.style.display = 'none';
    if (editorAddTextBtn) editorAddTextBtn.classList.remove('active');
}

function handleWorkspaceClick(e) {
    if (!isAddingTextMode) return;
    
    // Ensure click is on background canvas or text layer, not on existing text items
    if (e.target !== editorCanvas && e.target !== editorWorkspace && e.target !== editorTextLayer) return;

    const rect = editorWorkspace.getBoundingClientRect();
    const x_view = e.clientX - rect.left;
    const y_view = e.clientY - rect.top;

    if (!currentViewport) return;
    const [x_pdf, y_pdf] = currentViewport.convertToPdfPoint(x_view, y_view);

    // Create a new text block
    const newIndex = `new-${Date.now()}`;
    const defaultFontSize = 14; 
    const fontSizeView = defaultFontSize * 1.5; 

    const newTextDiv = document.createElement('div');
    newTextDiv.className = 'editable-text-item modified';
    newTextDiv.contentEditable = 'true';
    newTextDiv.dataset.index = newIndex;
    newTextDiv.dataset.xPdf = x_pdf;
    newTextDiv.dataset.yPdf = y_pdf;
    newTextDiv.dataset.fontSizePdf = defaultFontSize;
    
    newTextDiv.textContent = 'New Text';

    // Position CSS overlay (offset top by fontSize to align baseline with canvas)
    newTextDiv.style.left = `${x_view}px`;
    newTextDiv.style.top = `${y_view - fontSizeView}px`;
    newTextDiv.style.fontSize = `${fontSizeView}px`;
    newTextDiv.style.minWidth = '80px';
    newTextDiv.style.fontFamily = 'sans-serif';

    // Bind change updates
    newTextDiv.addEventListener('input', () => {
        newTextDiv.classList.add('modified');
    });

    editorTextLayer.appendChild(newTextDiv);
    
    // Focus and select the text
    newTextDiv.focus();
    setTimeout(() => {
        const range = document.createRange();
        range.selectNodeContents(newTextDiv);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    }, 50);

    disableAddTextMode();
}

function navigatePage(direction) {
    if (!activeEditingPageId) return;
    const currentIndex = pageList.findIndex(p => p.id === activeEditingPageId);
    const targetIndex = currentIndex + direction;
    
    if (targetIndex >= 0 && targetIndex < pageList.length) {
        // Save current changes silently without closing the modal
        saveTextEdits(false);
        // Load target page
        openTextEditor(pageList[targetIndex].id);
    }
}

function editorRotateActivePage() {
    if (!activeEditingPageId) return;
    
    // Save current text entries first
    saveTextEdits(false);
    
    // Rotate page (increments state angle by 90 degrees and updates thumbnail card)
    rotatePage(activeEditingPageId);
    
    // Re-draw editor viewport canvas with new rotation
    openTextEditor(activeEditingPageId);
}

function editorDeleteActivePage() {
    if (!activeEditingPageId) return;
    
    if (!confirm("Are you sure you want to delete this page from the document?")) return;
    
    const currentIndex = pageList.findIndex(p => p.id === activeEditingPageId);
    const pageIdToDelete = activeEditingPageId;
    
    // Remove the page using standard workflow
    removePage(pageIdToDelete);
    
    // Select the next page to edit
    if (pageList.length === 0) {
        closeTextEditor();
    } else {
        const nextIndex = Math.min(currentIndex, pageList.length - 1);
        openTextEditor(pageList[nextIndex].id);
    }
}

// Save text edits made in modal
function saveTextEdits(shouldCloseModal = true) {
    const pageItem = pageList.find(p => p.id === activeEditingPageId);
    if (!pageItem) return;

    const edits = [];
    const editableEls = editorTextLayer.querySelectorAll('.editable-text-item');
    
    editableEls.forEach(el => {
        if (el.classList.contains('modified')) {
            const indexStr = el.dataset.index;
            const newText = el.textContent;
            
            if (typeof indexStr === 'string' && indexStr.startsWith('new-')) {
                const x = parseFloat(el.dataset.xPdf);
                const y = parseFloat(el.dataset.yPdf);
                const fontSize = parseFloat(el.dataset.fontSizePdf);
                
                edits.push({
                    index: indexStr,
                    originalText: "",
                    newText: newText,
                    x: x,
                    y: y,
                    width: el.offsetWidth / 1.5, // Convert viewport pixels back to PDF points
                    height: el.offsetHeight / 1.5,
                    fontSize: fontSize,
                    fontName: "Helvetica"
                });
            } else {
                const index = parseInt(indexStr, 10);
                const originalItem = currentTextContentItems[index];
                const transform = originalItem.transform;
                
                edits.push({
                    index: index,
                    originalText: originalItem.str,
                    newText: newText,
                    x: transform[4],
                    y: transform[5],
                    width: originalItem.width,
                    height: originalItem.height,
                    fontSize: Math.abs(transform[3]),
                    fontName: originalItem.fontName
                });
            }
        }
    });

    pageItem.textEdits = edits;
    
    // Update card info text (to reflect count of edits)
    const card = document.getElementById(pageItem.id);
    if (card) {
        const infoTag = card.querySelector('.page-info-tag');
        if (infoTag) {
            infoTag.textContent = `Page ${pageItem.originalPageNum}${edits.length > 0 ? ` (${edits.length} edits)` : ''}`;
        }
    }

    if (shouldCloseModal) {
        showNotification(`Applied ${edits.length} text modification(s) to Page ${pageItem.originalPageNum}`, 'success');
        closeTextEditor();
    }
}

// Shows the custom filename prompt modal and returns a promise resolving to the chosen filename
function promptFilename(defaultName) {
    return new Promise((resolve) => {
        const modal = document.getElementById('export-filename-modal');
        const input = document.getElementById('export-filename-input');
        const confirmBtn = document.getElementById('export-confirm-btn');
        const cancelBtn = document.getElementById('export-cancel-btn');
        
        if (!modal || !input || !confirmBtn || !cancelBtn) {
            resolve(defaultName);
            return;
        }
        
        // Remove old extension if present in defaultName
        const nameWithoutExt = defaultName.replace(/\.pdf$/i, '');
        input.value = nameWithoutExt;
        
        modal.style.display = 'flex';
        input.focus();
        input.select();
        
        const cleanup = () => {
            modal.style.display = 'none';
            // Remove event listeners to prevent memory leaks/duplicate resolves
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            input.removeEventListener('keydown', onKeyDown);
        };
        
        const onConfirm = () => {
            const val = input.value.trim() || nameWithoutExt;
            cleanup();
            resolve(val + '.pdf');
        };
        
        const onCancel = () => {
            cleanup();
            resolve(null); // Denotes cancellation
        };
        
        const onKeyDown = (e) => {
            if (e.key === 'Enter') {
                onConfirm();
            } else if (e.key === 'Escape') {
                onCancel();
            }
        };
        
        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
        input.addEventListener('keydown', onKeyDown);
    });
}

// Export and compile PDF with pdf-lib
async function exportPDF() {
    if (pageList.length === 0) {
        showNotification('No pages to export.', 'error');
        return;
    }

    // Determine default base name
    const baseName = loadedFiles.length > 0 ? loadedFiles[0].name.replace('.pdf', '') : 'privacy_pdf';
    let defaultFilename = '';
    if (currentAppMode === 'compress') {
        defaultFilename = `${baseName}_compressed.pdf`;
    } else {
        defaultFilename = `${baseName}_compiled.pdf`;
    }

    // Prompt for file name
    const filename = await promptFilename(defaultFilename);
    if (!filename) return; // User canceled

    toggleLoading(true, 'Assembling your compiled PDF locally...');

    try {
        const mergedPdf = await PDFLib.PDFDocument.create();
        
        if (currentAppMode === 'compress') {
            let pageIndex = 1;
            for (const pageItem of pageList) {
                toggleLoading(true, `Compressing page ${pageIndex} of ${pageList.length}...`);
                
                const file = loadedFiles.find(f => f.id === pageItem.fileId);
                if (!file) throw new Error(`Source file data not found for file ID: ${pageItem.fileId}`);
                
                const page = await file.pdfDoc.getPage(pageItem.originalPageNum);
                
                // Create offscreen canvas for page rendering
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                
                // Adjust scale resolution dynamically based on quality configuration (ranging from 0.7x to 2.0x scale)
                let renderScale = 0.7 + (compressionQuality - 0.1) * 1.625;
                
                const viewport = page.getViewport({ 
                    scale: renderScale, 
                    rotation: (page.rotation + pageItem.localRotation) % 360 
                });
                
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                
                const renderContext = {
                    canvasContext: context,
                    viewport: viewport
                };
                await page.render(renderContext).promise;
                
                // Get compressed JPG data url and convert to bytes
                const dataUrl = canvas.toDataURL('image/jpeg', compressionQuality);
                const base64Data = dataUrl.split(',')[1];
                const jpgBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                
                const jpgImage = await mergedPdf.embedJpg(jpgBytes);
                
                // Create a page with the target dimensions
                const origViewport = page.getViewport({ 
                    scale: 1.0, 
                    rotation: (page.rotation + pageItem.localRotation) % 360 
                });
                const newPage = mergedPdf.addPage([origViewport.width, origViewport.height]);
                
                newPage.drawImage(jpgImage, {
                    x: 0,
                    y: 0,
                    width: origViewport.width,
                    height: origViewport.height
                });
                
                pageIndex++;
            }
        } else {
            // Cache parsed documents so we don't reload bytes repeatedly
            const docCache = {};
            
            for (const pageItem of pageList) {
                // Check if document is cached
                if (!docCache[pageItem.fileId]) {
                    const file = loadedFiles.find(f => f.id === pageItem.fileId);
                    if (!file) throw new Error(`Source file data not found for file ID: ${pageItem.fileId}`);
                    docCache[pageItem.fileId] = await PDFLib.PDFDocument.load(file.data);
                }
                
                const sourceDoc = docCache[pageItem.fileId];
                
                // Copy target page into new document
                const [copiedPage] = await mergedPdf.copyPages(sourceDoc, [pageItem.originalPageNum - 1]);
                
                // Apply text modifications if they exist
                if (pageItem.textEdits && pageItem.textEdits.length > 0) {
                    for (const edit of pageItem.textEdits) {
                        // Calculate safety margins for whiteout box
                        const safetyMarginX = 3;
                        const safetyMarginY = edit.fontSize * 0.35; // Cover descenders (g, y, p, q)
                        const boxWidth = (edit.width || (edit.fontSize * (edit.originalText || '').length * 0.65)) + (safetyMarginX * 2);
                        const boxHeight = (edit.height || edit.fontSize) * 1.45; // 145% height to cover all ascenders/descenders
    
                        // 1. Draw a whiteout rectangle over the original text bounding box (with safety padding)
                        copiedPage.drawRectangle({
                            x: edit.x - safetyMarginX,
                            y: edit.y - safetyMarginY,
                            width: boxWidth,
                            height: boxHeight,
                            color: PDFLib.rgb(1, 1, 1), // Solid white
                        });
    
                        // 2. Resolve matching standard font (embedded client-side)
                        let fontToUse = await mergedPdf.embedFont(PDFLib.StandardFonts.Helvetica);
                        const fontNameLower = (edit.fontName || '').toLowerCase();
                        
                        if (fontNameLower.includes('bold')) {
                            if (fontNameLower.includes('serif') || fontNameLower.includes('times')) {
                                fontToUse = await mergedPdf.embedFont(PDFLib.StandardFonts.TimesRomanBold);
                            } else if (fontNameLower.includes('mono') || fontNameLower.includes('courier')) {
                                fontToUse = await mergedPdf.embedFont(PDFLib.StandardFonts.CourierBold);
                            } else {
                                fontToUse = await mergedPdf.embedFont(PDFLib.StandardFonts.HelveticaBold);
                            }
                        } else if (fontNameLower.includes('italic') || fontNameLower.includes('oblique')) {
                            if (fontNameLower.includes('serif') || fontNameLower.includes('times')) {
                                fontToUse = await mergedPdf.embedFont(PDFLib.StandardFonts.TimesRomanItalic);
                            } else if (fontNameLower.includes('mono') || fontNameLower.includes('courier')) {
                                fontToUse = await mergedPdf.embedFont(PDFLib.StandardFonts.CourierOblique);
                            } else {
                                fontToUse = await mergedPdf.embedFont(PDFLib.StandardFonts.HelveticaOblique);
                            }
                        } else {
                            if (fontNameLower.includes('serif') || fontNameLower.includes('times')) {
                                fontToUse = await mergedPdf.embedFont(PDFLib.StandardFonts.TimesRoman);
                            } else if (fontNameLower.includes('mono') || fontNameLower.includes('courier')) {
                                fontToUse = await mergedPdf.embedFont(PDFLib.StandardFonts.Courier);
                            } else {
                                fontToUse = await mergedPdf.embedFont(PDFLib.StandardFonts.Helvetica);
                            }
                        }
    
                        // 3. Draw new font-matched text at exact original coordinates
                        copiedPage.drawText(edit.newText, {
                            x: edit.x,
                            y: edit.y,
                            size: edit.fontSize,
                            font: fontToUse,
                            color: PDFLib.rgb(0, 0, 0), // Black text
                        });
                    }
                }
    
                // Apply original page rotation plus local rotation additions
                const currentRotationAngle = copiedPage.getRotation().angle;
                const newRotation = (currentRotationAngle + pageItem.localRotation) % 360;
                copiedPage.setRotation(PDFLib.degrees(newRotation));
    
                // Apply Watermark if in watermark mode
                if (currentAppMode === 'watermark' && watermarkConfig.text) {
                    const { width, height } = copiedPage.getSize();
                    const wmFont = await mergedPdf.embedFont(PDFLib.StandardFonts.HelveticaBold);
                    
                    // Parse hex color to RGB
                    const hex = watermarkConfig.color.replace('#', '');
                    const r = parseInt(hex.substring(0, 2), 16) / 255;
                    const g = parseInt(hex.substring(2, 4), 16) / 255;
                    const b = parseInt(hex.substring(4, 6), 16) / 255;
                    
                    // Let's draw the watermark centered on the page
                    const textWidth = wmFont.widthOfTextAtSize(watermarkConfig.text, watermarkConfig.size);
                    const textHeight = watermarkConfig.size;
                    
                    // Calculate diagonal placement coordinates
                    const rad = (watermarkConfig.rotation * Math.PI) / 180;
                    
                    // Center coordinate of the page
                    const centerX = width / 2;
                    const centerY = height / 2;
                    
                    // Offset the start coordinates to rotate around center of text
                    const offsetX = (textWidth / 2) * Math.cos(rad) - (textHeight / 2) * Math.sin(rad);
                    const offsetY = (textWidth / 2) * Math.sin(rad) + (textHeight / 2) * Math.cos(rad);
                    
                    copiedPage.drawText(watermarkConfig.text, {
                        x: centerX - offsetX,
                        y: centerY - offsetY,
                        size: watermarkConfig.size,
                        font: wmFont,
                        color: PDFLib.rgb(r, g, b),
                        opacity: watermarkConfig.opacity,
                        rotate: PDFLib.degrees(watermarkConfig.rotation),
                    });
                }
    
                // Apply Page Numbers if in pagenum mode
                if (currentAppMode === 'pagenum') {
                    const { width, height } = copiedPage.getSize();
                    const pnFont = await mergedPdf.embedFont(PDFLib.StandardFonts.Helvetica);
                    
                    const hex = pageNumConfig.color.replace('#', '');
                    const r = parseInt(hex.substring(0, 2), 16) / 255;
                    const g = parseInt(hex.substring(2, 4), 16) / 255;
                    const b = parseInt(hex.substring(4, 6), 16) / 255;
                    
                    let text = '';
                    const pageNum = pageList.indexOf(pageItem) + 1;
                    const totalPages = pageList.length;
                    
                    if (pageNumConfig.format === 'simple') {
                        text = `${pageNum}`;
                    } else if (pageNumConfig.format === 'prefix') {
                        text = `Page ${pageNum}`;
                    } else if (pageNumConfig.format === 'total') {
                        text = `Page ${pageNum} of ${totalPages}`;
                    }
                    
                    const textWidth = pnFont.widthOfTextAtSize(text, pageNumConfig.size);
                    
                    let x = width / 2 - textWidth / 2; // Default: center
                    let y = 30; // Default: bottom
                    
                    // X position
                    if (pageNumConfig.position.includes('right')) {
                        x = width - textWidth - 40;
                    } else if (pageNumConfig.position.includes('left')) {
                        x = 40;
                    }
                    
                    // Y position
                    if (pageNumConfig.position.includes('top')) {
                        y = height - 45;
                    }
                    
                    copiedPage.drawText(text, {
                        x: x,
                        y: y,
                        size: pageNumConfig.size,
                        font: pnFont,
                        color: PDFLib.rgb(r, g, b),
                    });
                }
    
                mergedPdf.addPage(copiedPage);
            }
        }
        
        const mergedPdfBytes = await mergedPdf.save();
        const finalSize = mergedPdfBytes.length;
        
        // Generate download action
        const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        currentDownloadUrl = url;
        
        // Show premium download receipt and launch confetti! (User initiates download manually from modal)
        triggerCompilationCelebration(filename, pageList.length, originalFileSize, finalSize);
    } catch (err) {
        console.error('Error during PDF compile:', err);
        showNotification('Error compiling PDF file. Please try again.', 'error');
    } finally {
        toggleLoading(false);
    }
}

async function extractSelectedPages() {
    if (selectedPageIds.size === 0) {
        showNotification('Please select one or more pages to extract.', 'error');
        return;
    }

    // Determine default base name
    const baseName = loadedFiles.length > 0 ? loadedFiles[0].name.replace('.pdf', '') : 'privacy_pdf';
    const defaultFilename = `${baseName}_extracted.pdf`;

    // Prompt for file name
    const filename = await promptFilename(defaultFilename);
    if (!filename) return; // User canceled

    toggleLoading(true, 'Extracting selected pages...');

    try {
        const extractedPdf = await PDFLib.PDFDocument.create();
        const docCache = {};

        // Filter pageList to contain only selected pages
        const selectedPages = pageList.filter(p => selectedPageIds.has(p.id));

        for (const pageItem of selectedPages) {
            // Check cache
            if (!docCache[pageItem.fileId]) {
                const file = loadedFiles.find(f => f.id === pageItem.fileId);
                if (!file) throw new Error(`Source file data not found for file ID: ${pageItem.fileId}`);
                docCache[pageItem.fileId] = await PDFLib.PDFDocument.load(file.data);
            }

            const sourceDoc = docCache[pageItem.fileId];
            const [copiedPage] = await extractedPdf.copyPages(sourceDoc, [pageItem.originalPageNum - 1]);

            // Apply text modifications if they exist
            if (pageItem.textEdits && pageItem.textEdits.length > 0) {
                for (const edit of pageItem.textEdits) {
                    const safetyMarginX = 3;
                    const safetyMarginY = edit.fontSize * 0.35;
                    const boxWidth = (edit.width || (edit.fontSize * (edit.originalText || '').length * 0.65)) + (safetyMarginX * 2);
                    const boxHeight = (edit.height || edit.fontSize) * 1.45;

                    copiedPage.drawRectangle({
                        x: edit.x - safetyMarginX,
                        y: edit.y - safetyMarginY,
                        width: boxWidth,
                        height: boxHeight,
                        color: PDFLib.rgb(1, 1, 1),
                    });

                    let fontToUse = await extractedPdf.embedFont(PDFLib.StandardFonts.Helvetica);
                    const fontNameLower = (edit.fontName || '').toLowerCase();
                    
                    if (fontNameLower.includes('bold')) {
                        if (fontNameLower.includes('serif') || fontNameLower.includes('times')) {
                            fontToUse = await extractedPdf.embedFont(PDFLib.StandardFonts.TimesRomanBold);
                        } else if (fontNameLower.includes('mono') || fontNameLower.includes('courier')) {
                            fontToUse = await extractedPdf.embedFont(PDFLib.StandardFonts.CourierBold);
                        } else {
                            fontToUse = await extractedPdf.embedFont(PDFLib.StandardFonts.HelveticaBold);
                        }
                    } else if (fontNameLower.includes('italic') || fontNameLower.includes('oblique')) {
                        if (fontNameLower.includes('serif') || fontNameLower.includes('times')) {
                            fontToUse = await extractedPdf.embedFont(PDFLib.StandardFonts.TimesRomanItalic);
                        } else if (fontNameLower.includes('mono') || fontNameLower.includes('courier')) {
                            fontToUse = await extractedPdf.embedFont(PDFLib.StandardFonts.CourierOblique);
                        } else {
                            fontToUse = await extractedPdf.embedFont(PDFLib.StandardFonts.HelveticaOblique);
                        }
                    } else {
                        if (fontNameLower.includes('serif') || fontNameLower.includes('times')) {
                            fontToUse = await extractedPdf.embedFont(PDFLib.StandardFonts.TimesRoman);
                        } else if (fontNameLower.includes('mono') || fontNameLower.includes('courier')) {
                            fontToUse = await extractedPdf.embedFont(PDFLib.StandardFonts.Courier);
                        } else {
                            fontToUse = await extractedPdf.embedFont(PDFLib.StandardFonts.Helvetica);
                        }
                    }

                    copiedPage.drawText(edit.newText, {
                        x: edit.x,
                        y: edit.y,
                        size: edit.fontSize,
                        font: fontToUse,
                        color: PDFLib.rgb(0, 0, 0),
                    });
                }
            }

            // Apply original page rotation plus local rotation additions
            const currentRotationAngle = copiedPage.getRotation().angle;
            const newRotation = (currentRotationAngle + pageItem.localRotation) % 360;
            copiedPage.setRotation(PDFLib.degrees(newRotation));

            // Apply Watermark if in watermark mode
            if (currentAppMode === 'watermark' && watermarkConfig.text) {
                const { width, height } = copiedPage.getSize();
                const wmFont = await extractedPdf.embedFont(PDFLib.StandardFonts.HelveticaBold);
                
                // Parse hex color to RGB
                const hex = watermarkConfig.color.replace('#', '');
                const r = parseInt(hex.substring(0, 2), 16) / 255;
                const g = parseInt(hex.substring(2, 4), 16) / 255;
                const b = parseInt(hex.substring(4, 6), 16) / 255;
                
                // Draw centered
                const textWidth = wmFont.widthOfTextAtSize(watermarkConfig.text, watermarkConfig.size);
                const textHeight = watermarkConfig.size;
                const rad = (watermarkConfig.rotation * Math.PI) / 180;
                
                const centerX = width / 2;
                const centerY = height / 2;
                
                const offsetX = (textWidth / 2) * Math.cos(rad) - (textHeight / 2) * Math.sin(rad);
                const offsetY = (textWidth / 2) * Math.sin(rad) + (textHeight / 2) * Math.cos(rad);
                
                copiedPage.drawText(watermarkConfig.text, {
                    x: centerX - offsetX,
                    y: centerY - offsetY,
                    size: watermarkConfig.size,
                    font: wmFont,
                    color: PDFLib.rgb(r, g, b),
                    opacity: watermarkConfig.opacity,
                    rotate: PDFLib.degrees(watermarkConfig.rotation),
                });
            }

            // Apply Page Numbers if in pagenum mode
            if (currentAppMode === 'pagenum') {
                const { width, height } = copiedPage.getSize();
                const pnFont = await extractedPdf.embedFont(PDFLib.StandardFonts.Helvetica);
                
                const hex = pageNumConfig.color.replace('#', '');
                const r = parseInt(hex.substring(0, 2), 16) / 255;
                const g = parseInt(hex.substring(2, 4), 16) / 255;
                const b = parseInt(hex.substring(4, 6), 16) / 255;
                
                let text = '';
                const pageNum = selectedPages.indexOf(pageItem) + 1;
                const totalPages = selectedPages.length;
                
                if (pageNumConfig.format === 'simple') {
                    text = `${pageNum}`;
                } else if (pageNumConfig.format === 'prefix') {
                    text = `Page ${pageNum}`;
                } else if (pageNumConfig.format === 'total') {
                    text = `Page ${pageNum} of ${totalPages}`;
                }
                
                const textWidth = pnFont.widthOfTextAtSize(text, pageNumConfig.size);
                
                let x = width / 2 - textWidth / 2;
                let y = 30;
                
                if (pageNumConfig.position.includes('right')) {
                    x = width - textWidth - 40;
                } else if (pageNumConfig.position.includes('left')) {
                    x = 40;
                }
                
                if (pageNumConfig.position.includes('top')) {
                    y = height - 45;
                }
                
                copiedPage.drawText(text, {
                    x: x,
                    y: y,
                    size: pageNumConfig.size,
                    font: pnFont,
                    color: PDFLib.rgb(r, g, b),
                });
            }

            extractedPdf.addPage(copiedPage);
        }

        const extractedPdfBytes = await extractedPdf.save();
        
        // Generate download action
        const blob = new Blob([extractedPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        currentDownloadUrl = url;
        
        // Show premium download receipt and launch confetti! (User initiates download manually from modal)
        triggerCompilationCelebration(filename, selectedPages.length, 0, extractedPdfBytes.length);
    } catch (err) {
        console.error('Error during PDF extraction:', err);
        showNotification('Error extracting selected pages. Please try again.', 'error');
    } finally {
        toggleLoading(false);
    }
}

// UI Modals and Dialog actions
function showModal(show) {
    privacyModal.style.display = show ? 'flex' : 'none';
}

// Notification Toasts
function showNotification(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `notification ${type}`;
    
    const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${message}</span>
    `;

    notificationContainer.appendChild(toast);

    // Slide up and fade out after 3.5 seconds
    setTimeout(() => {
        toast.style.transition = 'all 0.5s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px) scale(0.9)';
        setTimeout(() => toast.remove(), 500);
    }, 3500);
}

// Confetti System
class ConfettiManager {
    constructor() {
        this.canvas = document.getElementById('confetti-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.active = false;
        this.colors = ['#fb8500', '#22c55e', '#3b82f6', '#ec4899', '#eab308', '#a855f7'];
        this.heartColors = ['#ff4d6d', '#ff758f', '#ff85a1', '#f72585', '#e63946', '#ff0a54'];
        
        window.addEventListener('resize', () => {
            if (this.active) {
                this.canvas.width = window.innerWidth;
                this.canvas.height = window.innerHeight;
            }
        });
    }

    start(isHeart = false) {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.canvas.style.display = 'block';
        this.particles = [];
        this.active = true;

        // Generate initial explosion of particles from left and right corners
        const pCount = isHeart ? 90 : 75;
        for (let i = 0; i < pCount; i++) {
            this.particles.push(this.createParticle(0, window.innerHeight, 55, isHeart));  // Left side
            this.particles.push(this.createParticle(window.innerWidth, window.innerHeight, 125, isHeart)); // Right side
        }

        requestAnimationFrame(() => this.update());
        
        // Stop generating after 4 seconds
        setTimeout(() => {
            this.active = false;
            setTimeout(() => {
                this.canvas.style.display = 'none';
            }, 1000);
        }, 3500);
    }

    createParticle(x, y, angleDeg, isHeart = false) {
        const angleRad = (angleDeg + (Math.random() * 30 - 15)) * Math.PI / 180;
        const speed = isHeart ? (10 + Math.random() * 12) : (12 + Math.random() * 14);
        return {
            x: x,
            y: y,
            vx: Math.cos(angleRad) * speed,
            vy: -Math.sin(angleRad) * speed,
            size: isHeart ? (10 + Math.random() * 12) : (6 + Math.random() * 8),
            color: isHeart ? this.heartColors[Math.floor(Math.random() * this.heartColors.length)] : this.colors[Math.floor(Math.random() * this.colors.length)],
            rotation: Math.random() * 360,
            rotationSpeed: isHeart ? (Math.random() * 4 - 2) : (Math.random() * 8 - 4),
            opacity: 1,
            isHeart: isHeart
        };
    }

    update() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            
            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.isHeart ? 0.35 : 0.45; // Gravity acceleration
            p.vx *= 0.985; // Air friction resistance
            p.rotation += p.rotationSpeed;
            p.opacity -= p.isHeart ? 0.005 : 0.007; // Fade out slowly

            if (p.opacity <= 0 || p.y > this.canvas.height) {
                this.particles.splice(i, 1);
                continue;
            }

            this.ctx.save();
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate(p.rotation * Math.PI / 180);
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = p.opacity;
            
            if (p.isHeart) {
                // Draw heart shape
                this.ctx.beginPath();
                const d = p.size;
                this.ctx.moveTo(0, 0);
                // Left curve
                this.ctx.bezierCurveTo(-d/2, -d/2, -d, d/3, 0, d);
                // Right curve
                this.ctx.bezierCurveTo(d, d/3, d/2, -d/2, 0, 0);
                this.ctx.closePath();
                this.ctx.fill();
            } else {
                // Draw rectangle particle
                this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
            }
            this.ctx.restore();
        }

        if (this.active || this.particles.length > 0) {
            requestAnimationFrame(() => this.update());
        }
    }
}

const confettiManager = new ConfettiManager();

// Success Receipt Modal handlers
const successModal = document.getElementById('success-modal');
const successDownloadBtn = document.getElementById('success-download-btn');
const successCloseBtn = document.getElementById('success-close-btn');
const receiptFilename = document.getElementById('receipt-filename');
const receiptPages = document.getElementById('receipt-pages');
const receiptOrigRow = document.getElementById('receipt-orig-row');
const receiptOrigSize = document.getElementById('receipt-orig-size');
const receiptFinalSize = document.getElementById('receipt-final-size');
const receiptSavingsRow = document.getElementById('receipt-savings-row');
const receiptSavings = document.getElementById('receipt-savings');

let lastCompiledBlobUrl = null;
let lastCompiledFilename = '';

if (successDownloadBtn) {
    successDownloadBtn.addEventListener('click', () => {
        if (lastCompiledBlobUrl) {
            const link = document.createElement('a');
            link.href = lastCompiledBlobUrl;
            link.download = lastCompiledFilename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showNotification('Downloaded PDF successfully!', 'success');
        }
    });
}

if (successCloseBtn) {
    successCloseBtn.addEventListener('click', () => {
        successModal.style.display = 'none';
    });
}

// Global function to trigger compilation celebrations
function triggerCompilationCelebration(filename, pagesCount, originalBytes, finalBytes) {
    if (!successModal) return;
    
    // Revoke old blob URL to avoid leak if we compiled before
    if (lastCompiledBlobUrl && lastCompiledBlobUrl !== currentDownloadUrl) {
        URL.revokeObjectURL(lastCompiledBlobUrl);
    }
    
    lastCompiledFilename = filename;
    lastCompiledBlobUrl = currentDownloadUrl; // from global URL in exportPDF
    
    // Set receipt details
    receiptFilename.textContent = filename;
    receiptPages.textContent = pagesCount;
    receiptFinalSize.textContent = formatBytes(finalBytes);
    
    if (currentAppMode === 'compress') {
        receiptOrigRow.style.display = 'flex';
        receiptSavingsRow.style.display = 'flex';
        
        receiptOrigSize.textContent = formatBytes(originalBytes);
        const pct = Math.round((1 - finalBytes / originalBytes) * 100);
        receiptSavings.textContent = `${pct}% smaller`;
    } else {
        receiptOrigRow.style.display = 'none';
        receiptSavingsRow.style.display = 'none';
    }
    
    // Open Modal and trigger Confetti
    successModal.style.display = 'flex';
    confettiManager.start(false);
}

// ==========================================
// SECRET LOVE EASTER EGG (Divi ❤️)
// ==========================================
const loveEasterEggModal = document.getElementById('love-easter-egg-modal');
const loveCloseBtn = document.getElementById('love-close-btn');

let loveKeysTyped = '';
document.addEventListener('keydown', (e) => {
    // Prevent trigger when typing in inputs/textareas
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
        return;
    }
    
    // Track last 4 chars
    loveKeysTyped += e.key.toLowerCase();
    if (loveKeysTyped.length > 4) {
        loveKeysTyped = loveKeysTyped.substring(loveKeysTyped.length - 4);
    }
    
    if (loveKeysTyped === 'divi') {
        triggerLoveEasterEgg(true);
        loveKeysTyped = '';
    }
});

if (loveCloseBtn) {
    loveCloseBtn.addEventListener('click', () => {
        if (loveEasterEggModal) {
            loveEasterEggModal.style.display = 'none';
        }
    });
}

if (loveEasterEggModal) {
    loveEasterEggModal.addEventListener('click', (e) => {
        if (e.target === loveEasterEggModal) {
            loveEasterEggModal.style.display = 'none';
        }
    });
}

function triggerLoveEasterEgg(shouldLog = false) {
    if (!loveEasterEggModal) return;
    
    // Show modal
    loveEasterEggModal.style.display = 'flex';
    
    // Start pink/red hearts confetti
    confettiManager.start(true);
    
    // Send a subtle console message only if typed "divi"
    if (shouldLog) {
        console.log("%cDivi ❤️ Shiv", "color: #ff0a54; font-size: 24px; font-weight: bold; font-family: sans-serif;");
    }
}
