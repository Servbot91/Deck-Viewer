(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // context.js
  function detectContext() {
    const path = window.location.pathname;
    const hash = window.location.hash;
    const search = window.location.search;
    const imageIdMatch = path.match(/^\/images\/(\d+)$/);
    if (imageIdMatch) {
      return { type: "images", id: imageIdMatch[1], hash, isSingleImage: true };
    }
    if (path.startsWith("/galleries")) {
      const galleryIdMatch = path.match(/^\/galleries\/(\d+)/);
      if (galleryIdMatch) {
        return { type: "galleries", id: galleryIdMatch[1], hash, isSingleGallery: true };
      } else {
        const filters = parseUrlFilters2(search);
        return { type: "galleries", isGalleryListing: true, filter: filters, hash };
      }
    }
    if (path.startsWith("/images")) {
      const filters = parseUrlFilters2(search);
      return {
        type: "images",
        isFilteredView: !!search,
        // true if there are any search params
        isGeneralListing: !search,
        // true if it's just the base /images page
        filter: filters,
        hash
      };
    }
    const idMatch = path.match(/\/(\w+)\/(\d+)/);
    if (idMatch) {
      const [, type, id] = idMatch;
      const isImagesTab = hash.includes("images") || document.querySelector(".nav-tabs .active")?.textContent?.includes("Images");
      if (isImagesTab || type === "galleries") {
        const filter = {};
        if (type === "performers") filter.performers = { value: [id], modifier: "INCLUDES" };
        if (type === "tags") filter.tags = { value: [id], modifier: "INCLUDES" };
        if (type === "studios") filter.studios = { value: [id], modifier: "INCLUDES" };
        return { type, id, filter, hash };
      }
    }
    if (document.querySelectorAll('img[src*="/image/"]').length > 0) {
      return {
        type: "images",
        isGeneralListing: true,
        filter: parseUrlFilters2(search),
        // Still try to grab any sort/direction params
        hash
      };
    }
    return null;
  }
  function parseUrlFilters2(search) {
    const params = new URLSearchParams(search);
    const cParam = params.get("c");
    let parsedFilter = {};
    if (cParam) {
      try {
        const jsonString = cParam.replace(/\(/g, "{").replace(/\)/g, "}").replace(/"items":/g, '"value":');
        const parsed = JSON.parse(jsonString);
        if (parsed.type && parsed.value) {
          parsedFilter[parsed.type] = {
            value: parsed.value.value ? parsed.value.value.map((i) => i.id) : [],
            modifier: parsed.modifier || "INCLUDES"
          };
        }
      } catch (e) {
        console.error("[Image Deck] Filter parse error:", e);
      }
    }
    return {
      ...parsedFilter,
      // Spread the filters (e.g., performers: {...})
      sortBy: params.get("sortby") || "created_at",
      sortDir: params.get("sortdir") || "desc",
      perPage: parseInt(params.get("perPage")) || 40
    };
  }
  function getVisibleImages() {
    const images = [];
    const imageGrid = document.querySelector('.main-content, [role="main"]') || document.body;
    const imageElements = imageGrid.querySelectorAll(".image-card img, .grid-card img");
    imageElements.forEach((img, index) => {
      if (img.src && img.src.includes("/image/") && !img.src.includes("/studio/") && !img.closest(".logo, .sidebar, .header")) {
        const idMatch = img.src.match(/\/image\/(\d+)/);
        const id = idMatch ? idMatch[1] : `img_${index}`;
        const fullImageUrl = img.src.includes("/thumbnail/") ? img.src.replace("/thumbnail/", "/image/") : img.src;
        images.push({
          id,
          title: img.alt || `Image ${index + 1}`,
          paths: {
            image: fullImageUrl
          }
        });
      }
    });
    return images;
  }
  async function fetchContextImages(context, page = 1, perPage = 50) {
    const { type, id, filter, isSingleGallery, isGalleryListing } = context;
    const isFetchingGalleries = isGalleryListing || type === "galleries" && !isSingleGallery;
    let query = "";
    if (isFetchingGalleries) {
      query = `query FindGalleries($filter: FindFilterType!, $gallery_filter: GalleryFilterType) {
            findGalleries(filter: $filter, gallery_filter: $gallery_filter) {
                count
                galleries {
                    id title cover { paths { thumbnail image } }
                }
            }
        }`;
    } else {
      query = `query FindImages($filter: FindFilterType!, $image_filter: ImageFilterType) {
            findImages(filter: $filter, image_filter: $image_filter) {
                count
                images {
                    id title paths { thumbnail image }
                }
            }
        }`;
    }
    const allowedFields = [
      "tags",
      "performers",
      "studios",
      "markers",
      "galleries",
      "pht_path",
      "rating",
      "organized",
      "is_missing"
    ];
    let activeFilter = {};
    if (isSingleGallery && id) {
      activeFilter = { galleries: { value: [id], modifier: "INCLUDES" } };
    } else if (filter) {
      allowedFields.forEach((field) => {
        if (filter[field]) {
          activeFilter[field] = filter[field];
        }
      });
    }
    const variables = {
      filter: {
        per_page: perPage,
        page,
        sort: filter?.sortBy || "created_at",
        direction: (filter?.sortDir || "desc").toUpperCase()
      }
    };
    if (isFetchingGalleries) {
      variables.gallery_filter = activeFilter;
    } else {
      variables.image_filter = activeFilter;
    }
    try {
      const response = await fetch("/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables })
      });
      const data = await response.json();
      if (data.errors) {
        console.error("[Image Deck] GraphQL Errors:", data.errors);
        throw new Error(data.errors[0].message);
      }
      let normalizedImages = [];
      let totalCount = 0;
      if (isFetchingGalleries) {
        const result = data?.data?.findGalleries;
        totalCount = result?.count || 0;
        normalizedImages = (result?.galleries || []).map((g) => ({
          id: g.id,
          title: g.title,
          isGallery: true,
          type: "gallery",
          paths: { image: g.cover?.paths?.image || g.cover?.paths?.thumbnail || "" },
          url: `/galleries/${g.id}`
        }));
      } else {
        const result = data?.data?.findImages;
        totalCount = result?.count || 0;
        normalizedImages = (result?.images || []).map((img) => ({
          ...img,
          isGallery: false,
          type: "image"
        }));
      }
      const calculatedTotalPages = Math.ceil(totalCount / perPage);
      return {
        images: normalizedImages,
        totalCount,
        currentPage: page,
        totalPages: calculatedTotalPages,
        hasNextPage: page < calculatedTotalPages
      };
    } catch (error) {
      console.error(`[Image Deck] Fetch Error:`, error);
      return {
        images: [],
        totalCount: 0,
        currentPage: 1,
        totalPages: 0,
        hasNextPage: false
      };
    }
  }
  var init_context = __esm({
    "context.js"() {
    }
  });

  // utils.js
  var isMobile;
  var init_utils = __esm({
    "utils.js"() {
      isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768 || "ontouchstart" in window;
    }
  });

  // config.js
  async function getPluginConfig() {
    try {
      const response = await fetch("/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `query Configuration {
                    configuration {
                        plugins
                    }
                }`
        })
      });
      const data = await response.json();
      const settings = data?.data?.configuration?.plugins?.[PLUGIN_NAME] || {};
      if (!settings.autoPlayInterval || settings.autoPlayInterval === 0) settings.autoPlayInterval = 500;
      if (!settings.transitionEffect || settings.transitionEffect === "") settings.transitionEffect = "cards";
      if (settings.showProgressBar === void 0) settings.showProgressBar = true;
      if (settings.showCounter === void 0) settings.showCounter = true;
      if (!settings.preloadImages || settings.preloadImages === 0) settings.preloadImages = isMobile ? 1 : 1;
      if (!settings.swipeResistance || settings.swipeResistance === 0) settings.swipeResistance = 80;
      if (!settings.effectDepth || settings.effectDepth === 0) settings.effectDepth = 150;
      if (settings.chunkSize === void 0) settings.chunkSize = 30;
      if (settings.lazyLoadThreshold === void 0) settings.lazyLoadThreshold = 2;
      if (!settings.ambientColorHue || settings.ambientColorHue === 0) settings.ambientColorHue = 260;
      if (!settings.imageGlowIntensity || settings.imageGlowIntensity === 0) settings.imageGlowIntensity = 40;
      if (!settings.ambientPulseSpeed || settings.ambientPulseSpeed === 0) settings.ambientPulseSpeed = 6;
      if (!settings.edgeGlowIntensity || settings.edgeGlowIntensity === 0) settings.edgeGlowIntensity = 50;
      if (!settings.strobeSpeed || settings.strobeSpeed === 0) settings.strobeSpeed = 150;
      if (!settings.strobeIntensity || settings.strobeIntensity === 0) settings.strobeIntensity = 60;
      console.log(`[Image Deck] Settings loaded:`, settings);
      return settings;
    } catch (error) {
      console.error(`[Image Deck] Error loading settings:`, error);
      return {
        autoPlayInterval: 500,
        transitionEffect: "cards",
        showProgressBar: true,
        showCounter: true,
        preloadImages: 2,
        swipeResistance: 50,
        effectDepth: 150,
        ambientColorHue: 260,
        imageGlowIntensity: 40,
        ambientPulseSpeed: 6
      };
    }
  }
  function injectDynamicStyles(settings) {
    const styleId = "image-deck-dynamic-styles";
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    const ambientHue = settings.ambientColorHue;
    const glowIntensity = settings.imageGlowIntensity;
    const pulseSpeed = settings.ambientPulseSpeed;
    const edgeIntensity = settings.edgeGlowIntensity / 100;
    styleEl.textContent = `
        .swiper-slide img {
            filter: drop-shadow(0 0 ${glowIntensity}px hsla(${ambientHue}, 70%, 65%, 0.4));
        }

        .image-deck-ambient {
            background: radial-gradient(
                ellipse at center,
                hsla(${ambientHue}, 70%, 50%, 0.2) 0%,
                hsla(${ambientHue}, 60%, 40%, 0.15) 50%,
                transparent 100%
            );
            animation: ambientPulse ${pulseSpeed}s ease-in-out infinite;
        }

        .image-deck-container::before {
            box-shadow: inset 0 0 ${100 * edgeIntensity}px hsla(${ambientHue}, 70%, 50%, ${0.2 * edgeIntensity});
            animation: edgeGlow 4s ease-in-out infinite alternate;
        }

        @keyframes edgeGlow {
            0% {
                box-shadow: inset 0 0 ${100 * edgeIntensity}px hsla(${ambientHue}, 70%, 50%, ${0.2 * edgeIntensity});
            }
            100% {
                box-shadow: inset 0 0 ${150 * edgeIntensity}px hsla(${ambientHue + 20}, 70%, 50%, ${0.3 * edgeIntensity});
            }
        }

        .image-deck-progress {
            background: linear-gradient(90deg,
                hsl(${ambientHue}, 70%, 65%),
                hsl(${ambientHue + 30}, 70%, 65%)
            );
        }
        
        /* Gallery cover styles */
        .gallery-cover-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin: 20px auto;
            max-width: 300px;
        }
        
        .gallery-cover-title {
            color: white;
            font-size: 16px;
            font-weight: bold;
            text-align: center;
            margin-bottom: 10px;
            text-shadow: 0 0 5px rgba(0, 0, 0, 0.7);
            padding: 5px 10px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 4px;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .gallery-cover-link {
            display: inline-block;
            max-width: 300px;
            max-height: 500px; /* Increased height by ~200px */
            aspect-ratio: 3 / 5; /* More rectangular shape */
            border: 3px solid #6a5acd;
            border-radius: 8px;
            box-shadow: 0 0 15px rgba(106, 90, 205, 0.7);
            overflow: hidden;
            transition: all 0.3s ease;
            width: 100%;
        }
        
        .gallery-cover-link:hover {
            transform: scale(1.05);
            box-shadow: 0 0 25px rgba(106, 90, 205, 0.9);
            border-color: #8a7bdb;
        }
        
        .gallery-cover-link img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }
        
        /* Mobile optimizations */
        @media (max-width: 768px) {
            .gallery-cover-container {
                max-width: 200px;
            }
            
            .gallery-cover-link {
                max-width: 200px;
                max-height: 350px;
            }
            
            .gallery-cover-title {
                font-size: 14px;
                padding: 4px 8px;
            }
        }
        
        @media (max-width: 480px) {
            .gallery-cover-container {
                max-width: 150px;
            }
            
            .gallery-cover-link {
                max-width: 150px;
                max-height: 250px;
            }
            
            .gallery-cover-title {
                font-size: 12px;
                padding: 3px 6px;
            }
        }
    `;
  }
  var PLUGIN_NAME;
  var init_config = __esm({
    "config.js"() {
      init_utils();
      PLUGIN_NAME = "image-deck";
    }
  });

  // swiper.js
  function getEffectOptions(effect, pluginConfig2) {
    const depth = pluginConfig2.effectDepth;
    switch (effect) {
      case "cards":
        return {
          cardsEffect: {
            slideShadows: false,
            // Disable shadows for performance
            rotate: true,
            perSlideRotate: 2,
            perSlideOffset: 8
          }
        };
      case "coverflow":
        return {
          coverflowEffect: {
            rotate: 30,
            // Reduced from 50
            stretch: 0,
            depth: Math.min(depth, 100),
            // Cap depth
            modifier: 1,
            slideShadows: false
            // Disable shadows
          }
        };
      case "flip":
        return {
          flipEffect: {
            slideShadows: false,
            limitRotation: true
          }
        };
      case "cube":
        return {
          cubeEffect: {
            shadow: false,
            // Disable shadows
            slideShadows: false
          }
        };
      case "fade":
        return {
          fadeEffect: {
            crossFade: true
          },
          speed: 200
          // Faster fade
        };
      default:
        return {
          spaceBetween: 20,
          slidesPerView: 1
        };
    }
  }
  function initSwiper(container, images, pluginConfig2, updateUICallback, savePositionCallback, contextInfo2) {
    const wrapper = container.querySelector(".swiper-wrapper");
    const swiperEl = container.querySelector(".swiper");
    const useVirtual = images.length > 10;
    const effectOptions = getEffectOptions(pluginConfig2.transitionEffect, pluginConfig2);
    const swiperConfig = {
      effect: pluginConfig2.transitionEffect,
      grabCursor: true,
      centeredSlides: true,
      slidesPerView: 1,
      resistanceRatio: pluginConfig2.swipeResistance / 100,
      speed: 150,
      watchSlidesProgress: true,
      preloadImages: false,
      keyboard: { enabled: true, onlyInViewport: false },
      loop: contextInfo2?.isSingleGallery ? true : false,
      loopAdditionalSlides: 2,
      ...effectOptions
    };
    const getSlideTemplate = (img, isEager) => {
      const fullSrc = img.paths.image;
      const isGallery = img.url && !contextInfo2?.isSingleGallery;
      const loadingStrategy = isEager ? "eager" : "lazy";
      if (isGallery) {
        return `
                <div class="swiper-zoom-container" data-type="gallery" data-url="${img.url}">
                    <div class="gallery-cover-container">
                        <div class="gallery-cover-title" title="${img.title || "Untitled Gallery"}">${img.title || "Untitled Gallery"}</div>
                        <a href="${img.url}" target="_blank" class="gallery-cover-link">
                            <img src="${fullSrc}" alt="${img.title || ""}" decoding="async" loading="${loadingStrategy}" />
                        </a>
                    </div>
                </div>`;
      } else {
        return `
                <div class="swiper-zoom-container" data-type="image">
                    <img src="${fullSrc}" alt="${img.title || ""}" decoding="async" loading="${loadingStrategy}" style="max-width: 100%; height: auto; display: block; margin: 0 auto;" />
                </div>`;
      }
    };
    if (useVirtual) {
      console.log("[Image Deck] Using virtual slides for performance");
      swiperConfig.virtual = {
        slides: images.map((img) => getSlideTemplate(img, false)),
        cache: true,
        // Re-enabled cache to prevent the "load nothing" refresh issue
        addSlidesBefore: 2,
        addSlidesAfter: 2,
        renderSlide: function(slideContent) {
          return `<div class="swiper-slide">${slideContent}</div>`;
        }
      };
    } else {
      images.forEach((img) => {
        const slide = document.createElement("div");
        slide.className = "swiper-slide";
        slide.innerHTML = getSlideTemplate(img, true);
        const imgEl = slide.querySelector("img");
        if (imgEl && imgEl.decode) {
          imgEl.decode().catch(() => {
          });
        }
        wrapper.appendChild(slide);
      });
    }
    swiperConfig.on = {
      click: function(swiper2, event) {
        const zoomContainer = event.target.closest(".swiper-zoom-container");
        if (zoomContainer && zoomContainer.dataset.type === "gallery") {
          const url = zoomContainer.dataset.url;
          if (url) window.open(url, "_blank");
        }
      },
      slideChange: function() {
        if (updateUICallback) updateUICallback(container);
        if (savePositionCallback) savePositionCallback();
      },
      reachEnd: function() {
        const nextChunkBtn = document.querySelector('[data-action="next-chunk"]');
        if (nextChunkBtn && !nextChunkBtn.disabled) {
          setTimeout(() => nextChunkBtn.click(), 300);
        }
      },
      slideChangeTransitionEnd: function() {
        if (this.lazy && this.lazy.load) {
          setTimeout(() => this.lazy.load(), 50);
        }
        const currentIndex = this.activeIndex;
        const totalSlides = this.virtual ? this.virtual.slides.length : this.slides.length;
        if (totalSlides > 0 && currentIndex >= totalSlides - 3) {
          const nextChunkBtn = document.querySelector('[data-action="next-chunk"]');
          if (nextChunkBtn && !nextChunkBtn.disabled) {
            setTimeout(() => nextChunkBtn.click(), 1e3);
          }
        }
      }
    };
    const swiper = new Swiper(swiperEl, swiperConfig);
    container.querySelector(".image-deck-loading").style.display = "none";
    return swiper;
  }
  var init_swiper = __esm({
    "swiper.js"() {
    }
  });

  // graphql.js
  async function fetchImageMetadata(imageId) {
    const query = `query FindImage($id: ID!) {
        findImage(id: $id) {
            id
            title
            rating100
            o_counter
            organized
            date
            details
            photographer
            files {
                basename
            }
            tags {
                id
                name
            }
            performers {
                id
                name
            }
            studio {
                id
                name
            }
            galleries {
                id
                title
            }
            paths {
                thumbnail
                image
            }
        }
    }`;
    try {
      const response = await fetch("/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables: { id: imageId } })
      });
      const data = await response.json();
      return data?.data?.findImage || null;
    } catch (error) {
      console.error("[Image Deck] Error fetching image metadata:", error);
      return null;
    }
  }
  async function updateImageMetadata(imageId, updates) {
    const mutation = `mutation ImageUpdate($input: ImageUpdateInput!) {
        imageUpdate(input: $input) {
            id
            rating100
            title
            details
            organized
        }
    }`;
    const input = { id: imageId, ...updates };
    try {
      const response = await fetch("/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: mutation, variables: { input } })
      });
      const data = await response.json();
      return data?.data?.imageUpdate || null;
    } catch (error) {
      console.error("[Image Deck] Error updating image metadata:", error);
      return null;
    }
  }
  async function updateImageTags(imageId, tagIds) {
    const mutation = `mutation ImageUpdate($input: ImageUpdateInput!) {
        imageUpdate(input: $input) {
            id
            tags {
                id
                name
            }
        }
    }`;
    const input = { id: imageId, tag_ids: tagIds };
    try {
      const response = await fetch("/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: mutation, variables: { input } })
      });
      const data = await response.json();
      return data?.data?.imageUpdate || null;
    } catch (error) {
      console.error("[Image Deck] Error updating image tags:", error);
      return null;
    }
  }
  async function searchTags(query) {
    const gql = `query FindTags($filter: FindFilterType, $tag_filter: TagFilterType) {
        findTags(filter: $filter, tag_filter: $tag_filter) {
            tags {
                id
                name
            }
        }
    }`;
    const variables = {
      filter: { per_page: 20, q: query },
      tag_filter: {}
    };
    try {
      const response = await fetch("/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: gql, variables })
      });
      const data = await response.json();
      return data?.data?.findTags?.tags || [];
    } catch (error) {
      console.error("[Image Deck] Error searching tags:", error);
      return [];
    }
  }
  var init_graphql = __esm({
    "graphql.js"() {
    }
  });

  // metadata.js
  async function openMetadataModal() {
    if (!currentSwiperRef) return;
    const currentIndex = currentSwiperRef.activeIndex;
    const currentImage = window.currentImages[currentIndex];
    if (!currentImage || !currentImage.id) return;
    const modal = document.querySelector(".image-deck-metadata-modal");
    const body = document.querySelector(".image-deck-metadata-body");
    if (!modal || !body) return;
    body.innerHTML = '<div class="metadata-loading">Loading...</div>';
    modal.classList.add("active");
    currentMetadata = await fetchImageMetadata(currentImage.id);
    if (!currentMetadata) {
      body.innerHTML = '<div class="metadata-error">Failed to load metadata</div>';
      return;
    }
    populateMetadataModal(currentMetadata);
  }
  function closeMetadataModal() {
    const modal = document.querySelector(".image-deck-metadata-modal");
    if (modal) {
      modal.classList.remove("active");
    }
    currentMetadata = null;
  }
  function populateMetadataModal(metadata) {
    const body = document.querySelector(".image-deck-metadata-body");
    if (!body) return;
    const rating = metadata.rating100 ? metadata.rating100 / 20 : 0;
    const filename = metadata.files && metadata.files.length > 0 ? metadata.files[0].basename : "Unknown";
    body.innerHTML = `
        <div class="metadata-section metadata-file-info">
            <div class="metadata-filename" title="${filename}">${filename}</div>
            <a href="/images/${metadata.id}" target="_blank" class="metadata-link" title="Open image page in new tab">
                View in Stash \u2192
            </a>
        </div>

        <div class="metadata-section">
            <label>Rating</label>
            <div class="metadata-rating">
                ${[1, 2, 3, 4, 5].map(
      (star) => `<button class="metadata-star ${star <= rating ? "active" : ""}" data-rating="${star}">\u2605</button>`
    ).join("")}
            </div>
        </div>

        <div class="metadata-section">
            <label>Title</label>
            <input type="text" class="metadata-title" value="${metadata.title || ""}" placeholder="Enter title...">
        </div>

        <div class="metadata-section">
            <label>Details</label>
            <textarea class="metadata-details" placeholder="Enter details...">${metadata.details || ""}</textarea>
        </div>

        <div class="metadata-section">
            <label>Tags</label>
            <div class="metadata-tags">
                ${metadata.tags.map(
      (tag) => `<span class="metadata-tag" data-tag-id="${tag.id}">
                        ${tag.name}
                        <button class="metadata-tag-remove" data-tag-id="${tag.id}">\xD7</button>
                    </span>`
    ).join("")}
            </div>
            <input type="text" class="metadata-tag-search" placeholder="Search tags...">
            <div class="metadata-tag-results"></div>
        </div>

        <div class="metadata-section">
            <label>Info</label>
            <div class="metadata-info">
                ${metadata.performers.length > 0 ? `<div><strong>Performers:</strong> ${metadata.performers.map((p) => p.name).join(", ")}</div>` : ""}
                ${metadata.studio ? `<div><strong>Studio:</strong> ${metadata.studio.name}</div>` : ""}
                ${metadata.date ? `<div><strong>Date:</strong> ${metadata.date}</div>` : ""}
                ${metadata.photographer ? `<div><strong>Photographer:</strong> ${metadata.photographer}</div>` : ""}
                <div><strong>Views:</strong> ${metadata.o_counter || 0}</div>
            </div>
        </div>

        <div class="metadata-actions">
            <button class="metadata-save-btn">Save Changes</button>
            <button class="metadata-organized-btn ${metadata.organized ? "active" : ""}">
                ${metadata.organized ? "Organized \u2713" : "Mark Organized"}
            </button>
        </div>
    `;
    setupMetadataHandlers(metadata);
  }
  function setupMetadataHandlers(metadata) {
    const body = document.querySelector(".image-deck-metadata-body");
    body.querySelectorAll(".metadata-star").forEach((star) => {
      star.addEventListener("click", (e) => {
        const rating = parseInt(e.target.dataset.rating);
        body.querySelectorAll(".metadata-star").forEach((s, i) => {
          s.classList.toggle("active", i < rating);
        });
      });
    });
    body.querySelectorAll(".metadata-tag-remove").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const tagId = e.target.dataset.tagId;
        const tagEl = e.target.closest(".metadata-tag");
        if (tagEl) tagEl.remove();
      });
    });
    const tagSearch = body.querySelector(".metadata-tag-search");
    const tagResults = body.querySelector(".metadata-tag-results");
    let searchTimeout;
    tagSearch.addEventListener("input", (e) => {
      clearTimeout(searchTimeout);
      const query = e.target.value.trim();
      if (query.length < 2) {
        tagResults.innerHTML = "";
        return;
      }
      searchTimeout = setTimeout(async () => {
        const tags = await searchTags(query);
        tagResults.innerHTML = tags.map(
          (tag) => `<div class="metadata-tag-result" data-tag-id="${tag.id}" data-tag-name="${tag.name}">
                    ${tag.name}
                </div>`
        ).join("");
        tagResults.querySelectorAll(".metadata-tag-result").forEach((result) => {
          result.addEventListener("click", (e2) => {
            const tagId = e2.target.dataset.tagId;
            const tagName = e2.target.dataset.tagName;
            const tagsContainer = body.querySelector(".metadata-tags");
            const tagHtml = `<span class="metadata-tag" data-tag-id="${tagId}">
                        ${tagName}
                        <button class="metadata-tag-remove" data-tag-id="${tagId}">\xD7</button>
                    </span>`;
            tagsContainer.insertAdjacentHTML("beforeend", tagHtml);
            const newTag = tagsContainer.lastElementChild;
            newTag.querySelector(".metadata-tag-remove").addEventListener("click", (e3) => {
              e3.target.closest(".metadata-tag").remove();
            });
            tagSearch.value = "";
            tagResults.innerHTML = "";
          });
        });
      }, 300);
    });
    const saveBtn = body.querySelector(".metadata-save-btn");
    saveBtn.addEventListener("click", async () => {
      const title = body.querySelector(".metadata-title").value;
      const details = body.querySelector(".metadata-details").value;
      const activeStar = body.querySelectorAll(".metadata-star.active").length;
      const rating100 = activeStar * 20;
      const tagIds = Array.from(body.querySelectorAll(".metadata-tag")).map(
        (tag) => tag.dataset.tagId
      );
      saveBtn.textContent = "Saving...";
      saveBtn.disabled = true;
      await updateImageMetadata(metadata.id, { title, details, rating100 });
      await updateImageTags(metadata.id, tagIds);
      saveBtn.textContent = "Saved \u2713";
      setTimeout(() => {
        saveBtn.textContent = "Save Changes";
        saveBtn.disabled = false;
      }, 2e3);
    });
    const organizedBtn = body.querySelector(".metadata-organized-btn");
    organizedBtn.addEventListener("click", async () => {
      const isOrganized = organizedBtn.classList.contains("active");
      const newOrganized = !isOrganized;
      await updateImageMetadata(metadata.id, { organized: newOrganized });
      organizedBtn.classList.toggle("active", newOrganized);
      organizedBtn.textContent = newOrganized ? "Organized \u2713" : "Mark Organized";
    });
  }
  var currentMetadata, currentSwiperRef;
  var init_metadata = __esm({
    "metadata.js"() {
      init_graphql();
      currentMetadata = null;
      currentSwiperRef = null;
    }
  });

  // controls.js
  var controls_exports = {};
  __export(controls_exports, {
    setupEventHandlers: () => setupEventHandlers
  });
  function toggleFullscreen() {
    const container = document.querySelector(".image-deck-container");
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch((err) => {
        console.warn("[Image Deck] Fullscreen request failed:", err);
      });
    } else {
      document.exitFullscreen();
    }
  }
  function setupEventHandlers(container) {
    const closeBtn = container.querySelector(".image-deck-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", closeDeck);
    }
    const fullscreenBtn = container.querySelector(".image-deck-fullscreen");
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener("click", toggleFullscreen);
    }
    const metadataCloseBtn = container.querySelector(".image-deck-metadata-close");
    if (metadataCloseBtn) {
      metadataCloseBtn.addEventListener("click", closeMetadataModal);
    }
    const controlButtons = container.querySelectorAll(".image-deck-control-btn");
    controlButtons.forEach((button) => {
      button.addEventListener("click", (e) => {
        const action = button.dataset.action;
        const swiper = window.currentSwiperInstance;
        if (!action) return;
        switch (action) {
          case "prev":
            if (swiper) {
              swiper.slidePrev();
            } else {
              console.error("[Image Deck] Prev failed: window.currentSwiperInstance is not defined");
            }
            break;
          case "next":
            if (swiper) {
              swiper.slideNext();
              setTimeout(() => {
                loadNextChunk();
              }, 100);
            } else {
              console.error("[Image Deck] Next failed: window.currentSwiperInstance is not defined");
            }
            break;
          case "play":
            const playBtn = document.querySelector('[data-action="play"]');
            const isAutoPlaying2 = playBtn && playBtn.classList.contains("active");
            if (isAutoPlaying2) {
              stopAutoPlay();
            } else {
              startAutoPlay();
            }
            break;
          case "info":
            openMetadataModal();
            break;
          case "next-chunk":
            loadNextChunk();
            break;
          default:
            console.log("[Image Deck] Unknown action:", action);
        }
      });
    });
    document.addEventListener("keydown", handleKeyboard);
    setupSwipeGestures(container);
  }
  function setupSwipeGestures(container) {
    let touchStartY = 0;
    let touchDeltaY = 0;
    let rafId = null;
    const swiperEl = container.querySelector(".image-deck-swiper");
    if (!swiperEl) return;
    swiperEl.addEventListener("touchstart", (e) => {
      if (e.target.closest(".image-deck-metadata-modal")) return;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    swiperEl.addEventListener("touchmove", (e) => {
      if (e.target.closest(".image-deck-metadata-modal")) return;
      touchDeltaY = e.touches[0].clientY - touchStartY;
      if (touchDeltaY > 50) {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          container.style.transform = `translateY(${touchDeltaY * 0.3}px)`;
          container.style.opacity = Math.max(0.3, 1 - touchDeltaY / 500);
        });
      }
    }, { passive: true });
    swiperEl.addEventListener("touchend", () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (touchDeltaY > 150) {
        closeDeck();
      } else {
        requestAnimationFrame(() => {
          container.style.transform = "";
          container.style.opacity = "";
        });
      }
      touchDeltaY = 0;
    }, { passive: true });
  }
  function handleKeyboard(e) {
    const swiper = window.currentSwiperInstance;
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
      if (e.key === "Escape") closeMetadataModal();
      return;
    }
    switch (e.key) {
      case "Escape":
        const modal = document.querySelector(".image-deck-metadata-modal");
        if (modal && modal.classList.contains("active")) {
          closeMetadataModal();
        } else {
          closeDeck();
        }
        break;
      case " ":
        e.preventDefault();
        const playBtn = document.querySelector('[data-action="play"]');
        if (playBtn && playBtn.classList.contains("active")) {
          stopAutoPlay();
        } else {
          startAutoPlay();
        }
        break;
      case "i":
      case "I":
        e.preventDefault();
        const metadataModal = document.querySelector(".image-deck-metadata-modal");
        if (metadataModal && metadataModal.classList.contains("active")) {
          closeMetadataModal();
        } else {
          openMetadataModal();
        }
        break;
      // ADDED: Arrow Key Support
      case "ArrowLeft":
        if (swiper) swiper.slidePrev();
        break;
      case "ArrowRight":
        if (swiper) {
          swiper.slideNext();
          setTimeout(() => loadNextChunk(), 100);
        }
        break;
    }
  }
  var init_controls = __esm({
    "controls.js"() {
      init_deck();
      init_metadata();
    }
  });

  // deck.js
  var deck_exports = {};
  __export(deck_exports, {
    closeDeck: () => closeDeck,
    loadNextChunk: () => loadNextChunk,
    openDeck: () => openDeck,
    startAutoPlay: () => startAutoPlay,
    stopAutoPlay: () => stopAutoPlay
  });
  async function openDeck() {
    console.log("[Image Deck] Opening deck...");
    console.log("[Image Deck] Current URL:", window.location.pathname);
    try {
      currentChunkPage = 1;
      chunkSize = 50;
      totalImageCount = 0;
      totalPages = 0;
      pluginConfig = await getPluginConfig();
      console.log("[Image Deck] Plugin config loaded:", pluginConfig);
      injectDynamicStyles(pluginConfig);
      let detectedContext = detectContext();
      if (window.location.pathname === "/galleries" && !detectedContext?.isGalleryListing) {
        detectedContext = {
          type: "galleries",
          isGalleryListing: true,
          filter: parseUrlFilters(window.location.search)
          // This is the crucial part
        };
      }
      storedContextInfo = detectedContext;
      contextInfo = detectedContext;
      console.log("[Image Deck] Context assigned:", contextInfo);
      let imageResult;
      const isListContext = contextInfo && (contextInfo.isSingleGallery || contextInfo.isGalleryListing || contextInfo.type === "images" || contextInfo.isFilteredView || window.location.pathname.startsWith("/images"));
      if (isListContext) {
        console.log("[Image Deck] Using context-based fetching for page 1");
        imageResult = await fetchContextImages(contextInfo, 1, chunkSize);
      } else {
        console.log("[Image Deck] Falling back to visible images");
        imageResult = getVisibleImages();
      }
      if (Array.isArray(imageResult)) {
        currentImages = imageResult;
        totalImageCount = imageResult.length;
        totalPages = 1;
        currentChunkPage = 1;
      } else if (imageResult) {
        currentImages = imageResult.images || [];
        totalImageCount = imageResult.totalCount || 0;
        totalPages = imageResult.totalPages || 1;
        currentChunkPage = imageResult.currentPage || 1;
      }
      console.log(`[Image Deck] Opening with ${currentImages.length} items (chunk 1 of ${totalPages || 1})`);
      const container = createDeckUI();
      document.body.classList.add("image-deck-open");
      requestAnimationFrame(() => {
        container.classList.add("active");
      });
      currentSwiper = initSwiper(
        container,
        currentImages,
        pluginConfig,
        () => {
          updateUI(container);
          checkAndLoadNextChunk();
        },
        savePosition,
        contextInfo
      );
      window.currentSwiperInstance = currentSwiper;
      restorePosition();
      updateUI(container);
      Promise.resolve().then(() => (init_controls(), controls_exports)).then((module) => {
        module.setupEventHandlers(container);
      });
    } catch (error) {
      console.error("[Image Deck] Error opening deck:", error);
      alert("Error opening Image Deck: " + error.message);
    }
  }
  function createDeckUI() {
    const existing = document.querySelector(".image-deck-container");
    if (existing) existing.remove();
    const container = document.createElement("div");
    container.className = `image-deck-container${isMobile ? " mobile-optimized" : ""}`;
    container.innerHTML = `
        <div class="image-deck-ambient"></div>
        <div class="image-deck-topbar">
            <div class="image-deck-counter"></div>
            <div class="image-deck-topbar-btns">
                <button class="image-deck-fullscreen" title="Toggle Fullscreen">\u26F6</button>
                <button class="image-deck-close">\u2715</button>
            </div>
        </div>
        <div class="image-deck-progress"></div>
        <div class="image-deck-loading"></div>
        <div class="image-deck-swiper swiper">
            <div class="swiper-wrapper"></div>
        </div>
        <div class="image-deck-controls">
            <button class="image-deck-control-btn" data-action="prev">\u25C0</button>
            <button class="image-deck-control-btn" data-action="play">\u25B6</button>
            <button class="image-deck-control-btn" data-action="next">\u25B6</button>
            <button class="image-deck-control-btn image-deck-info-btn" data-action="info" title="Image Info (I)">\u2139</button>
            <button class="image-deck-control-btn" data-action="next-chunk" title="Load Next Chunk">\u23ED\uFE0F</button>
        </div>
        <div class="image-deck-speed">Speed: ${pluginConfig.autoPlayInterval}ms</div>
        <div class="image-deck-metadata-modal">
            <div class="image-deck-metadata-content">
                <div class="image-deck-metadata-header">
                    <h3>Image Details</h3>
                    <button class="image-deck-metadata-close">\u2715</button>
                </div>
                <div class="image-deck-metadata-body"></div>
            </div>
        </div>
    `;
    document.body.appendChild(container);
    return container;
  }
  function updateUI(container) {
    if (!currentSwiper || uiUpdatePending) return;
    uiUpdatePending = true;
    requestAnimationFrame(() => {
      let current = 1;
      const displayedTotal = currentImages.length;
      const actualTotal = totalImageCount || displayedTotal;
      if (currentSwiper.virtual) {
        current = currentSwiper.activeIndex + 1;
      } else {
        if (currentSwiper.params.loop && contextInfo?.isSingleGallery) {
          const realIndex = currentSwiper.realIndex + 1;
          if (realIndex === 0) {
            current = displayedTotal;
          } else if (realIndex > displayedTotal) {
            current = 1;
          } else {
            current = realIndex;
          }
        } else {
          current = currentSwiper.activeIndex + 1;
        }
      }
      if (pluginConfig.showCounter) {
        const counter = container.querySelector(".image-deck-counter");
        const chunkInfo = totalPages > 1 ? ` (chunk ${currentChunkPage}/${totalPages})` : "";
        if (counter) {
          counter.textContent = `${current} of ${actualTotal}${chunkInfo}`;
        }
      }
      if (pluginConfig.showProgressBar) {
        const progress = container.querySelector(".image-deck-progress");
        if (progress) {
          const progressValue = actualTotal > 0 ? current / actualTotal : 0;
          progress.style.transform = `scaleX(${progressValue})`;
        }
      }
      uiUpdatePending = false;
    });
  }
  function checkAndLoadNextChunk() {
    if (!currentSwiper || isChunkLoading) return;
    const currentIndex = currentSwiper.activeIndex;
    const totalCurrentSlides = currentImages.length;
    if (currentIndex >= totalCurrentSlides - 3 && currentChunkPage < totalPages) {
      console.log("[Image Deck] Auto-loading next chunk...");
      loadNextChunk();
    }
  }
  function startAutoPlay() {
    if (!currentSwiper || isAutoPlaying) return;
    isAutoPlaying = true;
    const playBtn = document.querySelector('[data-action="play"]');
    if (playBtn) {
      playBtn.innerHTML = "\u23F8";
      playBtn.classList.add("active");
    }
    autoPlayInterval = setInterval(() => {
      if (currentSwiper.isEnd) {
        stopAutoPlay();
      } else {
        currentSwiper.slideNext();
      }
    }, pluginConfig.autoPlayInterval);
    const speedIndicator = document.querySelector(".image-deck-speed");
    if (speedIndicator) {
      speedIndicator.classList.add("visible");
      setTimeout(() => speedIndicator.classList.remove("visible"), 2e3);
    }
  }
  function stopAutoPlay() {
    if (!isAutoPlaying) return;
    isAutoPlaying = false;
    const playBtn = document.querySelector('[data-action="play"]');
    if (playBtn) {
      playBtn.innerHTML = "\u25B6";
      playBtn.classList.remove("active");
    }
    if (autoPlayInterval) {
      clearInterval(autoPlayInterval);
      autoPlayInterval = null;
    }
  }
  function savePosition() {
    if (!currentSwiper || !contextInfo) return;
    const key = `${PLUGIN_NAME}_position_${contextInfo.type}_${contextInfo.id}`;
    sessionStorage.setItem(key, currentSwiper.activeIndex.toString());
  }
  function restorePosition() {
    if (!currentSwiper || !contextInfo) return;
    const key = `${PLUGIN_NAME}_position_${contextInfo.type}_${contextInfo.id}`;
    const savedPosition = sessionStorage.getItem(key);
    if (savedPosition) {
      const index = parseInt(savedPosition);
      if (!isNaN(index) && index < (currentSwiper.slides.length || currentImages.length)) {
        currentSwiper.slideTo(index, 0);
      }
    }
  }
  async function loadNextChunk() {
    if (isChunkLoading) {
      console.log("[Image Deck] Load already in progress, skipping...");
      return;
    }
    if (currentChunkPage >= totalPages && totalPages !== 0) {
      console.log("[Image Deck] All chunks already loaded.");
      const loadingIndicator2 = document.querySelector(".image-deck-loading");
      if (loadingIndicator2) {
        loadingIndicator2.textContent = "All items loaded";
        setTimeout(() => {
          loadingIndicator2.style.display = "none";
        }, 2e3);
      }
      return;
    }
    isChunkLoading = true;
    const loadingIndicator = document.querySelector(".image-deck-loading");
    const nextChunkButton = document.querySelector('[data-action="next-chunk"]');
    if (nextChunkButton) {
      nextChunkButton.disabled = true;
      nextChunkButton.style.opacity = "0.5";
    }
    if (loadingIndicator) {
      loadingIndicator.style.display = "block";
      loadingIndicator.textContent = `Loading chunk ${currentChunkPage + 1}...`;
    }
    try {
      const contextToUse = storedContextInfo || contextInfo || detectContext();
      if (!contextToUse) throw new Error("Could not detect context for fetching");
      const nextPage = currentChunkPage + 1;
      const result = await fetchContextImages(contextToUse, nextPage, chunkSize);
      if (!result || !result.images || result.images.length === 0) {
        if (loadingIndicator) loadingIndicator.textContent = "No more items found";
        setTimeout(() => {
          if (loadingIndicator) loadingIndicator.style.display = "none";
        }, 2e3);
        return;
      }
      currentImages.push(...result.images);
      currentChunkPage = nextPage;
      totalPages = result.totalPages || totalPages;
      if (currentSwiper && currentSwiper.virtual) {
        const allSlides = currentImages.map((img) => {
          const fullSrc = img.paths.image;
          const isGallery = img.url && !contextInfo?.isSingleGallery;
          if (isGallery) {
            return `
                        <div class="swiper-zoom-container" data-type="gallery" data-url="${img.url}">
                            <div class="gallery-cover-container">
                                <div class="gallery-cover-title" title="${img.title || "Untitled Gallery"}">${img.title || "Untitled Gallery"}</div>
                                <a href="${img.url}" target="_blank" class="gallery-cover-link">
                                    <img src="${fullSrc}" alt="${img.title || ""}" decoding="async" loading="lazy" />
                                </a>
                            </div>
                        </div>`;
          } else {
            return `
                        <div class="swiper-zoom-container" data-type="image">
                            <img src="${fullSrc}" alt="${img.title || ""}" decoding="async" loading="lazy" style="max-width: 100%; height: auto; display: block; margin: 0 auto;" />
                        </div>`;
          }
        });
        currentSwiper.virtual.slides = allSlides;
        currentSwiper.virtual.update(true);
        setTimeout(() => {
          if (currentSwiper) currentSwiper.update();
        }, 100);
      } else {
        const galleryGrid = document.querySelector(".gallery-grid");
        if (galleryGrid) {
          result.images.forEach((img) => {
            const imgHTML = `<div class="gallery-item"><img src="${img.paths.image}" alt="${img.title || ""}" class="gallery-img" /></div>`;
            galleryGrid.insertAdjacentHTML("beforeend", imgHTML);
          });
        }
      }
      const container = document.querySelector(".image-deck-container");
      if (container && typeof updateUI === "function") updateUI(container);
      if (loadingIndicator) {
        loadingIndicator.textContent = `\u2713 Loaded ${result.images.length} new items`;
        setTimeout(() => {
          loadingIndicator.style.display = "none";
        }, 2e3);
      }
    } catch (error) {
      console.error("[Image Deck] Failed to load chunk:", error);
      if (loadingIndicator) {
        loadingIndicator.textContent = "Error: " + error.message;
        setTimeout(() => {
          loadingIndicator.style.display = "none";
        }, 3e3);
      }
    } finally {
      isChunkLoading = false;
      if (nextChunkButton) {
        nextChunkButton.disabled = false;
        nextChunkButton.style.opacity = "1";
      }
    }
  }
  function closeDeck() {
    stopAutoPlay();
    const container = document.querySelector(".image-deck-container");
    if (container) {
      container.classList.remove("active");
      setTimeout(() => {
        container.remove();
        document.body.classList.remove("image-deck-open");
      }, 300);
    }
    if (currentSwiper) {
      currentSwiper.destroy(true, true);
      currentSwiper = null;
    }
    currentImages = [];
    contextInfo = null;
    loadingQueue = [];
  }
  var pluginConfig, currentSwiper, currentImages, autoPlayInterval, isAutoPlaying, contextInfo, loadingQueue, currentChunkPage, chunkSize, totalImageCount, totalPages, storedContextInfo, uiUpdatePending, isChunkLoading;
  var init_deck = __esm({
    "deck.js"() {
      init_config();
      init_context();
      init_swiper();
      init_utils();
      pluginConfig = null;
      currentSwiper = null;
      currentImages = [];
      autoPlayInterval = null;
      isAutoPlaying = false;
      contextInfo = null;
      loadingQueue = [];
      currentChunkPage = 1;
      chunkSize = 50;
      totalImageCount = 0;
      totalPages = 0;
      storedContextInfo = null;
      uiUpdatePending = false;
      isChunkLoading = false;
    }
  });

  // button.js
  init_context();
  var retryTimer = null;
  var observer = new MutationObserver(() => {
    const path = window.location.pathname;
    if (path.startsWith("/galleries") || path.startsWith("/images")) {
      if (!document.getElementById("image-deck-nav-btn")) {
        retryCreateButton();
      }
    } else {
      cleanupButton();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  function createLaunchButton() {
    const buttonId = "image-deck-nav-btn";
    const existing = document.getElementById(buttonId);
    const path = window.location.pathname;
    const isAllowedPath = path.startsWith("/galleries") || path.startsWith("/images");
    if (!isAllowedPath) {
      cleanupButton();
      return;
    }
    const context = detectContext();
    const hasImages = document.querySelectorAll('img[src*="/image/"]').length > 0;
    const hasGalleryCovers = document.querySelectorAll(".gallery-cover img, .gallery-card img").length > 0;
    if (!context && !hasImages && !hasGalleryCovers) {
      return;
    }
    if (existing) return;
    const buttonContainer = document.createElement("div");
    buttonContainer.className = "col-4 col-sm-3 col-md-2 col-lg-auto nav-link";
    const svgPath = "M1075.82857,431.195122 L1092.28571,431.195122 C1093.24511,431.195122 1094.03194,431.944117 1094.10822,432.896752 L1094.11429,433.04878 L1094.11429,457.146341 C1094.11429,458.118901 1093.37543,458.916524 1092.43569,458.993855 L1092.28571,459 L1075.82857,459 C1074.86917,459 1074.08235,458.251005 1074.00606,457.29837 L1074,457.146341 L1074,433.04878 C1074,432.076221 1074.73886,431.278598 1075.6786,431.201267 L1075.82857,431.195122 L1092.28571,431.195122 Z M1091.37143,455.292683 L1089.54286,455.292683 C1089.03791,455.292683 1088.62857,455.707639 1088.62857,456.219512 C1088.62857,456.694823 1088.98152,457.086568 1089.43623,457.140106 L1089.54286,457.146341 L1091.37143,457.146341 C1091.87637,457.146341 1092.28571,456.731386 1092.28571,456.219512 C1092.28571,455.292683 1091.37143,455.292683 1091.37143,455.292683 Z M1102.34286,421 C1104.36264,421 1106,422.659822 1106,424.707317 L1106,448.804878 C1106,450.852373 1104.36264,452.512195 1102.34286,452.512195 L1095.94246,452.512 L1095.94286,433.04878 C1095.94286,431.067334 1094.40943,429.448952 1092.47994,429.346602 L1092.28571,429.341463 L1082.22846,429.341 L1082.22857,424.707317 C1082.22857,422.659822 1083.86593,421 1085.88571,421 L1102.34286,421 Z M1086.05344,440.463415 C1085.45815,440.463415 1084.88108,440.640782 1084.39083,440.966741 L1084.21119,441.095885 L1084.05714,441.223746 C1083.50627,440.735085 1082.79712,440.463415 1082.06038,440.463415 C1081.25617,440.463415 1080.48485,440.787117 1079.91637,441.363404 C1079.34789,441.93969 1079.02857,442.721596 1079.02857,443.536846 C1079.02857,444.279753 1079.29389,444.995021 1079.77147,445.552286 L1079.90694,445.700252 L1083.39256,449.441469 C1083.56488,449.626659 1083.80567,449.731707 1084.05714,449.731707 C1084.2667,449.731707 1084.46884,449.658757 1084.63024,449.527144 L1084.72193,449.441251 L1088.21456,445.6922 C1088.76981,445.125089 1089.08571,444.347508 1089.08571,443.536846 C1089.08571,442.721814 1088.76608,441.939843 1088.19745,441.363404 C1087.62885,440.787001 1086.85796,440.463415 1086.05344,440.463415 Z M1086.05344,442.316702 C1086.37267,442.316702 1086.679,442.445343 1086.90481,442.674253 C1087.13028,442.903164 1087.25705,443.213421 1087.25705,443.536846 C1087.25705,443.767864 1087.19237,443.992164 1087.07315,444.184989 L1086.99516,444.296709 L1086.8954,444.40898 L1084.05713,447.455146 L1081.21766,444.407946 L1081.12406,444.301978 C1080.95023,444.081822 1080.85724,443.814417 1080.85724,443.536846 C1080.85724,443.213014 1080.98381,442.903018 1081.20948,442.674253 C1081.43539,442.445239 1081.74129,442.316702 1082.06038,442.316702 C1082.334,442.316702 1082.59804,442.411199 1082.80974,442.582208 L1082.91104,442.674006 L1083.41059,443.180418 L1083.49666,443.25747 C1083.82251,443.514309 1084.28051,443.516457 1084.6089,443.264169 L1084.70327,443.18085 L1085.20269,442.674099 L1085.30413,442.582283 C1085.51609,442.411237 1085.78017,442.316702 1086.05344,442.316702 Z M1079.94286,443.536846 L1079.94959,443.70688 L1079.94637,443.660494 L1079.94286,443.536846 Z M1080.68629,441.903404 L1080.58,442.001122 L1080.6236,441.959789 C1080.64417,441.940554 1080.66507,441.921752 1080.68629,441.903404 Z M1085.615,441.437122 L1085.39825,441.495321 L1085.56598,441.447588 L1085.615,441.437122 Z M1085.73754,441.413919 L1085.615,441.437122 L1085.63841,441.431846 L1085.73754,441.413919 Z M1078.57143,433.04878 L1076.74286,433.04878 C1076.23791,433.04878 1075.82857,433.463736 1075.82857,433.97561 C1075.82857,434.450921 1076.18152,434.842665 1076.63623,434.896204 L1076.74286,434.902439 L1078.57143,434.902439 C1079.07637,434.902439 1079.48571,434.487483 1079.48571,433.97561 C1079.48571,433.463736 1079.07637,433.04878 1078.57143,433.04878 Z";
    buttonContainer.innerHTML = `
        <a href="javascript:void(0);" id="${buttonId}" class="minimal p-4 p-xl-2 d-flex d-xl-inline-block flex-column justify-content-between align-items-center btn btn-primary" title="Open Image Deck">
            <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="1074 421 32 38" 
                class="svg-inline--fa fa-icon nav-menu-icon d-block d-xl-inline mb-2 mb-xl-0" 
                fill="currentColor"
                width="20"
                height="20"
                aria-hidden="true" 
                role="img">
                <path d="${svgPath}"/>
            </svg>
            <span>Deck Viewer</span>
        </a>
    `;
    const button = buttonContainer.querySelector(`#${buttonId}`);
    button.addEventListener("click", (e) => {
      Promise.resolve().then(() => (init_deck(), deck_exports)).then((module) => module.openDeck());
    });
    const navTarget = document.querySelector(".navbar-nav");
    if (navTarget) {
      navTarget.appendChild(buttonContainer);
    }
  }
  function cleanupButton() {
    const existing = document.getElementById("image-deck-nav-btn");
    if (existing) existing.closest(".nav-link")?.remove();
  }
  function retryCreateButton(attempts = 0, maxAttempts = 5) {
    const path = window.location.pathname;
    const isAllowed = path.startsWith("/galleries") || path.startsWith("/images");
    if (!isAllowed) {
      cleanupButton();
      return;
    }
    const hasContext = detectContext() || document.querySelectorAll('img[src*="/image/"]').length > 0 || document.querySelectorAll(".gallery-cover img, .gallery-card img").length > 0;
    if (hasContext) {
      createLaunchButton();
    } else if (attempts < maxAttempts - 1) {
      clearTimeout(retryTimer);
      const delays = [100, 300, 500, 1e3, 2e3];
      retryTimer = setTimeout(() => retryCreateButton(attempts + 1, maxAttempts), delays[attempts]);
    }
  }

  // ui.js
  init_deck();
  function initialize() {
    console.log("[Image Deck] Initializing...");
    if (typeof Swiper === "undefined") {
      console.error("[Image Deck] Swiper not loaded!");
      return;
    }
    retryCreateButton();
    let debounceTimer;
    const observer2 = new MutationObserver((mutations) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const hasButton = document.querySelector(".image-deck-launch-btn");
        const shouldHaveButton = document.querySelectorAll('img[src*="/image/"]').length > 0 || document.querySelectorAll(".gallery-cover img, .gallery-card img").length > 0;
        if (!hasButton && shouldHaveButton) {
          createLaunchButton();
        }
      }, 300);
    });
    const mainContent = document.querySelector(".main-content") || document.querySelector('[role="main"]') || document.body;
    observer2.observe(mainContent, {
      childList: true,
      subtree: true
      // Watch subtree to catch React updates
    });
    console.log("[Image Deck] Initialized");
  }

  // main.js
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
  var lastUrl = location.href;
  var originalPushState = history.pushState;
  var originalReplaceState = history.replaceState;
  history.pushState = function() {
    originalPushState.apply(history, arguments);
    handleNavigation();
  };
  history.replaceState = function() {
    originalReplaceState.apply(history, arguments);
    handleNavigation();
  };
  window.addEventListener("popstate", handleNavigation);
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      handleNavigation();
    }
  }, 500);
  function handleNavigation() {
    lastUrl = location.href;
    const existingButton = document.querySelector(".image-deck-launch-btn");
    if (existingButton) {
      existingButton.remove();
    }
    const existingDeck = document.querySelector(".image-deck-container");
    if (existingDeck) {
      existingDeck.remove();
      document.body.classList.remove("image-deck-open");
    }
  }
})();
