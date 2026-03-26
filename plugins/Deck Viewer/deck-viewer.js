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
      const params = new URLSearchParams(search);
      if (galleryIdMatch) {
        const filter = parseUrlFilters2(search);
        if (!params.get("sortby") && !params.get("sortdir")) {
          filter.sortBy = "title";
          filter.sortDir = "asc";
        }
        return { type: "galleries", id: galleryIdMatch[1], hash, isSingleGallery: true, filter };
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
    const performerMatch = path.match(/^\/performers\/(\d+)(?:\/(galleries|images))?/);
    if (performerMatch) {
      const [, performerId, tab] = performerMatch;
      const isImagesTab = tab === "images" || hash.includes("images") || document.querySelector(".nav-tabs .active")?.textContent?.includes("Images");
      const isGalleriesTab = tab === "galleries" || hash.includes("galleries") || document.querySelector(".nav-tabs .active")?.textContent?.includes("Galleries");
      const activeTab = isGalleriesTab ? "galleries" : "images";
      const filter = {
        performers: { value: [performerId], modifier: "INCLUDES" }
      };
      const params = new URLSearchParams(search);
      if (params.has("sortby")) {
        filter.sortBy = params.get("sortby");
      }
      if (params.has("sortdir")) {
        filter.sortDir = params.get("sortdir");
      }
      return {
        type: activeTab,
        id: performerId,
        filter,
        isPerformerContext: true,
        performerId,
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
    let sortDir = "asc";
    if (params.has("sortdir")) {
      sortDir = params.get("sortdir") || "asc";
    }
    return {
      ...parsedFilter,
      sortBy: params.get("sortby") || "created_at",
      sortDir,
      perPage: parseInt(params.get("perPage")) || 40
    };
  }
  function getVisibleImages() {
    const images = [];
    const imageGrid = document.querySelector('.main-content, [role="main"]') || document.body;
    const imageElements = imageGrid.querySelectorAll(".image-card img, .grid-card img");
    const imageArray = Array.from(imageElements);
    imageArray.forEach((img, index) => {
      if (img.src && img.src.includes("/image/") && !img.src.includes("/studio/") && !img.closest(".logo, .sidebar, .header")) {
        const idMatch = img.src.match(/\/image\/(\d+)/);
        const id = idMatch ? idMatch[1] : `img_${index}`;
        const fullImageUrl = img.src.includes("/thumbnail/") ? img.src.replace("/thumbnail/", "/image/") : img.src;
        const card = img.closest(".image-card, .grid-card");
        const previewButton = card?.querySelector(".preview-button");
        images.push({
          id,
          title: img.alt || `Image ${index + 1}`,
          paths: {
            image: fullImageUrl
          },
          // Store reference to preview button
          previewButton
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
					id title image_count cover { paths { thumbnail image } }
					performers {
						id
						name
					}
					tags {
						id
					}
				}
			}
		}`;
    } else {
      query = `query FindImages($filter: FindFilterType!, $image_filter: ImageFilterType) {
            findImages(filter: $filter, image_filter: $image_filter) {
                count
                images {
                    id title paths { thumbnail image }
                    performers {
                        id
                    }
                    tags {
                        id
                    }
                }
            }
        }`;
    }
    let activeFilter = {};
    let exclusions = {};
    if (isSingleGallery && id) {
      activeFilter = { galleries: { value: [id], modifier: "INCLUDES" } };
    } else if (filter) {
      if (isFetchingGalleries) {
        const galleryAllowedFields = [
          "tags",
          "performers",
          "studios",
          "markers",
          "path",
          "rating100",
          "organized",
          "is_missing",
          "image_count",
          "date",
          "url",
          "photographer",
          "code"
        ];
        galleryAllowedFields.forEach((field) => {
          if (filter[field]) {
            if (filter[field].excluded && filter[field].excluded.length > 0) {
              exclusions[field] = filter[field].excluded;
              if (filter[field].value && filter[field].value.length > 0) {
                activeFilter[field] = {
                  value: filter[field].value,
                  modifier: filter[field].modifier
                };
              }
            } else {
              activeFilter[field] = {
                value: filter[field].value,
                modifier: filter[field].modifier
              };
            }
          }
        });
      } else {
        const imageAllowedFields = [
          "tags",
          "performers",
          "studios",
          "markers",
          "galleries",
          "path",
          "rating100",
          "organized",
          "is_missing"
        ];
        imageAllowedFields.forEach((field) => {
          if (filter[field]) {
            if (filter[field].excluded && filter[field].excluded.length > 0) {
              exclusions[field] = filter[field].excluded;
              if (filter[field].value && filter[field].value.length > 0) {
                activeFilter[field] = {
                  value: filter[field].value,
                  modifier: filter[field].modifier
                };
              }
            } else {
              activeFilter[field] = {
                value: filter[field].value,
                modifier: filter[field].modifier
              };
            }
          }
        });
      }
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
        let result = data?.data?.findGalleries;
        totalCount = result?.count || 0;
        if (Object.keys(exclusions).length > 0 && result?.galleries) {
          result.galleries = result.galleries.filter((item) => {
            for (const [fieldType, excludedIds] of Object.entries(exclusions)) {
              if (excludedIds.length > 0) {
                if (item[fieldType] && item[fieldType].length > 0) {
                  const hasExcludedItem = item[fieldType].some(
                    (fieldItem) => excludedIds.includes(fieldItem.id)
                  );
                  if (hasExcludedItem) {
                    return false;
                  }
                }
              }
            }
            return true;
          });
          totalCount = result.galleries.length;
        }
        normalizedImages = (result?.galleries || []).map((gallery) => ({
          id: gallery.id,
          title: gallery.title,
          image_count: gallery.image_count,
          performers: gallery.performers || [],
          // Add this line
          isGallery: true,
          type: "gallery",
          paths: { image: gallery.cover?.paths?.image || gallery.cover?.paths?.thumbnail || "" },
          url: `/galleries/${gallery.id}`
        }));
      } else {
        let result = data?.data?.findImages;
        totalCount = result?.count || 0;
        if (Object.keys(exclusions).length > 0 && result?.images) {
          result.images = result.images.filter((item) => {
            for (const [fieldType, excludedIds] of Object.entries(exclusions)) {
              if (excludedIds.length > 0) {
                if (item[fieldType] && item[fieldType].length > 0) {
                  const hasExcludedItem = item[fieldType].some(
                    (fieldItem) => excludedIds.includes(fieldItem.id)
                  );
                  if (hasExcludedItem) {
                    return false;
                  }
                }
              }
            }
            return true;
          });
          totalCount = result.images.length;
        }
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
        
        /* New control layout styles */
        .image-deck-controls-wrapper {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            z-index: 1002;
        }
        
        .image-deck-zoom-controls {
            display: flex;
            gap: 10px;
        }
        
        .image-deck-navigation-controls {
            display: flex;
            gap: 10px;
        }
        
        .image-deck-control-btn {
            background: rgba(0, 0, 0, 0.7);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 16px;
            transition: all 0.2s ease;
            backdrop-filter: blur(5px);
        }
        
        .image-deck-control-btn:hover {
            background: rgba(50, 50, 50, 0.9);
            transform: scale(1.1);
        }
        
        .image-deck-control-btn:active {
            transform: scale(0.95);
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
            max-height: 500px;
            aspect-ratio: 3 / 5;
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
            
            .image-deck-control-btn {
                width: 35px;
                height: 35px;
                font-size: 14px;
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
            
            .image-deck-control-btn {
                width: 30px;
                height: 30px;
                font-size: 12px;
            }
        }
        
        /* Transition for fading UI elements */
        .image-deck-topbar,
        .image-deck-controls-wrapper,
        .image-deck-speed {
            transition: opacity 0.3s ease;
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
  function setCurrentSwiper(swiper) {
    currentSwiperRef = swiper;
  }
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

  // swiper.js
  function getEffectOptions(effect, pluginConfig2) {
    const configFn = EFFECT_CONFIGS[effect] || EFFECT_CONFIGS.default;
    return configFn(pluginConfig2.effectDepth);
  }
  function initSwiper(container2, images, pluginConfig2, updateUICallback, savePositionCallback, contextInfo2) {
    const swiperEl = container2.querySelector(".swiper");
    if (!swiperEl || swiperEl.swiper) return swiperEl?.swiper;
    const isLooped = false;
    const effectOptions = getEffectOptions(pluginConfig2.transitionEffect, pluginConfig2);
    const swiperConfig = {
      // Core Layout
      effect: pluginConfig2.transitionEffect,
      centeredSlides: true,
      slidesPerView: 1,
      initialSlide: 0,
      // Zoom functionality
      zoom: {
        maxRatio: 3,
        minRatio: 1,
        toggle: true,
        containerClass: "swiper-zoom-container",
        zoomedSlideClass: "swiper-slide-zoomed"
      },
      // Add double tap settings
      doubleTapZoom: true,
      doubleTapZoomRatio: 2,
      // Center Fixes
      centeredSlidesBounds: true,
      centerInsufficientSlides: true,
      // Touch settings for better mobile experience
      touchRatio: 1,
      touchAngle: 45,
      simulateTouch: true,
      shortSwipes: true,
      longSwipes: true,
      longSwipesRatio: 0.5,
      longSwipesMs: 300,
      // Prevent interference with pinch zoom
      passiveListeners: false,
      // Loop + Virtual Stability
      loop: isLooped,
      loopedSlides: 2,
      loopPreventsSliding: false,
      virtual: {
        slides: images.map((img) => getSlideTemplate(img, contextInfo2, false)),
        cache: true,
        addSlidesBefore: 3,
        addSlidesAfter: 3,
        renderSlide: (slideContent, index) => {
          return `<div class="swiper-slide" data-index="${index}">${slideContent || ""}</div>`;
        }
      },
      ...effectOptions,
      on: {
        click(s, event) {
          const zoomContainer = event.target.closest('.swiper-zoom-container[data-type="gallery"]');
          if (zoomContainer?.dataset.url) {
            window.open(zoomContainer.dataset.url, "_blank");
          }
        },
        slideChange() {
          updateUICallback?.(container2);
          savePositionCallback?.();
        },
        // Handle infinite loading/pagination logic
        slideChangeTransitionEnd() {
          const total = this.virtual?.slides?.length || this.slides.length;
          if (total > 0 && this.activeIndex >= total - 3) {
            const nextBtn = document.querySelector('[data-action="next-chunk"]');
            if (nextBtn && !nextBtn.disabled) {
              nextBtn.click();
            }
          }
        },
        // Double tap handler
        doubleTap: function(swiper2, event) {
          console.log("[Image Deck] Double tap detected, scale:", swiper2.zoom.scale);
          if (swiper2.zoom) {
            const activeSlide = swiper2.slides[swiper2.activeIndex];
            if (activeSlide) {
              const zoomContainer = activeSlide.querySelector(".swiper-zoom-container");
              if (zoomContainer && zoomContainer.dataset.type !== "gallery") {
                if (swiper2.zoom.scale <= 1) {
                  swiper2.zoom.in(swiper2.params.doubleTapZoomRatio || 2);
                  console.log("[Image Deck] Zooming in to ratio:", swiper2.params.doubleTapZoomRatio || 2);
                } else {
                  swiper2.zoom.out();
                  console.log("[Image Deck] Zooming out");
                }
              }
            }
          }
        },
        // Touch start handler
        touchStart: function(swiper2, event) {
          console.log("[Image Deck] Touch start");
        },
        // Touch end handler  
        touchEnd: function(swiper2, event) {
          console.log("[Image Deck] Touch end");
        }
      }
    };
    const swiper = new Swiper(swiperEl, swiperConfig);
    const loader = container2.querySelector(".image-deck-loading");
    if (loader) loader.style.display = "none";
    return swiper;
  }
  var GALLERY_ICON_SVG, EFFECT_CONFIGS, getSlideTemplate;
  var init_swiper = __esm({
    "swiper.js"() {
      GALLERY_ICON_SVG = '<svg fill="white" width="16" height="16" viewBox="0 0 36 36" style="vertical-align: middle;" xmlns="http://www.w3.org/2000/svg"><path d="M32,4H4A2,2,0,0,0,2,6V30a2,2,0,0,0,2,2H32a2,2,0,0,0,2-2V6A2,2,0,0,0,32,4ZM4,30V6H32V30Z"></path><path d="M8.92,14a3,3,0,1,0-3-3A3,3,0,0,0,8.92,14Zm0-4.6A1.6,1.6,0,1,1,7.33,11,1.6,1.6,0,0,1,8.92,9.41Z"></path><path d="M22.78,15.37l-5.4,5.4-4-4a1,1,0,0,0-1.41,0L5.92,22.9v2.83l6.79-6.79L16,22.18l-3.75,3.75H15l8.45-8.45L30,24V21.18l-5.81-5.81A1,1,0,0,0,22.78,15.37Z"></path></svg>';
      EFFECT_CONFIGS = {
        cards: () => ({ cardsEffect: { slideShadows: false, rotate: true, perSlideRotate: 2, perSlideOffset: 8 } }),
        coverflow: (depth) => ({ coverflowEffect: { rotate: 30, stretch: 0, depth: Math.min(depth, 100), modifier: 1, slideShadows: false } }),
        flip: () => ({ flipEffect: { slideShadows: false, limitRotation: true } }),
        cube: () => ({ cubeEffect: { shadow: false, slideShadows: false } }),
        fade: () => ({ fadeEffect: { crossFade: true }, speed: 200 }),
        default: () => ({ spaceBetween: 20, slidesPerView: 1 })
      };
      getSlideTemplate = (img, contextInfo2, isEager = false) => {
        const fullSrc = img.paths.image;
        const isGallery = img.url && !contextInfo2?.isSingleGallery;
        const loading = isEager ? "eager" : "lazy";
        const title = img.title || "Untitled";
        if (isGallery) {
          const imageCountDisplay = img.image_count !== void 0 ? `${GALLERY_ICON_SVG}: ${img.image_count}` : "";
          let performerDisplay = "";
          if (img.performers && img.performers.length > 0) {
            const performerNames = img.performers.map((p) => p.name).join(", ");
            performerDisplay = `<div class="gallery-performers" style="margin-top: 5px; font-size: 18px; color: #ccc;">${performerNames}</div>`;
          }
          return `
            <div class="swiper-zoom-container" data-type="gallery" data-url="${img.url}">
                <div class="gallery-cover-container">
                    <div class="gallery-cover-title" title="${title}">${title}</div>
                    ${imageCountDisplay ? `<div class="gallery-image-count" style="font-size: 18px; color: #ccc; margin-top: 3px;">${imageCountDisplay}</div>` : ""}
                    <a href="${img.url}" target="_blank" class="gallery-cover-link">
                        <img src="${fullSrc}" alt="${title}" decoding="async" loading="${loading}" />
                    </a>
                    ${performerDisplay}
                </div>
            </div>`;
        }
        return `
        <div class="swiper-zoom-container">
            <img src="${fullSrc}" alt="${title}" decoding="async" loading="${loading}" 
                 style="max-width: 100%; height: auto; display: block; margin: 0 auto;" />
        </div>`;
      };
    }
  });

  // controls.js
  var controls_exports = {};
  __export(controls_exports, {
    cleanupEventHandlers: () => cleanupEventHandlers,
    setDeckActive: () => setDeckActive,
    setupEventHandlers: () => setupEventHandlers
  });
  function toggleFullscreen() {
    const container2 = document.querySelector(".image-deck-container");
    if (!container2) return;
    if (!document.fullscreenElement) {
      container2.requestFullscreen().catch((err) => {
        console.warn("[Image Deck] Fullscreen request failed:", err);
      }).finally(() => {
        updateFullscreenUI(true);
      });
    } else {
      document.exitFullscreen().finally(() => {
        updateFullscreenUI(false);
      });
    }
  }
  function updateFullscreenUI(isFullscreen) {
    const fullscreenBtn = document.querySelector(".image-deck-fullscreen");
    if (fullscreenBtn) {
      fullscreenBtn.textContent = isFullscreen ? "\u26F6" : "\u26F6";
    }
    const container2 = document.querySelector(".image-deck-container");
    if (container2) {
      if (isFullscreen) {
        container2.classList.add("fullscreen-mode");
      } else {
        container2.classList.remove("fullscreen-mode");
      }
    }
  }
  function isCurrentSlideGallery() {
    const swiper = window.currentSwiperInstance;
    if (swiper && swiper.slides) {
      const activeSlide = swiper.slides[swiper.activeIndex];
      if (activeSlide) {
        const zoomContainer = activeSlide.querySelector(".swiper-zoom-container");
        if (zoomContainer && zoomContainer.dataset.type === "gallery") {
          return true;
        }
      }
    }
    return false;
  }
  function updateGalleryStateClass() {
    const container2 = document.querySelector(".image-deck-container");
    if (!container2) return;
    if (isCurrentSlideGallery()) {
      container2.classList.add("gallery-active");
    } else {
      container2.classList.remove("gallery-active");
    }
  }
  function setupEventHandlers(container2) {
    setDeckActive(true);
    const closeBtn = container2.querySelector(".image-deck-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", closeDeck);
    }
    const fullscreenBtn = container2.querySelector(".image-deck-fullscreen");
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener("click", toggleFullscreen);
    }
    const metadataCloseBtn = container2.querySelector(".image-deck-metadata-close");
    if (metadataCloseBtn) {
      metadataCloseBtn.addEventListener("click", closeMetadataModal);
    }
    const controlButtons = container2.querySelectorAll(".image-deck-control-btn");
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
          case "zoom-in":
            if (swiper && swiper.zoom && !isCurrentSlideGallery()) {
              swiper.zoom.in();
            }
            break;
          case "zoom-out":
            if (swiper && swiper.zoom && !isCurrentSlideGallery()) {
              swiper.zoom.out();
            }
            break;
          case "next-chunk":
            loadNextChunk(container2);
            break;
          default:
            console.log("[Image Deck] Unknown action:", action);
        }
      });
    });
    if (window.currentSwiperInstance) {
      window.currentSwiperInstance.on("slideChangeTransitionEnd", function() {
        updateGalleryStateClass();
      });
      setTimeout(() => {
        updateGalleryStateClass();
      }, 0);
    }
    keyboardHandler = handleKeyboard;
    document.addEventListener("keydown", handleKeyboard, true);
    setupSwipeGestures(container2);
    setupMouseWheel(container2);
  }
  function setupSwipeGestures(container2) {
    let touchStartY = 0;
    let touchStartX = 0;
    let touchDeltaY = 0;
    let touchDeltaX = 0;
    let rafId = null;
    let lastTouchTime = 0;
    let lastTouchX = 0;
    let lastTouchY = 0;
    const swiperEl = container2.querySelector(".image-deck-swiper");
    if (!swiperEl) return;
    swiperEl.addEventListener("touchstart", (e) => {
      if (e.touches.length > 1) return;
      if (e.target.closest(".image-deck-metadata-modal")) return;
      const currentTime = (/* @__PURE__ */ new Date()).getTime();
      const touchX = e.touches[0].clientX;
      const touchY = e.touches[0].clientY;
      if (currentTime - lastTouchTime < 300 && Math.abs(touchX - lastTouchX) < 20 && Math.abs(touchY - lastTouchY) < 20) {
        handleDoubleTapZoom(e, container2);
        e.preventDefault();
        return;
      }
      lastTouchTime = currentTime;
      lastTouchX = touchX;
      lastTouchY = touchY;
      touchStartY = e.touches[0].clientY;
      touchStartX = e.touches[0].clientX;
      touchDeltaY = 0;
      touchDeltaX = 0;
    }, { passive: false });
    swiperEl.addEventListener("touchmove", (e) => {
      if (e.touches.length > 1) {
        if (rafId) cancelAnimationFrame(rafId);
        container2.style.transform = "";
        container2.style.opacity = "";
        return;
      }
      if (e.target.closest(".image-deck-metadata-modal")) return;
      const currentY = e.touches[0].clientY;
      const currentX = e.touches[0].clientX;
      touchDeltaY = currentY - touchStartY;
      touchDeltaX = Math.abs(currentX - touchStartX);
      const isInFullscreen = !!document.fullscreenElement;
      if (!isInFullscreen && touchDeltaY > 30 && touchDeltaX < 50) {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          container2.style.transform = `translateY(${touchDeltaY * 0.3}px)`;
          container2.style.opacity = Math.max(0.3, 1 - touchDeltaY / 500);
        });
      }
    }, { passive: true });
    swiperEl.addEventListener("touchend", (e) => {
      if (rafId) cancelAnimationFrame(rafId);
      const isInFullscreen = !!document.fullscreenElement;
      if (!isInFullscreen && touchDeltaY > 150 && touchDeltaX < 50) {
        closeDeck();
      } else {
        requestAnimationFrame(() => {
          container2.style.transform = "";
          container2.style.opacity = "";
        });
      }
      touchDeltaY = 0;
      touchDeltaX = 0;
    }, { passive: true });
  }
  function handleDoubleTapZoom(event, container2) {
    const swiper = window.currentSwiperInstance;
    if (!swiper || !swiper.zoom) return;
    if (isCurrentSlideGallery()) {
      console.log("[Image Deck] Double tap ignored - gallery slide");
      return;
    }
    const rect = event.target.getBoundingClientRect();
    const x = event.touches[0].clientX - rect.left;
    const y = event.touches[0].clientY - rect.top;
    if (swiper.zoom.scale === 1) {
      swiper.zoom.in(swiper.zoom.enabled ? 2 : 1);
      console.log("[Image Deck] Double tap zoom in");
    } else {
      swiper.zoom.out();
      console.log("[Image Deck] Double tap zoom out");
    }
    event.preventDefault();
  }
  function setupMouseWheel(container2) {
    const swiperEl = container2.querySelector(".image-deck-swiper");
    if (!swiperEl) return;
    swiperEl.addEventListener("wheel", (e) => {
      const swiper = window.currentSwiperInstance;
      if (!swiper) return;
      e.preventDefault();
      if (swiper.wheeling) return;
      swiper.wheeling = true;
      if (e.deltaY > 0) {
        swiper.slideNext();
      } else if (e.deltaY < 0) {
        swiper.slidePrev();
      }
      setTimeout(() => {
        if (swiper) swiper.wheeling = false;
      }, 150);
    }, { passive: false });
  }
  function setDeckActive(active) {
    isDeckActive = active;
  }
  function handleKeyboard(e) {
    if (!isDeckActive) return;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "Escape", "+", "-", "0"].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
    }
    const swiper = window.currentSwiperInstance;
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
      if (e.key === "Escape") {
        closeMetadataModal();
        return;
      }
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
        e.stopPropagation();
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
        e.stopPropagation();
        const metadataModal = document.querySelector(".image-deck-metadata-modal");
        if (metadataModal && metadataModal.classList.contains("active")) {
          closeMetadataModal();
        } else {
          openMetadataModal();
        }
        break;
      // ZOOM CONTROLS
      case "+":
      case "=":
        e.preventDefault();
        if (swiper && swiper.zoom && !isCurrentSlideGallery()) {
          swiper.zoom.in();
        }
        break;
      case "-":
      case "_":
        e.preventDefault();
        if (swiper && swiper.zoom && !isCurrentSlideGallery()) {
          swiper.zoom.out();
        }
        break;
      case "0":
        e.preventDefault();
        if (swiper && swiper.zoom && !isCurrentSlideGallery()) {
          swiper.zoom.reset();
        }
        break;
      // ARROW KEY SUPPORT
      case "ArrowLeft":
        e.preventDefault();
        e.stopPropagation();
        if (swiper) {
          swiper.slidePrev();
        }
        break;
      case "ArrowRight":
        e.preventDefault();
        e.stopPropagation();
        if (swiper) {
          swiper.slideNext();
          setTimeout(() => {
            if (window.currentSwiperInstance) {
              const currentIndex = window.currentSwiperInstance.activeIndex;
              const totalCurrentSlides = window.currentSwiperInstance.virtual ? window.currentSwiperInstance.virtual.slides.length : window.currentSwiperInstance.slides.length;
              const totalPagesLocal = totalPages || 1;
              if (currentIndex >= totalCurrentSlides - 3 && currentChunkPage < totalPagesLocal) {
                loadNextChunk(container);
              }
            }
          }, 100);
        }
        break;
    }
  }
  function cleanupEventHandlers() {
    if (keyboardHandler) {
      document.removeEventListener("keydown", keyboardHandler, true);
      keyboardHandler = null;
    }
    isDeckActive = false;
  }
  var isDeckActive, keyboardHandler;
  var init_controls = __esm({
    "controls.js"() {
      init_deck();
      init_metadata();
      isDeckActive = false;
      keyboardHandler = null;
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
  async function openDeck(targetImageId = null) {
    console.log("[Image Deck] Opening deck...", targetImageId);
    console.log("[Image Deck] Current URL:", window.location.pathname);
    try {
      currentChunkPage2 = 1;
      chunkSize = 50;
      totalImageCount = 0;
      totalPages2 = 0;
      pluginConfig = await getPluginConfig();
      console.log("[Image Deck] Plugin config loaded:", pluginConfig);
      injectDynamicStyles(pluginConfig);
      let detectedContext = detectContext();
      const path = window.location.pathname;
      if (path.match(/^\/performers\/\d+/) && !detectedContext) {
        const performerMatch = path.match(/^\/performers\/(\d+)/);
        if (performerMatch) {
          const performerId = performerMatch[1];
          const isImagesTab = path.includes("/images") || window.location.hash.includes("images") || document.querySelector(".nav-tabs .active")?.textContent?.includes("Images");
          const isGalleriesTab = path.includes("/galleries") || window.location.hash.includes("galleries") || document.querySelector(".nav-tabs .active")?.textContent?.includes("Galleries");
          const type = isGalleriesTab ? "galleries" : "images";
          detectedContext = {
            type,
            id: performerId,
            performerId,
            isPerformerContext: true,
            filter: {
              performers: { value: [performerId], modifier: "INCLUDES" },
              sortBy: "created_at",
              sortDir: "desc"
            }
          };
          const params = new URLSearchParams(window.location.search);
          if (params.has("sortby")) {
            detectedContext.filter.sortBy = params.get("sortby");
          }
          if (params.has("sortdir")) {
            detectedContext.filter.sortDir = params.get("sortdir");
          }
        }
      }
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
      const isListContext = contextInfo && (contextInfo.isSingleGallery || contextInfo.isGalleryListing || contextInfo.type === "images" || contextInfo.isFilteredView || contextInfo.isPerformerContext || // Add performer context
      window.location.pathname.startsWith("/images"));
      if (targetImageId) {
        console.log("[Image Deck] Using visible images for target navigation");
        imageResult = getVisibleImages();
      } else if (isListContext) {
        console.log("[Image Deck] Using context-based fetching for page 1");
        imageResult = await fetchContextImages(contextInfo, 1, chunkSize);
      } else {
        console.log("[Image Deck] Falling back to visible images");
        imageResult = getVisibleImages();
      }
      if (Array.isArray(imageResult)) {
        currentImages = imageResult;
        totalImageCount = imageResult.length;
        totalPages2 = 1;
        currentChunkPage2 = 1;
      } else if (imageResult) {
        currentImages = imageResult.images || [];
        totalImageCount = imageResult.totalCount || 0;
        totalPages2 = imageResult.totalPages || 1;
        currentChunkPage2 = imageResult.currentPage || 1;
      }
      console.log(`[Image Deck] Opening with ${currentImages.length} items (chunk 1 of ${totalPages2 || 1})`);
      const container2 = createDeckUI();
      document.body.classList.add("image-deck-open");
      requestAnimationFrame(() => {
        container2.classList.add("active");
      });
      currentSwiper = initSwiper(
        container2,
        currentImages,
        pluginConfig,
        () => {
          updateUI(container2);
          checkAndLoadNextChunk();
        },
        savePosition,
        contextInfo
      );
      window.currentSwiperInstance = currentSwiper;
      window.currentImages = currentImages;
      setCurrentSwiper(currentSwiper);
      if (currentSwiper) {
        currentSwiper.on("zoomChange", (swiper, scale) => {
          const topBar = container2.querySelector(".image-deck-topbar");
          const controls = container2.querySelector(".image-deck-controls");
          const speedIndicator = container2.querySelector(".image-deck-speed");
          if (scale > 1) {
            if (topBar) topBar.style.opacity = "0";
            if (controls) controls.style.opacity = "0";
            if (speedIndicator) speedIndicator.style.opacity = "0";
          } else {
            if (topBar) topBar.style.opacity = "1";
            if (controls) controls.style.opacity = "1";
            if (speedIndicator) speedIndicator.style.opacity = "1";
          }
        });
      }
      if (targetImageId) {
        const targetIndex = currentImages.findIndex((img) => img.id === targetImageId);
        if (targetIndex !== -1) {
          console.log(`[Image Deck] Navigating to target image at index ${targetIndex}`);
          setTimeout(() => {
            if (currentSwiper) {
              currentSwiper.slideTo(targetIndex, 0);
              updateUI(container2);
            }
          }, 100);
        } else {
          console.warn(`[Image Deck] Target image ${targetImageId} not found in current images`);
          restorePosition();
        }
      } else {
        restorePosition();
      }
      updateUI(container2);
      Promise.resolve().then(() => (init_controls(), controls_exports)).then((module) => {
        module.setupEventHandlers(container2);
      });
    } catch (error) {
      console.error("[Image Deck] Error opening deck:", error);
      alert("Error opening Image Deck: " + error.message);
    }
  }
  function createDeckUI() {
    const existing = document.querySelector(".image-deck-container");
    if (existing) existing.remove();
    const container2 = document.createElement("div");
    container2.className = `image-deck-container${isMobile ? " mobile-optimized" : ""}`;
    container2.innerHTML = `
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
        <div class="image-deck-controls-wrapper">
            <div class="image-deck-zoom-controls">
                <button class="image-deck-control-btn" data-action="zoom-in" title="Zoom In (+)">\u2795</button>
                <button class="image-deck-control-btn" data-action="zoom-out" title="Zoom Out (-)">\u2796</button>
            </div>
            <div class="image-deck-navigation-controls">
                <button class="image-deck-control-btn" data-action="prev">\u25C0</button>
                <button class="image-deck-control-btn" data-action="play">\u25B6</button>
                <button class="image-deck-control-btn" data-action="next">\u25B6</button>
                <button class="image-deck-control-btn image-deck-info-btn" data-action="info" title="Image Info (I)">\u2139</button>
                <button class="image-deck-control-btn" data-action="next-chunk" title="Load Next Chunk">\u23ED\uFE0F</button>
            </div>
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
    document.body.appendChild(container2);
    return container2;
  }
  function updateUI(container2) {
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
        const counter = container2.querySelector(".image-deck-counter");
        const chunkInfo = totalPages2 > 1 ? ` (chunk ${currentChunkPage2}/${totalPages2})` : "";
        if (counter) {
          counter.textContent = `${current} of ${actualTotal}${chunkInfo}`;
        }
      }
      if (pluginConfig.showProgressBar) {
        const progress = container2.querySelector(".image-deck-progress");
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
    if (currentIndex >= totalCurrentSlides - 3 && currentChunkPage2 < totalPages2) {
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
  async function loadNextChunk(container2 = null) {
    if (isChunkLoading) {
      console.log("[Image Deck] Load already in progress, skipping...");
      return;
    }
    if (currentChunkPage2 >= totalPages2 && totalPages2 !== 0) {
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
      nextChunkButton.innerHTML = "\u{1F504}";
    }
    if (loadingIndicator) {
      loadingIndicator.style.display = "block";
      loadingIndicator.textContent = `Loading chunk ${currentChunkPage2 + 1}...`;
    }
    try {
      const contextToUse = storedContextInfo || contextInfo || detectContext();
      if (!contextToUse) throw new Error("Could not detect context for fetching");
      const nextPage = currentChunkPage2 + 1;
      const result = await fetchContextImages(contextToUse, nextPage, chunkSize);
      if (!result || !result.images || result.images.length === 0) {
        if (loadingIndicator) loadingIndicator.textContent = "No more items found";
        setTimeout(() => {
          if (loadingIndicator) loadingIndicator.style.display = "none";
        }, 2e3);
        return;
      }
      currentImages.push(...result.images);
      currentChunkPage2 = nextPage;
      totalPages2 = result.totalPages || totalPages2;
      if (currentSwiper && currentSwiper.virtual) {
        const allSlides = currentImages.map((img) => {
          const fullSrc = img.paths.image;
          const isGallery = img.url && !contextInfo?.isSingleGallery;
          const title = img.title || "Untitled";
          const loading = "lazy";
          if (isGallery) {
            const imageCountDisplay = img.image_count !== void 0 ? `${GALLERY_ICON_SVG2}: ${img.image_count}` : "";
            let performerDisplay = "";
            if (img.performers && img.performers.length > 0) {
              const performerNames = img.performers.map((p) => p.name).join(", ");
              performerDisplay = `<div class="gallery-performers" style="margin-top: 5px; font-size: 18px; color: #ccc;">${performerNames}</div>`;
            }
            return `
            <div class="swiper-zoom-container" data-type="gallery" data-url="${img.url}">
                <div class="gallery-cover-container">
                    <div class="gallery-cover-title" title="${title}">${title}</div>
                    ${imageCountDisplay ? `<div class="gallery-image-count" style="font-size: 18px; color: #ccc; margin-top: 3px;">${imageCountDisplay}</div>` : ""}
                    <a href="${img.url}" target="_blank" class="gallery-cover-link">
                        <img src="${fullSrc}" alt="${title}" decoding="async" loading="${loading}" />
                    </a>
                    ${performerDisplay}
                </div>
            </div>`;
          }
          return `
			<div class="swiper-zoom-container" data-type="image">
				<img src="${fullSrc}" alt="${title}" decoding="async" loading="${loading}" 
					 style="max-width: 100%; height: auto; display: block; margin: 0 auto;" />
			</div>`;
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
      const container3 = document.querySelector(".image-deck-container");
      if (container3 && typeof updateUI === "function") updateUI(container3);
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
        nextChunkButton.innerHTML = "\u23ED\uFE0F";
      }
    }
  }
  function closeDeck() {
    stopAutoPlay();
    Promise.resolve().then(() => (init_controls(), controls_exports)).then((module) => {
      module.cleanupEventHandlers();
    });
    const container2 = document.querySelector(".image-deck-container");
    if (container2) {
      container2.classList.remove("active");
      setTimeout(() => {
        container2.remove();
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
    if (autoPlayInterval) {
      clearInterval(autoPlayInterval);
      autoPlayInterval = null;
    }
    isAutoPlaying = false;
  }
  var GALLERY_ICON_SVG2, pluginConfig, currentSwiper, currentImages, autoPlayInterval, isAutoPlaying, contextInfo, loadingQueue, currentChunkPage2, chunkSize, totalImageCount, totalPages2, storedContextInfo, uiUpdatePending, isChunkLoading;
  var init_deck = __esm({
    "deck.js"() {
      init_config();
      init_context();
      init_metadata();
      init_swiper();
      init_utils();
      GALLERY_ICON_SVG2 = '<svg fill="white" width="16" height="16" viewBox="0 0 36 36" style="vertical-align: middle;" xmlns="http://www.w3.org/2000/svg"><path d="M32,4H4A2,2,0,0,0,2,6V30a2,2,0,0,0,2,2H32a2,2,0,0,0,2-2V6A2,2,0,0,0,32,4ZM4,30V6H32V30Z"></path><path d="M8.92,14a3,3,0,1,0-3-3A3,3,0,0,0,8.92,14Zm0-4.6A1.6,1.6,0,1,1,7.33,11,1.6,1.6,0,0,1,8.92,9.41Z"></path><path d="M22.78,15.37l-5.4,5.4-4-4a1,1,0,0,0-1.41,0L5.92,22.9v2.83l6.79-6.79L16,22.18l-3.75,3.75H15l8.45-8.45L30,24V21.18l-5.81-5.81A1,1,0,0,0,22.78,15.37Z"></path></svg>';
      pluginConfig = null;
      currentSwiper = null;
      currentImages = [];
      autoPlayInterval = null;
      isAutoPlaying = false;
      contextInfo = null;
      loadingQueue = [];
      currentChunkPage2 = 1;
      chunkSize = 50;
      totalImageCount = 0;
      totalPages2 = 0;
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
    if (path.startsWith("/galleries") || path.startsWith("/images") || path.match(/^\/performers\/\d+/)) {
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
    const isAllowedPath = path.startsWith("/galleries") || path.startsWith("/images") || path.match(/^\/performers\/\d+/);
    if (!isAllowedPath) {
      cleanupButton();
      return;
    }
    const context = detectContext();
    const hasImages = document.querySelectorAll('img[src*="/image/"]').length > 0;
    const hasGalleryCovers = document.querySelectorAll(".gallery-cover img, .gallery-card img").length > 0;
    const isPerformerPage = path.match(/^\/performers\/\d+/);
    if (!context && !hasImages && !hasGalleryCovers && !isPerformerPage) {
      return;
    }
    if (existing) return;
    const buttonContainer = document.createElement("div");
    buttonContainer.className = "col-4 col-sm-3 col-md-2 col-lg-auto nav-link";
    const svgPath = "M1.829,10.195 L18.286,10.195 C19.245,10.195 20.032,10.944 20.108,11.897 L20.114,12.049 L20.114,36.146 C20.114,37.119 19.375,37.917 18.436,37.994 L18.286,38 L1.829,38 C0.869,38 0.082,37.251 0.006,36.298 L0,36.146 L0,12.049 C0,11.076 0.739,10.279 1.679,10.201 L1.829,10.195 L18.286,10.195 Z M17.371,32.293 L15.543,32.293 C15.038,32.293 14.629,32.708 14.629,33.220 C14.629,33.695 14.982,34.087 15.436,34.140 L15.543,34.146 L17.371,34.146 C17.876,34.146 18.286,33.731 18.286,33.220 C18.286,32.293 17.371,32.293 17.371,32.293 Z M28.343,0 C30.363,0 32,1.660 32,3.707 L32,27.805 C32,29.852 30.363,31.512 28.343,31.512 L21.942,31.512 L21.943,12.049 C21.943,10.067 20.409,8.449 18.480,8.347 L18.286,8.341 L8.228,8.341 L8.229,3.707 C8.229,1.660 9.866,0 11.886,0 L28.343,0 Z M12.053,19.463 C11.458,19.463 10.881,19.641 10.391,19.967 L10.211,20.096 L10.057,20.224 C9.506,19.735 8.797,19.463 8.060,19.463 C7.256,19.463 6.485,19.787 5.916,20.363 C5.348,20.940 5.029,21.722 5.029,22.537 C5.029,23.280 5.294,23.995 5.771,24.552 L5.907,24.700 L9.393,28.441 C9.565,28.627 9.806,28.732 10.057,28.732 C10.267,28.732 10.469,28.659 10.630,28.527 L10.722,28.441 L14.215,24.692 C14.770,24.125 15.086,23.348 15.086,22.537 C15.086,21.722 14.766,20.940 14.197,20.363 C13.629,19.787 12.858,19.463 12.053,19.463 Z M12.053,21.317 C12.373,21.317 12.679,21.445 12.905,21.674 C13.130,21.903 13.257,22.213 13.257,22.537 C13.257,22.768 13.192,22.992 13.073,23.185 L12.995,23.297 L12.895,23.409 L10.057,26.455 L7.218,23.408 L7.124,23.302 C6.950,23.082 6.857,22.814 6.857,22.537 C6.857,22.213 6.984,21.903 7.209,21.674 C7.435,21.445 7.741,21.317 8.060,21.317 C8.334,21.317 8.598,21.411 8.810,21.582 L8.911,21.674 L9.411,22.180 L9.497,22.257 C9.823,22.514 10.281,22.516 10.609,22.264 L10.703,22.181 L11.203,21.674 L11.304,21.582 C11.516,21.411 11.780,21.317 12.053,21.317 Z M5.943,22.537 L5.950,22.707 L5.946,22.660 L5.943,22.537 Z M6.686,20.903 L6.580,21.001 L6.624,20.960 C6.644,20.941 6.665,20.922 6.686,20.903 Z M11.615,20.437 L11.398,20.495 L11.566,20.448 L11.615,20.437 Z M11.738,20.414 L11.615,20.437 L11.638,20.432 L11.738,20.414 Z M3.571,12.049 L1.743,12.049 C1.238,12.049 0.829,12.464 0.829,12.976 C0.829,13.451 1.182,13.843 1.636,13.896 L1.743,13.902 L3.571,13.902 C4.076,13.902 4.486,13.487 4.486,12.976 C4.486,12.464 4.076,12.049 3.571,12.049 Z";
    buttonContainer.innerHTML = `
        <a href="javascript:void(0);" id="${buttonId}" class="minimal p-4 p-xl-2 d-flex d-xl-inline-block flex-column justify-content-between align-items-center btn btn-primary" title="Open Image Deck">
            <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 32 38" 
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
    const isAllowed = path.startsWith("/galleries") || path.startsWith("/images") || path.match(/^\/performers\/\d+/);
    if (!isAllowed) {
      cleanupButton();
      return;
    }
    const hasContext = detectContext() || document.querySelectorAll('img[src*="/image/"]').length > 0 || document.querySelectorAll(".gallery-cover img, .gallery-card img").length > 0 || path.match(/^\/performers\/\d+/);
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
  function initPlugin() {
    initPreviewObserver();
  }
  function initPreviewObserver() {
    const previewObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            let previewButtons = [];
            if (node.matches && node.matches(".preview-button")) {
              previewButtons.push(node);
            }
            if (node.querySelectorAll) {
              previewButtons = [...previewButtons, ...node.querySelectorAll(".preview-button")];
            }
            previewButtons.forEach((previewContainer) => {
              if (!previewContainer.dataset.hijacked) {
                previewContainer.dataset.hijacked = "true";
                const button = previewContainer.querySelector("button");
                if (button) {
                  const newButton = button.cloneNode(true);
                  button.parentNode.replaceChild(newButton, button);
                  newButton.addEventListener("click", (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log("[Image Deck] Preview button clicked (dynamic)");
                    const card = previewContainer.closest(".image-card, .grid-card");
                    const img = card?.querySelector('img[src*="/image/"]');
                    let targetImageId = null;
                    if (img) {
                      const idMatch = img.src.match(/\/image\/(\d+)/);
                      if (idMatch) {
                        targetImageId = idMatch[1];
                      }
                    }
                    Promise.resolve().then(() => (init_deck(), deck_exports)).then((module) => {
                      module.openDeck(targetImageId);
                    });
                  });
                }
              }
            });
          }
        });
      });
    });
    previewObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
    document.querySelectorAll(".preview-button").forEach(processPreviewButton);
  }
  function processPreviewButton(previewContainer) {
    if (!previewContainer.dataset.hijacked) {
      previewContainer.dataset.hijacked = "true";
      const button = previewContainer.querySelector("button");
      if (button) {
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        newButton.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log("[Image Deck] Preview button clicked");
          const card = previewContainer.closest(".image-card, .grid-card");
          const img = card?.querySelector('img[src*="/image/"]');
          let targetImageId = null;
          if (img) {
            const idMatch = img.src.match(/\/image\/(\d+)/);
            if (idMatch) {
              targetImageId = idMatch[1];
            }
          }
          Promise.resolve().then(() => (init_deck(), deck_exports)).then((module) => {
            module.openDeck(targetImageId);
          });
        });
      }
    }
  }

  // main.js
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initialize();
      initPlugin();
    });
  } else {
    initialize();
    initPlugin();
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
