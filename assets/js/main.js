(function () {
    var themeToggles = document.querySelectorAll('[data-theme-toggle]');
    var header = document.querySelector('[data-site-header]');
    var menuToggle = document.querySelector('[data-menu-toggle]');
    var mobileMenu = document.querySelector('[data-mobile-menu]');
    var desktopQuery = window.matchMedia('(min-width: 768px)');
    var menuTimer;
    var authorInitials = document.querySelectorAll('[data-author-initials]');
    var progressiveObserver;
    var contentTogglesReady = false;

    function firstUsableImage(root) {
        if (!root) {
            return null;
        }

        return Array.from(root.querySelectorAll('img')).find(function (image) {
            return image.getAttribute('src') && !image.closest('.kg-gallery-card, .kg-bookmark-card, .kg-product-card, .kg-file-card, .kg-audio-card');
        });
    }

    function promotedClone(image, className, fallbackAlt) {
        var clone = image.cloneNode(true);

        if (className) {
            clone.classList.add(className);
        }

        if (!clone.getAttribute('alt') && fallbackAlt) {
            clone.setAttribute('alt', fallbackAlt);
        }

        clone.loading = 'lazy';
        clone.decoding = 'async';

        return clone;
    }

    function markProgressiveLoaded(image) {
        var frame = image.closest('.progressive-image');

        image.classList.add('is-loaded');

        if (frame) {
            frame.classList.add('is-loaded');
        }
    }

    function loadProgressiveImage(image) {
        var fullSource = image.getAttribute('data-progressive-src');

        image.classList.add('progressive-image-img');

        if (fullSource && image.getAttribute('src') !== fullSource) {
            image.addEventListener('load', function () {
                markProgressiveLoaded(image);
            }, {once: true});

            image.src = fullSource;
            image.removeAttribute('data-progressive-src');
            return;
        }

        if (image.complete && image.naturalWidth) {
            markProgressiveLoaded(image);
            return;
        }

        image.addEventListener('load', function () {
            markProgressiveLoaded(image);
        }, {once: true});
    }

    function observeProgressiveImage(image) {
        if (!image || image.dataset.progressiveReady) {
            return;
        }

        image.dataset.progressiveReady = 'true';
        image.classList.add('progressive-image-img');

        if ('IntersectionObserver' in window) {
            if (!progressiveObserver) {
                progressiveObserver = new IntersectionObserver(function (entries, observer) {
                    entries.forEach(function (entry) {
                        if (entry.isIntersecting) {
                            loadProgressiveImage(entry.target);
                            observer.unobserve(entry.target);
                        }
                    });
                }, {
                    rootMargin: '350px 0px',
                    threshold: 0.01
                });
            }

            progressiveObserver.observe(image);
            return;
        }

        loadProgressiveImage(image);
    }

    function progressiveBlur() {
        var blur = document.createElement('span');

        blur.className = 'progressive-image-blur';
        blur.setAttribute('aria-hidden', 'true');

        return blur;
    }

    function initProgressiveImages(root) {
        var scope = root || document;
        var images = scope.querySelectorAll('.progressive-image-img, [data-progressive-src]');

        images.forEach(function (image) {
            if (image.closest('.site-logo, .kg-bookmark-card, .kg-product-card, .kg-file-card, .kg-audio-card, .kg-gallery-card')) {
                return;
            }

            observeProgressiveImage(image);
        });
    }

    function initImageLightbox() {
        var lightboxImages = document.querySelectorAll('.post-feature-image > img, .page-feature-image > img, .post-content .kg-image-card > img.kg-image, .page-content .kg-image-card > img.kg-image, .post-content .kg-gallery-image > img, .page-content .kg-gallery-image > img');

        if (!lightboxImages.length) {
            return;
        }

        var overlay = document.createElement('div');

        var state = {
            items: [],
            index: 0,
            lastFocus: null,
            pointerX: null,
            closeTimer: null,
            animationTimer: null,
            hiResTimer: null,
            openToken: 0,
            activeThumb: null,
            bodyPaddingRight: null
        };

        overlay.className = 'image-lightbox';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Image viewer');
        overlay.innerHTML = [
            '<div class="image-lightbox-top">',
                '<span class="image-lightbox-counter" data-lightbox-counter></span>',
                '<button class="image-lightbox-button image-lightbox-close" type="button" aria-label="Close image viewer" data-lightbox-close>',
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>',
                '</button>',
            '</div>',
            '<div class="image-lightbox-stage" data-lightbox-stage>',
                '<button class="image-lightbox-button image-lightbox-prev" type="button" aria-label="Previous image" data-lightbox-prev>',
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"></path></svg>',
                '</button>',
                '<figure class="image-lightbox-figure">',
                    '<img class="image-lightbox-image" alt="" data-lightbox-image>',
                '</figure>',
                '<button class="image-lightbox-button image-lightbox-next" type="button" aria-label="Next image" data-lightbox-next>',
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>',
                '</button>',
            '</div>'
        ].join('');

        document.body.appendChild(overlay);

        var viewerImage = overlay.querySelector('[data-lightbox-image]');
        var counter = overlay.querySelector('[data-lightbox-counter]');
        var closeButton = overlay.querySelector('[data-lightbox-close]');
        var prevButton = overlay.querySelector('[data-lightbox-prev]');
        var nextButton = overlay.querySelector('[data-lightbox-next]');
        var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        function lockPageScroll() {
            var scrollbarWidth;
            var bodyPaddingRight;

            if (state.bodyPaddingRight !== null) {
                document.body.classList.add('has-image-lightbox');
                return;
            }

            state.bodyPaddingRight = document.body.style.paddingRight;
            scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

            if (scrollbarWidth > 0) {
                bodyPaddingRight = parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;
                document.body.style.paddingRight = (bodyPaddingRight + scrollbarWidth) + 'px';
            }

            document.body.classList.add('has-image-lightbox');
        }

        function unlockPageScroll() {
            document.body.classList.remove('has-image-lightbox');

            if (state.bodyPaddingRight !== null) {
                document.body.style.paddingRight = state.bodyPaddingRight;
                state.bodyPaddingRight = null;
            }
        }

        function finishClose() {
            window.clearTimeout(state.closeTimer);
            window.clearTimeout(state.animationTimer);
            window.clearTimeout(state.hiResTimer);
            state.closeTimer = null;
            state.animationTimer = null;
            state.hiResTimer = null;
            overlay.classList.remove('is-open', 'is-closing', 'is-zoomed');
            unlockPageScroll();
            viewerImage.removeAttribute('src');
            viewerImage.removeAttribute('alt');
            viewerImage.style.transition = '';
            viewerImage.style.transform = '';
            viewerImage.style.opacity = '';

            if (state.lastFocus) {
                try {
                    state.lastFocus.focus({preventScroll: true});
                } catch (error) {
                    state.lastFocus.focus();
                }
            }
        }

        function clearImageAnimation() {
            window.clearTimeout(state.animationTimer);
            window.clearTimeout(state.hiResTimer);
            state.animationTimer = null;
            state.hiResTimer = null;
            viewerImage.style.transition = '';
            viewerImage.style.transform = '';
            viewerImage.style.opacity = '';
        }

        function sourceFromSrcset(image) {
            var srcset = image.getAttribute('srcset');
            var largest = null;

            if (!srcset) {
                return null;
            }

            srcset.split(',').forEach(function (candidate) {
                var parts = candidate.trim().split(/\s+/);
                var url = parts[0];
                var descriptor = parts[1] || '';
                var width = parseInt(descriptor.replace('w', ''), 10);

                if (!url) {
                    return;
                }

                if (!largest || (width && width > largest.width)) {
                    largest = {
                        url: url,
                        width: width || 0
                    };
                }
            });

            return largest && largest.url;
        }

        function imageSource(image) {
            return image.getAttribute('data-progressive-src') || sourceFromSrcset(image) || image.getAttribute('src') || image.currentSrc;
        }

        function previewSource(image) {
            return image.currentSrc || image.getAttribute('src') || imageSource(image);
        }

        function urlsMatch(firstUrl, secondUrl) {
            var firstLink;
            var secondLink;

            if (!firstUrl || !secondUrl) {
                return false;
            }

            firstLink = document.createElement('a');
            secondLink = document.createElement('a');
            firstLink.href = firstUrl;
            secondLink.href = secondUrl;

            return firstLink.href === secondLink.href;
        }

        function imageItem(image) {
            return {
                src: imageSource(image),
                previewSrc: previewSource(image),
                alt: image.getAttribute('alt') || '',
                image: image
            };
        }

        function frameImages(frame) {
            if (frame.classList.contains('kg-gallery-card')) {
                return Array.from(frame.querySelectorAll('.kg-gallery-image > img'));
            }

            if (frame.classList.contains('kg-image-card')) {
                return Array.from(frame.children).filter(function (child) {
                    return child.matches && child.matches('img.kg-image');
                });
            }

            return Array.from(frame.children).filter(function (child) {
                return child.matches && child.matches('img');
            });
        }

        function isAdjacentMediaFrame(element) {
            return element && element.classList && (element.classList.contains('kg-image-card') || element.classList.contains('kg-gallery-card'));
        }

        function mediaFrames(frame) {
            var frames = [frame];
            var previous = frame.previousElementSibling;
            var next = frame.nextElementSibling;

            if (!isAdjacentMediaFrame(frame)) {
                return frames;
            }

            while (isAdjacentMediaFrame(previous)) {
                frames.unshift(previous);
                previous = previous.previousElementSibling;
            }

            while (isAdjacentMediaFrame(next)) {
                frames.push(next);
                next = next.nextElementSibling;
            }

            return frames;
        }

        function itemsForImage(image) {
            var frame = image.closest('.kg-image-card, .kg-gallery-card, .post-feature-image, .page-feature-image');
            var items = [];
            var index = 0;

            if (!frame) {
                return {
                    items: items,
                    index: index
                };
            }

            mediaFrames(frame).forEach(function (mediaFrame) {
                frameImages(mediaFrame).forEach(function (frameImage) {
                    if (frameImage === image) {
                        index = items.length;
                    }

                    if (imageSource(frameImage)) {
                        items.push(imageItem(frameImage));
                    }
                });
            });

            return {
                items: items,
                index: index
            };
        }

        function render(usePreview) {
            var item = state.items[state.index];
            var hasMultiple = state.items.length > 1;

            if (!item) {
                return;
            }

            viewerImage.src = usePreview ? item.previewSrc : item.src;
            viewerImage.alt = item.alt;
            counter.textContent = hasMultiple ? (state.index + 1) + ' / ' + state.items.length : '';
            prevButton.hidden = !hasMultiple;
            nextButton.hidden = !hasMultiple;
        }

        function imageRect(image) {
            var rect;

            if (!image || !document.documentElement.contains(image)) {
                return null;
            }

            rect = image.getBoundingClientRect();

            if (!rect.width || !rect.height) {
                return null;
            }

            return rect;
        }

        function transformFromRects(startRect, endRect) {
            var scaleX = startRect.width / endRect.width;
            var scaleY = startRect.height / endRect.height;
            var translateX = (startRect.left + (startRect.width / 2)) - (endRect.left + (endRect.width / 2));
            var translateY = (startRect.top + (startRect.height / 2)) - (endRect.top + (endRect.height / 2));

            return 'translate3d(' + translateX + 'px, ' + translateY + 'px, 0) scale(' + scaleX + ', ' + scaleY + ')';
        }

        function afterViewerImageReady(callback) {
            var complete = viewerImage.complete && viewerImage.naturalWidth;
            var done = false;

            function finish() {
                if (done) {
                    return;
                }

                done = true;
                viewerImage.removeEventListener('load', finish);
                viewerImage.removeEventListener('error', finish);

                window.requestAnimationFrame(callback);
            }

            if (complete) {
                window.requestAnimationFrame(callback);
                return;
            }

            viewerImage.addEventListener('load', finish);
            viewerImage.addEventListener('error', finish);
        }

        function swapToHiResAfterOpen(item, token) {
            var preload;
            var startedAt = Date.now();

            if (!item || !item.src || urlsMatch(item.src, item.previewSrc) || reduceMotion) {
                return;
            }

            preload = new Image();

            preload.onload = function () {
                var remaining = Math.max(0, 450 - (Date.now() - startedAt));

                window.clearTimeout(state.hiResTimer);
                state.hiResTimer = window.setTimeout(function () {
                    if (!overlay.classList.contains('is-open') || state.openToken !== token || state.items[state.index] !== item) {
                        return;
                    }

                    viewerImage.style.transition = 'opacity 180ms ease';
                    viewerImage.src = item.src;

                    window.setTimeout(function () {
                        if (overlay.classList.contains('is-open') && state.openToken === token) {
                            viewerImage.style.transition = '';
                        }
                    }, 190);
                }, remaining);
            };

            preload.src = item.src;
        }

        function animateOpenFromThumb(thumb) {
            if (reduceMotion) {
                viewerImage.style.opacity = '';
                return;
            }

            afterViewerImageReady(function () {
                var startRect = imageRect(thumb);
                var endRect = viewerImage.getBoundingClientRect();
                var startTransform;

                if (!overlay.classList.contains('is-open') || state.activeThumb !== thumb || !startRect || !endRect.width || !endRect.height) {
                    viewerImage.style.opacity = '';
                    return;
                }

                startTransform = transformFromRects(startRect, endRect);
                viewerImage.style.transition = 'none';
                viewerImage.style.opacity = '1';
                viewerImage.style.transform = startTransform;

                void viewerImage.offsetWidth;

                window.requestAnimationFrame(function () {
                    window.requestAnimationFrame(function () {
                        if (!overlay.classList.contains('is-open') || state.activeThumb !== thumb) {
                            return;
                        }

                        viewerImage.style.transition = 'transform 450ms cubic-bezier(0.2, 0.8, 0.2, 1)';
                        viewerImage.style.transform = 'translate3d(0, 0, 0) scale(1, 1)';

                        window.clearTimeout(state.animationTimer);
                        state.animationTimer = window.setTimeout(function () {
                            state.animationTimer = null;
                            viewerImage.style.transition = '';
                            viewerImage.style.transform = '';
                        }, 460);
                    });
                });
            });
        }

        function animateCloseToThumb() {
            if (reduceMotion) {
                viewerImage.style.opacity = '0';
                overlay.classList.remove('is-open', 'is-zoomed');
                overlay.classList.add('is-closing');
                state.closeTimer = window.setTimeout(finishClose, 160);
                return;
            }

            overlay.classList.remove('is-zoomed');

            var thumb = (state.items[state.index] && state.items[state.index].image) || state.activeThumb;
            var targetRect = imageRect(thumb);
            var currentRect = viewerImage.getBoundingClientRect();
            var targetTransform;

            if (!targetRect || !currentRect.width || !currentRect.height) {
                viewerImage.style.opacity = '0';
                overlay.classList.remove('is-open');
                overlay.classList.add('is-closing');
                state.closeTimer = window.setTimeout(finishClose, 240);
                return;
            }

            targetTransform = transformFromRects(targetRect, currentRect);
            viewerImage.style.transition = 'none';
            viewerImage.style.opacity = '1';
            viewerImage.style.transform = 'translate3d(0, 0, 0) scale(1, 1)';

            void viewerImage.offsetWidth;

            overlay.classList.remove('is-open');
            overlay.classList.add('is-closing');
            viewerImage.style.transition = 'transform 360ms cubic-bezier(0.4, 0, 0.2, 1)';
            viewerImage.style.transform = targetTransform;
            state.closeTimer = window.setTimeout(finishClose, 370);
        }

        function goTo(index) {
            if (!state.items.length) {
                return;
            }

            clearImageAnimation();
            overlay.classList.remove('is-zoomed');
            state.index = (index + state.items.length) % state.items.length;
            state.activeThumb = state.items[state.index].image;
            render();
        }

        function closeLightbox() {
            if (!overlay.classList.contains('is-open') || state.closeTimer) {
                return;
            }

            clearImageAnimation();
            animateCloseToThumb();
        }

        function openLightbox(image) {
            var gallery = itemsForImage(image);

            if (!gallery.items.length) {
                return;
            }

            window.clearTimeout(state.closeTimer);
            state.closeTimer = null;
            state.items = gallery.items;
            state.index = gallery.index;
            state.lastFocus = document.activeElement;
            state.activeThumb = image;
            state.openToken += 1;
            overlay.classList.remove('is-closing', 'is-zoomed');
            clearImageAnimation();
            viewerImage.style.opacity = '0';
            render(true);
            lockPageScroll();
            overlay.classList.add('is-open');
            animateOpenFromThumb(image);
            swapToHiResAfterOpen(state.items[state.index], state.openToken);

            try {
                closeButton.focus({preventScroll: true});
            } catch (error) {
                closeButton.focus();
            }
        }

        lightboxImages.forEach(function (image) {
            image.setAttribute('tabindex', '0');
            image.setAttribute('role', 'button');
            image.setAttribute('aria-haspopup', 'dialog');

            if (!image.getAttribute('aria-label')) {
                image.setAttribute('aria-label', 'Open image viewer');
            }

            image.addEventListener('click', function (event) {
                event.preventDefault();
                openLightbox(image);
            });

            image.addEventListener('keydown', function (event) {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openLightbox(image);
                }
            });
        });

        closeButton.addEventListener('click', closeLightbox);
        prevButton.addEventListener('click', function () {
            goTo(state.index - 1);
        });
        nextButton.addEventListener('click', function () {
            goTo(state.index + 1);
        });

        viewerImage.addEventListener('click', function () {
            if (overlay.classList.contains('is-zoomed')) {
                overlay.classList.remove('is-zoomed');
            } else {
                overlay.classList.add('is-zoomed');
            }
        });

        overlay.addEventListener('click', function (event) {
            if (!overlay.classList.contains('is-open')) {
                return;
            }

            if (event.target.closest('.image-lightbox-image, .image-lightbox-button')) {
                return;
            }

            closeLightbox();
        });

        overlay.addEventListener('pointerdown', function (event) {
            state.pointerX = event.clientX;
        });

        overlay.addEventListener('pointerup', function (event) {
            var delta = state.pointerX === null ? 0 : event.clientX - state.pointerX;

            state.pointerX = null;

            if (Math.abs(delta) < 48 || state.items.length < 2) {
                return;
            }

            goTo(state.index + (delta < 0 ? 1 : -1));
        });

        document.addEventListener('keydown', function (event) {
            if (!overlay.classList.contains('is-open')) {
                return;
            }

            if (event.key === 'Escape') {
                closeLightbox();
            } else if (event.key === 'ArrowLeft') {
                goTo(state.index - 1);
            } else if (event.key === 'ArrowRight') {
                goTo(state.index + 1);
            }
        });
    }

    function stabilizeGalleryImages(root) {
        var scope = root || document;
        var galleryImages = scope.querySelectorAll('.post-content .kg-gallery-image > img, .page-content .kg-gallery-image > img');

        galleryImages.forEach(function (image) {
            var width = parseInt(image.getAttribute('width'), 10);
            var height = parseInt(image.getAttribute('height'), 10);
            var frame = image.closest('.kg-gallery-image');

            if (!image.getAttribute('decoding')) {
                image.decoding = 'async';
            }

            if (!width || !height || !frame) {
                return;
            }

            frame.style.setProperty('--gallery-image-ratio', width + ' / ' + height);
            image.style.setProperty('--gallery-image-ratio', width + ' / ' + height);
            frame.classList.add('is-ratio-ready');
        });
    }

    function initPostCardImageFallbacks(root) {
        var scope = root || document;
        var fallbackCardImages = scope.querySelectorAll('[data-post-card-image-fallback]');

        fallbackCardImages.forEach(function (fallbackLink) {
            var card = fallbackLink.closest('[data-post-card]');
            var source = card && card.querySelector('[data-post-card-image-source]');
            var sourceRoot = source && source.content;
            var firstCardImage = firstUsableImage(sourceRoot);

            if (!firstCardImage) {
                return;
            }

            var fallbackImage = promotedClone(firstCardImage, 'post-card-image', fallbackLink.getAttribute('aria-label'));

            fallbackLink.classList.add('progressive-image');
            fallbackLink.appendChild(fallbackImage);
            fallbackLink.appendChild(progressiveBlur());
            fallbackLink.hidden = false;
            observeProgressiveImage(fallbackImage);

            if (source) {
                source.remove();
            }
        });
    }

    function initProductCardImageFrames(root) {
        var scope = root || document;
        var productImages = scope.querySelectorAll('.post-content .kg-product-card-image, .page-content .kg-product-card-image');

        productImages.forEach(function (image) {
            var media = image.parentElement && image.parentElement.tagName === 'PICTURE' ? image.parentElement : image;
            var parent = media.parentNode;
            var frame;

            if (!parent || media.closest('.kg-product-card-image-frame')) {
                return;
            }

            frame = document.createElement('span');
            frame.className = 'kg-product-card-image-frame';
            parent.insertBefore(frame, media);
            frame.appendChild(media);
        });
    }

    function loadMorePostList(control) {
        var feed = control.closest('.post-feed');

        return feed && feed.querySelector('.latest-post-list, .post-grid');
    }

    function initLoadMore() {
        var controls = document.querySelectorAll('[data-load-more]');

        controls.forEach(function (control) {
            var button = control.querySelector('[data-load-more-button]');

            if (!button || control.dataset.loadMoreReady) {
                return;
            }

            control.dataset.loadMoreReady = 'true';

            button.addEventListener('click', function (event) {
                var list = loadMorePostList(control);
                var nextUrl = button.getAttribute('href');

                if (!list || !nextUrl || button.classList.contains('is-loading')) {
                    return;
                }

                event.preventDefault();
                button.classList.add('is-loading');
                button.setAttribute('aria-busy', 'true');

                fetch(nextUrl, {
                    credentials: 'same-origin'
                }).then(function (response) {
                    if (!response.ok) {
                        throw new Error('Unable to load posts');
                    }

                    return response.text();
                }).then(function (html) {
                    var parser = new DOMParser();
                    var nextDocument = parser.parseFromString(html, 'text/html');
                    var listSelector = list.classList.contains('latest-post-list') ? '.latest-post-list' : '.post-grid';
                    var nextControl = nextDocument.querySelector('[data-load-more]');
                    var nextList = nextDocument.querySelector(listSelector);
                    var nextButton = nextControl && nextControl.querySelector('[data-load-more-button]');
                    var posts = nextList ? nextList.querySelectorAll('[data-post-card]') : [];
                    var fragment = document.createDocumentFragment();

                    posts.forEach(function (post) {
                        fragment.appendChild(document.importNode(post, true));
                    });

                    if (fragment.childNodes.length) {
                        list.appendChild(fragment);
                        initPostCardImageFallbacks(list);
                        initProgressiveImages(list);
                    }

                    if (nextButton) {
                        button.setAttribute('href', nextButton.getAttribute('href'));
                        button.classList.remove('is-loading');
                        button.removeAttribute('aria-busy');
                    } else {
                        control.remove();
                    }
                }).catch(function () {
                    button.classList.remove('is-loading');
                    button.removeAttribute('aria-busy');
                });
            });
        });
    }

    function initContentToggles() {
        if (contentTogglesReady) {
            return;
        }

        contentTogglesReady = true;

        document.querySelectorAll('.kg-toggle-card-icon').forEach(function (button) {
            button.setAttribute('type', 'button');
        });

        document.addEventListener('click', function (event) {
            var heading = event.target.closest('.kg-toggle-heading');
            var card = heading && heading.closest('.kg-toggle-card');
            var button = heading && heading.querySelector('.kg-toggle-card-icon');
            var isOpen;

            if (!card) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            isOpen = card.getAttribute('data-kg-toggle-state') === 'open';
            card.setAttribute('data-kg-toggle-state', isOpen ? 'close' : 'open');

            if (button) {
                button.setAttribute('aria-label', isOpen ? 'Expand toggle to read content' : 'Collapse toggle content');
            }
        }, true);
    }

    authorInitials.forEach(function (avatar) {
        var name = (avatar.getAttribute('data-author-name') || '').trim();
        var parts = name.split(/\s+/).filter(Boolean);
        var initials = '';

        if (parts.length === 1) {
            initials = Array.from(parts[0]).slice(0, 2).join('');
        } else if (parts.length > 1) {
            initials = parts.slice(0, 2).map(function (part) {
                return Array.from(part)[0];
            }).join('');
        }

        avatar.textContent = initials.toUpperCase();
    });

    initPostCardImageFallbacks();
    initProductCardImageFrames();
    initContentToggles();

    stabilizeGalleryImages();
    initProgressiveImages();
    initImageLightbox();
    initLoadMore();

    function closeMenu(skipAnimation) {
        if (!header || !menuToggle || !mobileMenu) {
            return;
        }

        window.clearTimeout(menuTimer);
        header.classList.remove('is-menu-open');
        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.setAttribute('aria-label', 'Open menu');

        if (skipAnimation) {
            mobileMenu.hidden = true;
            return;
        }

        menuTimer = window.setTimeout(function () {
            mobileMenu.hidden = true;
        }, 300);
    }

    themeToggles.forEach(function (toggle) {
        toggle.addEventListener('click', function () {
            var nextTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';

            if (nextTheme === 'dark') {
                document.documentElement.setAttribute('data-theme', 'dark');
            } else {
                document.documentElement.removeAttribute('data-theme');
            }

            localStorage.setItem('theme', nextTheme);
        });
    });

    if (header && menuToggle && mobileMenu) {
        menuToggle.addEventListener('click', function () {
            var isOpen = menuToggle.getAttribute('aria-expanded') === 'true';

            if (isOpen) {
                closeMenu();
                return;
            }

            window.clearTimeout(menuTimer);
            mobileMenu.hidden = false;
            window.requestAnimationFrame(function () {
                header.classList.add('is-menu-open');
                menuToggle.setAttribute('aria-expanded', 'true');
                menuToggle.setAttribute('aria-label', 'Close menu');
            });
        });

        mobileMenu.addEventListener('click', function (event) {
            if (event.target.closest('a')) {
                closeMenu();
            }
        });

        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                closeMenu();
            }
        });

        desktopQuery.addEventListener('change', function (event) {
            if (event.matches) {
                closeMenu(true);
            }
        });
    }
})();
