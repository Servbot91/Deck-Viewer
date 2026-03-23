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
    const isImagesPage = path === "/images" || path === "/images/";
    const imageIdMatch = path.match(/^\/images\/(\d+)$/);
    if (imageIdMatch) {
      return {
        type: "images",
        id: imageIdMatch[1],
        hash,
        isSingleImage: true
      };
    }
    const isGalleriesPage = path === "/galleries" || path === "/galleries/";
    const galleryIdMatch = path.match(/^\/galleries\/(\d+)(\?.*)?$/);
    if (galleryIdMatch) {
      return {
        type: "galleries",
        id: galleryIdMatch[1],
        hash,
        isSingleGallery: true
      };
    }
    const idMatch = path.match(/\/(\w+)\/(\d+)/);
    const isImagesContext = hash.includes("images") || document.querySelector(".nav-tabs .active")?.textContent?.includes("Images");
    if (isImagesPage && search && search.includes("c=")) {
      const filters = parseUrlFilters(search);
      return {
        type: "images",
        id: null,
        hash,
        isFilteredView: true,
        filter: filters,
        isGeneralListing: false
      };
    }
    if (idMatch) {
      const [, type, id] = idMatch;
      if (!isImagesContext && type !== "galleries") {
        return null;
      }
      return { type, id, hash };
    }
    if (document.querySelectorAll('img[src*="/image/"]').length > 0) {
      return {
        type: "images",
        id: null,
        hash,
        isGeneralListing: true
      };
    }
    return null;
  }
  function parseUrlFilters(search) {
    const params = new URLSearchParams(search);
    const filterParams = [];
    for (const [key, value] of params.entries()) {
      if (key === "c") {
        filterParams.push(value);
      }
    }
    return {
      rawFilters: filterParams,
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
  function getVisibleGalleryCovers() {
    const galleries = [];
    const galleryGrid = document.querySelector('.main-content, [role="main"]') || document.body;
    const galleryElements = galleryGrid.querySelectorAll(".gallery-card, .card");
    galleryElements.forEach((card, index) => {
      const coverImg = card.querySelector(".gallery-cover img, img");
      if (coverImg && coverImg.src) {
        let id = `gallery_${index}`;
        let url = null;
        const link = card.querySelector('a[href*="/galleries/"]');
        if (link) {
          const idMatch = link.href.match(/\/galleries\/(\d+)/);
          if (idMatch) {
            id = idMatch[1];
            url = link.href;
          }
        }
        galleries.push({
          id,
          title: card.querySelector(".card-title, h5, h6")?.textContent?.trim() || `Gallery ${index + 1}`,
          paths: {
            image: coverImg.src
          },
          url
          // Add the gallery URL
        });
      }
    });
    return galleries;
  }
  async function fetchContextImages(context, page = 1, perPage = 50) {
    const { type, id, filter, isFilteredView, isGeneralListing, isSingleImage, isSingleGallery } = context;
    let query = "";
    let variables = {};
    if (isSingleImage && id) {
      const query2 = `query FindImage($id: ID!) {
            findImage(id: $id) {
                id
                title
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
          body: JSON.stringify({ query: query2, variables: { id } })
        });
        const data = await response.json();
        const image = data?.data?.findImage;
        if (image) {
          return {
            images: [image],
            totalCount: 1,
            currentPage: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false
          };
        }
      } catch (error) {
        console.error("[Image Deck] Error fetching single image:", error);
      }
      return {
        images: [],
        totalCount: 0,
        currentPage: 1,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false
      };
    }
    if (isFilteredView && filter) {
      query = `query FindImages($filter: FindFilterType!, $image_filter: ImageFilterType!) {
            findImages(filter: $filter, image_filter: $image_filter) {
                count
                images {
                    id
                    title
                    paths {
                        thumbnail
                        image
                    }
                }
            }
        }`;
      let imageFilter = {};
      if (filter.rawFilters) {
        filter.rawFilters.forEach((filterStr) => {
          try {
            const decoded = decodeURIComponent(filterStr);
            let jsonStr = decoded.replace(/\(/g, "{").replace(/\)/g, "}").replace(/\\+"/g, '"').replace(/^"(.*)"$/, "$1");
            jsonStr = jsonStr.replace(/([^\\])"/g, '$1\\"').replace(/\\"/g, '"');
            const filterObj = JSON.parse(jsonStr);
            if (filterObj.type === "tags" && filterObj.value) {
              const tagFilter = {};
              if (filterObj.value.items && filterObj.value.items.length > 0) {
                tagFilter.value = filterObj.value.items.map((item) => item.id);
                tagFilter.modifier = filterObj.modifier || "INCLUDES_ALL";
              }
              if (filterObj.value.excluded && filterObj.value.excluded.length > 0) {
                if (!tagFilter.value) {
                  tagFilter.value = [];
                }
                tagFilter.value.push(...filterObj.value.excluded.map((item) => item.id));
                if (!tagFilter.modifier || tagFilter.modifier === "INCLUDES_ALL") {
                  tagFilter.modifier = "EXCLUDES";
                }
              }
              if (tagFilter.value && tagFilter.value.length > 0) {
                imageFilter.tags = tagFilter;
              }
            } else if (filterObj.type === "performers" && filterObj.value) {
              if (filterObj.value.items && filterObj.value.items.length > 0) {
                imageFilter.performers = {
                  value: filterObj.value.items.map((item) => item.id),
                  modifier: filterObj.modifier || "INCLUDES_ALL"
                };
              }
            } else if (filterObj.type === "file_count" && filterObj.value) {
              imageFilter.file_count = {
                value: filterObj.value.value,
                modifier: filterObj.modifier || "GREATER_THAN"
              };
            }
          } catch (e) {
            console.error("[Image Deck] Error parsing filter:", filterStr, e);
          }
        });
      }
      variables = {
        filter: {
          per_page: filter.perPage || perPage,
          page,
          sort: filter.sortBy || "created_at",
          direction: (filter.sortDir || "desc").toUpperCase()
        },
        image_filter: imageFilter
      };
    } else if (type && id) {
      switch (type) {
        case "performers":
          query = `query FindImages($filter: FindFilterType!, $image_filter: ImageFilterType!) {
                    findImages(filter: $filter, image_filter: $image_filter) {
                        count
                        images {
                            id
                            title
                            paths {
                                thumbnail
                                image
                            }
                        }
                    }
                }`;
          variables = {
            filter: { per_page: perPage, page, sort: "random" },
            image_filter: { performers: { value: [id], modifier: "INCLUDES" } }
          };
          break;
        case "tags":
          query = `query FindImages($filter: FindFilterType!, $image_filter: ImageFilterType!) {
                    findImages(filter: $filter, image_filter: $image_filter) {
                        count
                        images {
                            id
                            title
                            paths {
                                thumbnail
                                image
                            }
                        }
                    }
                }`;
          variables = {
            filter: { per_page: perPage, page, sort: "random" },
            image_filter: { tags: { value: [id], modifier: "INCLUDES" } }
          };
          break;
        case "galleries":
          if (context && context.isSingleGallery) {
            query = `query FindImages($filter: FindFilterType!, $image_filter: ImageFilterType!) {
					findImages(filter: $filter, image_filter: $image_filter) {
						count
						images {
							id
							title
							paths {
								thumbnail
								image
							}
						}
					}
				}`;
            variables = {
              filter: { per_page: perPage, page, sort: "created_at", direction: "ASC" },
              image_filter: { galleries: { value: [id], modifier: "INCLUDES" } }
            };
            console.log("[Image Deck] Fetching images for gallery ID:", id, "Variables:", variables);
          } else {
            query = `query FindGalleries($filter: FindFilterType!) {
					findGalleries(filter: $filter) {
						count
						galleries {
							id
							title
							cover {
								paths {
									thumbnail
									image
								}
							}
						}
					}
				}`;
            variables = {
              filter: {
                per_page: perPage,
                page,
                sort: "created_at",
                direction: "DESC"
              }
            };
          }
          break;
        default:
          return getVisibleImages();
      }
    } else if (isGeneralListing) {
      query = `query FindImages($filter: FindFilterType!) {
            findImages(filter: $filter) {
                count
                images {
                    id
                    title
                    paths {
                        thumbnail
                        image
                    }
                }
            }
        }`;
      variables = {
        filter: {
          per_page: perPage,
          page,
          sort: "created_at",
          direction: "DESC"
        }
      };
    } else {
      return getVisibleImages();
    }
    try {
      const response = await fetch("/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables })
      });
      const responseText = await response.text();
      console.log("[Image Deck] GraphQL Response Text:", responseText);
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("[Image Deck] Failed to parse GraphQL response as JSON:", parseError);
        console.error("[Image Deck] Raw response:", responseText);
        throw new Error("Invalid GraphQL response format");
      }
      if (data.errors) {
        console.error("[Image Deck] GraphQL Errors:", data.errors);
        throw new Error(`GraphQL Error: ${data.errors.map((e) => e.message).join(", ")}`);
      }
      let images = [];
      let totalCount = 0;
      if (type === "galleries" || context && context.type === "galleries") {
        if (context && context.isSingleGallery) {
          images = data?.data?.findImages?.images || [];
          totalCount = data?.data?.findImages?.count || images.length;
          totalCount = images.length;
          console.log("[Image Deck] Fetched gallery images:", images);
        } else {
          const galleries = data?.data?.findGalleries?.galleries || [];
          images = galleries.map((gallery) => ({
            id: gallery.id,
            title: gallery.title,
            paths: {
              image: gallery.cover?.paths?.image || gallery.cover?.paths?.thumbnail || ""
            }
          })).filter((g) => g.paths.image);
          totalCount = data?.data?.findGalleries?.count || images.length;
        }
      } else {
        images = data?.data?.findImages?.images || [];
        totalCount = data?.data?.findImages?.count || images.length;
        if (page === 1 && totalCount > perPage) {
          console.log(`[Image Deck] Total images: ${totalCount}, loading first ${perPage} for performance`);
        }
      }
      return {
        images,
        totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / perPage),
        hasNextPage: page < Math.ceil(totalCount / perPage),
        hasPreviousPage: page > 1
      };
    } catch (error) {
      console.error(`[Image Deck] Error fetching images:`, error);
      return {
        images: [],
        totalCount: 0,
        currentPage: 1,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false
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
    const useVirtual = images.length > 10;
    const eagerLoadAll = images.length <= 10;
    const effectOptions = getEffectOptions(pluginConfig2.transitionEffect, pluginConfig2);
    const swiperConfig = {
      effect: pluginConfig2.transitionEffect,
      grabCursor: true,
      centeredSlides: true,
      slidesPerView: 1,
      resistanceRatio: pluginConfig2.swipeResistance / 100,
      // Performance optimizations
      speed: 150,
      watchSlidesProgress: true,
      preloadImages: false,
      keyboard: {
        enabled: true,
        onlyInViewport: false
      },
      // Add loop functionality for single galleries
      loop: contextInfo2?.isSingleGallery ? true : false,
      loopAdditionalSlides: 2,
      // Add extra slides for smooth looping
      ...effectOptions
    };
    if (useVirtual) {
      console.log("[Image Deck] Using virtual slides for performance");
      swiperConfig.virtual = {
        slides: images.map((img, index) => {
          const fullSrc = img.paths.image;
          if (img.url) {
            return `<div class="swiper-zoom-container">
                        <div class="gallery-cover-container">
                            <div class="gallery-cover-title" title="${img.title || "Untitled Gallery"}">${img.title || "Untitled Gallery"}</div>
                            <a href="${img.url}" target="_blank" class="gallery-cover-link">
                                <img src="${fullSrc}" alt="${img.title || ""}" decoding="async" loading="lazy" />
                            </a>
                        </div>
                    </div>`;
          } else {
            return `<div class="swiper-zoom-container"><img src="${fullSrc}" alt="${img.title || ""}" decoding="async" loading="lazy" style="max-width: 100%; height: auto; display: block; margin: 0 auto;" /></div>`;
          }
        }),
        cache: true,
        addSlidesBefore: 2,
        addSlidesAfter: 2,
        renderSlide: function(slideData) {
          return `<div class="swiper-slide">${slideData}</div>`;
        }
      };
      swiperConfig.lazy = false;
    } else {
      images.forEach((img, index) => {
        const slide = document.createElement("div");
        slide.className = "swiper-slide";
        const fullSrc = img.paths.image;
        if (img.url && !contextInfo2?.isSingleGallery) {
          slide.innerHTML = `
					<div class="swiper-zoom-container">
						<div class="gallery-cover-container">
							<div class="gallery-cover-title" title="${img.title || "Untitled Gallery"}">${img.title || "Untitled Gallery"}</div>
							<a href="${img.url}" target="_blank" class="gallery-cover-link">
								<img
									src="${fullSrc}"
									alt="${img.title || ""}"
									decoding="async"
									loading="eager"
								>
							</a>
						</div>
					</div>
				`;
        } else {
          slide.innerHTML = `
					<div class="swiper-zoom-container">
						<img
							src="${fullSrc}"
							alt="${img.title || ""}"
							decoding="async"
							loading="eager"
						>
					</div>
				`;
          const imgEl = slide.querySelector("img");
          if (imgEl && imgEl.decode) {
            imgEl.decode().catch(() => {
            });
          }
        }
        wrapper.appendChild(slide);
      });
      swiperConfig.lazy = false;
    }
    const commonEvents = {
      slideChange: function() {
        if (updateUICallback) {
          updateUICallback(container);
        }
        if (savePositionCallback) {
          savePositionCallback();
        }
      },
      reachEnd: function() {
        console.log("[Image Deck] Reached end of current chunk");
        const playBtn = document.querySelector('[data-action="play"]');
        const isAutoPlaying2 = playBtn && playBtn.classList.contains("active");
        const nextChunkBtn = document.querySelector('[data-action="next-chunk"]');
        if (nextChunkBtn && !nextChunkBtn.disabled) {
          console.log("[Image Deck] Auto-loading next chunk...");
          setTimeout(() => {
            nextChunkBtn.click();
          }, 300);
        } else if (isAutoPlaying2) {
          console.log("[Image Deck] No more chunks available, stopping autoplay");
          const stopAutoPlay2 = () => {
            if (playBtn) {
              playBtn.innerHTML = "\u25B6";
              playBtn.classList.remove("active");
            }
            const speedIndicator = document.querySelector(".image-deck-speed");
            if (speedIndicator) {
              speedIndicator.classList.remove("visible");
            }
          };
          stopAutoPlay2();
        }
      },
      slideChangeTransitionEnd: function() {
        if (this.lazy && this.lazy.load) {
          setTimeout(() => {
            this.lazy.load();
          }, 50);
        }
        const currentIndex = this.activeIndex;
        const totalSlides = this.slides ? this.slides.length : this.virtual ? this.virtual.slides.length : 0;
        if (totalSlides > 0 && currentIndex >= totalSlides - 3) {
          const nextChunkBtn = document.querySelector('[data-action="next-chunk"]');
          if (nextChunkBtn && !nextChunkBtn.disabled) {
            console.log("[Image Deck] Preloading next chunk...");
            setTimeout(() => {
              nextChunkBtn.click();
            }, 1e3);
          }
        }
      }
    };
    swiperConfig.on = { ...swiperConfig.on, ...commonEvents };
    const swiper = new Swiper(container.querySelector(".swiper"), swiperConfig);
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
    console.log("[Image Deck] Found control buttons:", controlButtons.length);
    controlButtons.forEach((button) => {
      button.addEventListener("click", (e) => {
        const action = button.dataset.action;
        console.log("[Image Deck] Button clicked:", action);
        if (!action) return;
        switch (action) {
          case "prev":
            console.log("[Image Deck] Previous button clicked");
            const swiper = window.currentSwiperInstance;
            if (swiper) {
              swiper.slidePrev();
            } else {
              console.log("[Image Deck] No swiper instance found");
            }
            break;
          case "next":
            console.log("[Image Deck] Next button clicked");
            if (swiper) {
              swiper.slideNext();
              setTimeout(() => {
                if (typeof checkAndLoadNextChunk === "function") {
                  checkAndLoadNextChunk();
                }
              }, 100);
            } else {
              console.log("[Image Deck] No swiper instance found");
            }
            break;
          case "play":
            console.log("[Image Deck] Play button clicked");
            const playBtn = document.querySelector('[data-action="play"]');
            const isAutoPlaying2 = playBtn && playBtn.classList.contains("active");
            if (isAutoPlaying2) {
              stopAutoPlay();
            } else {
              startAutoPlay();
            }
            break;
          case "info":
            console.log("[Image Deck] Info button clicked");
            openMetadataModal();
            break;
          case "next-chunk":
            console.log("[Image Deck] Next chunk button clicked");
            loadNextChunk();
            break;
          default:
            console.log("[Image Deck] Unknown action:", action);
        }
      });
    });
    document.addEventListener("keydown", handleKeyboard);
    let touchStartY = 0;
    let touchDeltaY = 0;
    let rafId = null;
    const swiperEl = container.querySelector(".image-deck-swiper");
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
      } else if (touchDeltaY < -50) {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          const modal = container.querySelector(".image-deck-metadata-modal");
          if (modal && !modal.classList.contains("active")) {
            modal.style.transform = `translateY(${Math.max(touchDeltaY, -200)}px)`;
            modal.style.opacity = Math.min(Math.abs(touchDeltaY) / 150, 1);
          }
        });
      }
    }, { passive: true });
    swiperEl.addEventListener("touchend", () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (touchDeltaY > 150) {
        closeDeck();
      } else if (touchDeltaY < -100) {
        openMetadataModal();
      } else {
        requestAnimationFrame(() => {
          container.style.transform = "";
          container.style.opacity = "";
          const modal = container.querySelector(".image-deck-metadata-modal");
          if (modal && !modal.classList.contains("active")) {
            modal.style.transform = "";
            modal.style.opacity = "";
          }
        });
      }
      touchDeltaY = 0;
    }, { passive: true });
  }
  function handleKeyboard(e) {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
      if (e.key === "Escape") {
        closeMetadataModal();
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
        const playBtn = document.querySelector('[data-action="play"]');
        const isAutoPlaying2 = playBtn && playBtn.classList.contains("active");
        if (isAutoPlaying2) {
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
      const detectedContext = detectContext();
      storedContextInfo = detectedContext;
      contextInfo = detectedContext;
      console.log("[Image Deck] Context detected:", storedContextInfo);
      if ((!detectedContext || detectedContext.isGalleryListing) && window.location.pathname.startsWith("/galleries")) {
        const galleryIdMatch = window.location.pathname.match(/^\/galleries\/(\d+)/);
        if (galleryIdMatch) {
          const manualContext = {
            type: "galleries",
            id: galleryIdMatch[1],
            isSingleGallery: true
          };
          storedContextInfo = manualContext;
          contextInfo = manualContext;
          console.log("[Image Deck] Manual context override created:", manualContext);
        }
      }
      let imageResult;
      if (storedContextInfo) {
        console.log("[Image Deck] Using context-based fetching");
        imageResult = await fetchContextImages(storedContextInfo, 1, chunkSize);
      } else if (window.location.pathname.startsWith("/galleries")) {
        console.log("[Image Deck] Checking gallery page type");
        const galleryIdMatch = window.location.pathname.match(/^\/galleries\/(\d+)/);
        if (galleryIdMatch) {
          console.log("[Image Deck] Single gallery page detected");
          const galleryContext = {
            type: "galleries",
            id: galleryIdMatch[1],
            isSingleGallery: true
          };
          imageResult = await fetchContextImages(galleryContext, 1, chunkSize);
        } else {
          console.log("[Image Deck] Gallery listing page detected");
          imageResult = getVisibleGalleryCovers();
        }
      } else {
        console.log("[Image Deck] Falling back to visible images");
        imageResult = getVisibleImages();
      }
      if (Array.isArray(imageResult)) {
        currentImages = imageResult;
        totalImageCount = imageResult.length;
        totalPages = 1;
      } else {
        currentImages = imageResult.images;
        totalImageCount = imageResult.totalCount;
        totalPages = imageResult.totalPages;
        currentChunkPage = imageResult.currentPage;
      }
      if (currentImages.length === 0) {
        console.warn("[Image Deck] No images found");
        let errorMessage = "No images found to display in Image Deck.\n\n";
        if (storedContextInfo && storedContextInfo.isGalleryListing) {
          errorMessage += "This appears to be a gallery listing page. ";
          errorMessage += "Make sure you are on a page with visible gallery covers, ";
          errorMessage += "or navigate to a specific gallery to view its images.";
        } else if (storedContextInfo && storedContextInfo.isSingleGallery) {
          errorMessage += "This appears to be a single gallery page, but no images were found. ";
          errorMessage += "The gallery might be empty or there might be a loading issue.";
        } else {
          errorMessage += "No compatible content found on this page.";
        }
        alert(errorMessage);
        return;
      }
      console.log(`[Image Deck] Opening with ${currentImages.length} images (chunk 1 of ${totalPages || 1})`);
      const container = createDeckUI();
      document.body.classList.add("image-deck-open");
      requestAnimationFrame(() => {
        container.classList.add("active");
      });
      currentSwiper = initSwiper(container, currentImages, pluginConfig, updateUI, savePosition, contextInfo);
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
    console.log("[Image Deck] Attempting to load next chunk");
    const contextToUse = storedContextInfo || contextInfo || detectContext();
    if (!contextToUse) {
      console.log("[Image Deck] No context info available");
      const freshContext = detectContext();
      if (!freshContext) {
        console.log("[Image Deck] Could not detect context");
        const loadingIndicator2 = document.querySelector(".image-deck-loading");
        if (loadingIndicator2) {
          loadingIndicator2.textContent = "Cannot detect context";
          setTimeout(() => {
            loadingIndicator2.style.display = "none";
          }, 2e3);
        }
        return;
      }
      storedContextInfo = freshContext;
      contextInfo = freshContext;
    }
    console.log("[Image Deck] Loading chunk", currentChunkPage + 1, "with context:", contextToUse);
    const loadingIndicator = document.querySelector(".image-deck-loading");
    if (loadingIndicator) {
      loadingIndicator.style.display = "block";
      loadingIndicator.textContent = "Loading next chunk...";
      loadingIndicator.style.backgroundColor = "rgba(100, 100, 255, 0.3)";
      loadingIndicator.style.color = "white";
      loadingIndicator.style.fontWeight = "bold";
    }
    const nextChunkButton = document.querySelector('[data-action="next-chunk"]');
    if (nextChunkButton) {
      nextChunkButton.innerHTML = "\u{1F504}";
      nextChunkButton.disabled = true;
      nextChunkButton.style.opacity = "0.5";
    }
    try {
      const nextPage = currentChunkPage + 1;
      console.log("[Image Deck] Fetching page", nextPage, "with chunk size", chunkSize);
      const result = await fetchContextImages(contextToUse, nextPage, chunkSize);
      console.log("[Image Deck] Fetched chunk result:", result);
      if (!result || !result.images || result.images.length === 0) {
        console.log("[Image Deck] No more images to load (empty result)");
        if (loadingIndicator) {
          loadingIndicator.textContent = "No more images to load";
          loadingIndicator.style.backgroundColor = "rgba(255, 100, 100, 0.3)";
          setTimeout(() => {
            loadingIndicator.style.display = "none";
          }, 2e3);
        }
        return;
      }
      const oldLength = currentImages.length;
      currentImages.push(...result.images);
      totalImageCount = result.totalCount || totalImageCount;
      totalPages = result.totalPages || totalPages;
      currentChunkPage = nextPage;
      console.log(`[Image Deck] Added ${result.images.length} new images, total: ${currentImages.length}`);
      if (currentSwiper && currentSwiper.virtual && result.images.length > 0) {
        const newSlides = result.images.map((img) => {
          const fullSrc = img.paths.image;
          return `<div class="swiper-zoom-container"><img src="${fullSrc}" alt="${img.title || ""}" decoding="async" loading="lazy" style="max-width: 100%; height: auto; display: block; margin: 0 auto;" /></div>`;
        });
        currentSwiper.virtual.slides.push(...newSlides);
        currentSwiper.virtual.update(true);
        console.log(`[Image Deck] Added ${newSlides.length} virtual slides`);
      }
      const container = document.querySelector(".image-deck-container");
      if (container) {
        updateUI(container);
      }
      if (loadingIndicator) {
        loadingIndicator.textContent = `\u2713 Loaded ${result.images.length} images (chunk ${nextPage})`;
        loadingIndicator.style.backgroundColor = "rgba(100, 255, 100, 0.3)";
        setTimeout(() => {
          loadingIndicator.style.display = "none";
        }, 2e3);
      }
      console.log(`[Image Deck] Successfully loaded chunk ${nextPage}, total images: ${currentImages.length}`);
    } catch (error) {
      console.error("[Image Deck] Error loading next chunk:", error);
      const loadingIndicator2 = document.querySelector(".image-deck-loading");
      if (loadingIndicator2) {
        loadingIndicator2.textContent = "Error loading chunk: " + (error.message || "Unknown error");
        loadingIndicator2.style.backgroundColor = "rgba(255, 100, 100, 0.3)";
        setTimeout(() => {
          loadingIndicator2.style.display = "none";
        }, 3e3);
      }
    } finally {
      const nextChunkButton2 = document.querySelector('[data-action="next-chunk"]');
      if (nextChunkButton2) {
        nextChunkButton2.innerHTML = "\u23ED\uFE0F";
        nextChunkButton2.disabled = false;
        nextChunkButton2.style.opacity = "1";
      }
      const loadingIndicator2 = document.querySelector(".image-deck-loading");
      if (loadingIndicator2) {
        setTimeout(() => {
          if (loadingIndicator2.style.display !== "none") {
            loadingIndicator2.style.display = "none";
          }
        }, 3e3);
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
  var pluginConfig, currentSwiper, currentImages, autoPlayInterval, isAutoPlaying, contextInfo, loadingQueue, currentChunkPage, chunkSize, totalImageCount, totalPages, storedContextInfo, uiUpdatePending;
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
    }
  });

  // button.js
  init_context();
  var retryTimer = null;
  function createLaunchButton() {
    console.log("[Image Deck] Creating launch button...");
    const context = detectContext();
    const hasImages = document.querySelectorAll('img[src*="/image/"]').length > 0;
    const hasGalleryCovers = document.querySelectorAll(".gallery-cover img, .gallery-card img").length > 0;
    console.log("[Image Deck] Context detection result:", context);
    console.log("[Image Deck] Has images:", hasImages);
    console.log("[Image Deck] Has gallery covers:", hasGalleryCovers);
    if (!context && !hasImages && !hasGalleryCovers) {
      console.log("[Image Deck] Not on relevant page, removing button if exists");
      const existing2 = document.querySelector(".image-deck-launch-btn");
      if (existing2) existing2.remove();
      return;
    }
    const existing = document.querySelector(".image-deck-launch-btn");
    if (existing) {
      console.log("[Image Deck] Removing existing button");
      existing.remove();
    }
    const button = document.createElement("button");
    button.className = "image-deck-launch-btn";
    button.innerHTML = "\u{1F3B4}";
    button.title = "Open Image Deck";
    button.addEventListener("click", function(e) {
      console.log("[Image Deck] Launch button clicked!");
      Promise.resolve().then(() => (init_deck(), deck_exports)).then((module) => {
        module.openDeck();
      });
    });
    document.body.appendChild(button);
    console.log("[Image Deck] Launch button created successfully");
  }
  function retryCreateButton(attempts = 0, maxAttempts = 5) {
    const delays = [100, 300, 500, 1e3, 2e3];
    if (attempts >= maxAttempts) {
      console.log("[Image Deck] Max retry attempts reached");
      return;
    }
    const hasContext = detectContext();
    const hasImages = document.querySelectorAll('img[src*="/image/"]').length > 0;
    const hasGalleryCovers = document.querySelectorAll(".gallery-cover img, .gallery-card img").length > 0;
    if (hasContext || hasImages || hasGalleryCovers) {
      createLaunchButton();
    } else if (attempts < maxAttempts - 1) {
      clearTimeout(retryTimer);
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
    const observer = new MutationObserver((mutations) => {
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
    observer.observe(mainContent, {
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
