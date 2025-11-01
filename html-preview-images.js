// /ui/html-preview-images/html-preview-images.js

(function() {
  'use strict';

  class HtmlPreviewImagesManager {
    constructor() {
      this.modal = null;
      this.images = [];
      this.selectedImage = null;
      this.onInsertCallback = null;
    }

    open(onInsert) {
      this.onInsertCallback = onInsert;
      this.loadImages();
      this.createModal();
    }

    createModal() {
      const overlay = document.createElement('div');
      overlay.className = 'html-images-modal-overlay';

      const modal = document.createElement('div');
      modal.className = 'html-images-modal';

      const header = document.createElement('div');
      header.className = 'html-images-modal-header';
      header.innerHTML = `
        <h3>🖼️ Управление изображениями</h3>
        <button class="close-btn" type="button">&times;</button>
      `;

      const content = document.createElement('div');
      content.className = 'html-images-modal-content';

      // Зона загрузки
      const uploadZone = document.createElement('div');
      uploadZone.className = 'html-images-upload-zone';
      uploadZone.innerHTML = `
        <div class="html-images-upload-icon">📤</div>
        <div class="html-images-upload-text">Перетащите изображения сюда или нажмите для выбора</div>
        <div class="html-images-upload-hint">PNG, JPG, GIF, WEBP до 5 МБ</div>
        <input type="file" class="html-images-upload-input" accept="image/*" multiple />
      `;

      // Галерея изображений
      const gallery = document.createElement('div');
      gallery.className = 'html-images-gallery';
      gallery.id = 'htmlImagesGallery';

      content.appendChild(uploadZone);
      content.appendChild(gallery);

      const footer = document.createElement('div');
      footer.className = 'html-images-modal-footer';
      footer.innerHTML = `
        <div class="html-images-modal-footer-info">
          <span id="imagesCount">0</span> изображений
        </div>
        <div class="html-images-modal-footer-actions">
          <button class="html-images-btn danger" type="button">❌ Отмена</button>
          <button class="html-images-btn primary" type="button" id="insertImageBtn" disabled>✅ Вставить код</button>
        </div>
      `;

      modal.appendChild(header);
      modal.appendChild(content);
      modal.appendChild(footer);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      this.modal = overlay;
      this.gallery = gallery;
      this.uploadZone = uploadZone;
      this.uploadInput = uploadZone.querySelector('.html-images-upload-input');
      this.insertBtn = footer.querySelector('#insertImageBtn');

      this.attachEventListeners();
      this.renderGallery();
    }

    attachEventListeners() {
      // Закрытие модалки
      this.modal.querySelector('.close-btn').addEventListener('click', () => this.close());
      this.modal.querySelector('.html-images-btn.danger').addEventListener('click', () => this.close());
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) this.close();
      });

      // Загрузка через клик
      this.uploadZone.addEventListener('click', (e) => {
        if (!e.target.closest('.html-images-gallery-item')) {
          this.uploadInput.click();
        }
      });

      this.uploadInput.addEventListener('change', (e) => {
        this.handleFileSelect(e.target.files);
      });

      // Drag & Drop
      this.uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.uploadZone.classList.add('dragover');
      });

      this.uploadZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.uploadZone.classList.remove('dragover');
      });

      this.uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.uploadZone.classList.remove('dragover');
        this.handleFileSelect(e.dataTransfer.files);
      });

      // Вставка изображения
      this.insertBtn.addEventListener('click', () => {
        if (this.selectedImage) {
          this.insertImageCode();
        }
      });
    }

    handleFileSelect(files) {
      if (!files || files.length === 0) return;

      this.uploadZone.classList.add('uploading');
      
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('images[]', files[i]);
      }

      fetch('/ui/html-preview-images/upload-handler.php', {
        method: 'POST',
        body: formData
      })
      .then(response => response.json())
      .then(data => {
        if (data.ok) {
          this.loadImages();
        } else {
          alert('Ошибка загрузки: ' + (data.error || 'Неизвестная ошибка'));
        }
      })
      .catch(error => {
        console.error('Upload error:', error);
        alert('Ошибка загрузки изображений');
      })
      .finally(() => {
        this.uploadZone.classList.remove('uploading');
        this.uploadInput.value = '';
      });
    }

    loadImages() {
      fetch('/ui/html-preview-images/upload-handler.php?action=list')
        .then(response => response.json())
        .then(data => {
          if (data.ok) {
            this.images = data.images || [];
            this.renderGallery();
            this.updateCounter();
          }
        })
        .catch(error => {
          console.error('Load images error:', error);
        });
    }

    renderGallery() {
      if (!this.gallery) return;

      this.gallery.innerHTML = '';

      if (this.images.length === 0) {
        this.gallery.innerHTML = `
          <div class="html-images-empty" style="grid-column: 1 / -1;">
            <div class="html-images-empty-icon">🖼️</div>
            <div class="html-images-empty-text">Нет загруженных изображений</div>
          </div>
        `;
        return;
      }

      this.images.forEach(image => {
        const item = document.createElement('div');
        item.className = 'html-images-gallery-item';
        if (this.selectedImage && this.selectedImage.filename === image.filename) {
          item.classList.add('selected');
        }

        item.innerHTML = `
          <img src="${image.url}" alt="${image.filename}" loading="lazy" />
          <div class="html-images-gallery-item-actions">
            <button class="html-images-gallery-item-btn copy" title="Копировать URL" data-filename="${image.filename}">📋</button>
            <button class="html-images-gallery-item-btn delete" title="Удалить" data-filename="${image.filename}">🗑️</button>
          </div>
          <div class="html-images-gallery-item-name">${image.filename}</div>
        `;

        // Выбор изображения
        item.addEventListener('click', (e) => {
          if (!e.target.closest('.html-images-gallery-item-btn')) {
            this.selectImage(image);
          }
        });

        // Копирование URL
        const copyBtn = item.querySelector('.copy');
        copyBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.copyImageUrl(image.url);
        });

        // Удаление изображения
        const deleteBtn = item.querySelector('.delete');
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteImage(image.filename);
        });

        this.gallery.appendChild(item);
      });
    }

    selectImage(image) {
      this.selectedImage = image;
      this.renderGallery();
      this.insertBtn.disabled = false;
    }

    copyImageUrl(url) {
      navigator.clipboard.writeText(url)
        .then(() => {
          // Можно добавить временное уведомление
          console.log('URL скопирован:', url);
        })
        .catch(err => {
          console.error('Ошибка копирования:', err);
        });
    }

    deleteImage(filename) {
      if (!confirm('Удалить изображение?')) return;

      fetch('/ui/html-preview-images/upload-handler.php?action=delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ filename: filename })
      })
      .then(response => response.json())
      .then(data => {
        if (data.ok) {
          if (this.selectedImage && this.selectedImage.filename === filename) {
            this.selectedImage = null;
            this.insertBtn.disabled = true;
          }
          this.loadImages();
        } else {
          alert('Ошибка удаления: ' + (data.error || 'Неизвестная ошибка'));
        }
      })
      .catch(error => {
        console.error('Delete error:', error);
        alert('Ошибка удаления изображения');
      });
    }

    insertImageCode() {
      if (!this.selectedImage || !this.onInsertCallback) return;

      const imgTag = `<img src="${this.selectedImage.url}" alt="${this.selectedImage.filename.replace(/\.[^.]+$/, '')}" style="max-width: 100%; height: auto;" />`;

      this.onInsertCallback(imgTag);
      this.close();
    }

    updateCounter() {
      const counter = document.getElementById('imagesCount');
      if (counter) {
        counter.textContent = this.images.length;
      }
    }

    close() {
      if (this.modal) {
        this.modal.remove();
        this.modal = null;
      }
    }
  }

  window.HtmlPreviewImagesManager = HtmlPreviewImagesManager;
})();