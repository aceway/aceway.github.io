(function (global) {
  var CHANNEL = 'https://www.youtube.com/@aceway-AI';
  var NOCOOKIE = 'https://www.youtube-nocookie.com/embed/';
  var boot = document.currentScript;
  var JSON_URL = (boot && boot.getAttribute('data-yt-json')) || '/assets/youtube-channel.json';

  function videoAllowed() {
    var lang = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
    return lang.indexOf('zh') !== 0;
  }

  function loadData(cb) {
    if (global.H53D_YT_DATA) {
      cb(global.H53D_YT_DATA);
      return;
    }
    fetch(JSON_URL)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        global.H53D_YT_DATA = data;
        cb(data);
      })
      .catch(function () { cb(null); });
  }

  function videosForSlug(data, slug) {
    var empty = { shorts: [], landscape: [] };
    if (!data || !data.videos || !slug) return empty;
    var list = data.videos.filter(function (v) { return v.slug === slug; });
    return {
      shorts: list.filter(function (v) { return v.short; }),
      landscape: list.filter(function (v) { return !v.short; })
    };
  }

  function channelLink() {
    var a = document.createElement('a');
    a.href = CHANNEL;
    a.target = '_blank';
    a.rel = 'noopener';
    a.className = 'yt-channel-link';
    a.textContent = 'More on YouTube';
    return a;
  }

  function landscapeList(data) {
    if (!data || !data.videos) return [];
    var list = data.videos.filter(function (v) { return !v.short; });
    return list.length ? list : data.videos.slice();
  }

  function iframeFor(video) {
    var iframe = document.createElement('iframe');
    iframe.src = NOCOOKIE + encodeURIComponent(video.id) + '?autoplay=1&rel=0';
    iframe.title = video.title || 'YouTube video';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;
    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    return iframe;
  }

  function facade(video) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'yt-facade';
    btn.setAttribute('aria-label', 'Play video: ' + (video.title || 'YouTube'));
    var img = document.createElement('img');
    img.src = video.thumb;
    img.alt = '';
    img.loading = 'lazy';
    var play = document.createElement('span');
    play.className = 'yt-play';
    play.setAttribute('aria-hidden', 'true');
    btn.appendChild(img);
    btn.appendChild(play);
    btn.addEventListener('click', function () {
      btn.replaceWith(iframeFor(video));
    });
    return btn;
  }

  function fillFrame(frame, video) {
    frame.innerHTML = '';
    if (video) frame.appendChild(facade(video));
  }

  function mountPlayer(root, videos, shape) {
    if (!root) return false;
    root.innerHTML = '';
    if (!videos || !videos.length) {
      root.hidden = true;
      root.className = 'yt-slot yt-slot-' + shape;
      return false;
    }
    root.hidden = false;
    root.className = 'yt-slot yt-slot-' + shape;

    var index = 0;
    var frame = document.createElement('div');
    frame.className = shape === 'short' ? 'yt-frame yt-frame-short' : 'yt-frame yt-frame-wide';
    fillFrame(frame, videos[0]);
    root.appendChild(frame);

    if (videos.length > 1) {
      var nav = document.createElement('div');
      nav.className = 'yt-carousel-nav';
      var prev = document.createElement('button');
      prev.type = 'button';
      prev.setAttribute('aria-label', 'Previous video');
      prev.textContent = '‹';
      var caption = document.createElement('div');
      caption.className = 'yt-carousel-caption';
      caption.textContent = videos[0].title;
      var next = document.createElement('button');
      next.type = 'button';
      next.setAttribute('aria-label', 'Next video');
      next.textContent = '›';
      nav.appendChild(prev);
      nav.appendChild(caption);
      nav.appendChild(next);
      root.appendChild(nav);

      function show(n) {
        index = (n + videos.length) % videos.length;
        fillFrame(frame, videos[index]);
        caption.textContent = videos[index].title;
      }
      prev.addEventListener('click', function () { show(index - 1); });
      next.addEventListener('click', function () { show(index + 1); });
    } else {
      var cap = document.createElement('div');
      cap.className = 'yt-carousel-caption yt-caption-solo';
      cap.textContent = videos[0].title;
      root.appendChild(cap);
    }
    return true;
  }

  function mountPreview(shortRoot, wideRoot, slug) {
    if (!videoAllowed()) {
      if (shortRoot) { shortRoot.hidden = true; shortRoot.innerHTML = ''; }
      if (wideRoot) { wideRoot.hidden = true; wideRoot.innerHTML = ''; }
      return;
    }
    loadData(function (data) {
      var groups = videosForSlug(data, slug);
      var hasShort = mountPlayer(shortRoot, groups.shorts, 'short');
      mountPlayer(wideRoot, groups.landscape, 'wide');
      var pair = shortRoot && shortRoot.closest('.preview-pair');
      if (pair) pair.classList.toggle('has-short', hasShort);
    });
  }

  function mountSupport(root, slug) {
    if (!root || !videoAllowed()) return;
    loadData(function (data) {
      var groups = videosForSlug(data, slug);
      if (!groups.shorts.length && !groups.landscape.length) {
        root.hidden = true;
        root.innerHTML = '';
        var wrap = root.closest('#video');
        if (wrap) wrap.hidden = true;
        return;
      }
      var wrap = root.closest('#video');
      if (wrap) wrap.hidden = false;
      root.hidden = false;
      root.classList.add('yt-block', 'yt-support-block');
      root.innerHTML = '';

      var shortSlot = document.createElement('div');
      var wideSlot = document.createElement('div');
      if (groups.shorts.length) root.appendChild(shortSlot);
      if (groups.landscape.length) root.appendChild(wideSlot);
      mountPlayer(shortSlot, groups.shorts, 'short');
      mountPlayer(wideSlot, groups.landscape, 'wide');

      root.appendChild(channelLink());
    });
  }

  function mountTeaser(root, heading) {
    if (!root || !videoAllowed()) return;
    loadData(function (data) {
      var videos = landscapeList(data).slice(0, 1);
      if (!videos.length) return;
      mountPlayer(root, videos, 'wide');
      if (heading) {
        var h = document.createElement('h2');
        h.className = 'yt-heading';
        h.textContent = heading;
        root.insertBefore(h, root.firstChild);
      }
      root.appendChild(channelLink());
    });
  }

  function mountCarousel(root, heading) {
    if (!root || !videoAllowed()) return;
    loadData(function (data) {
      var videos = landscapeList(data);
      if (!videos.length) return;
      mountPlayer(root, videos, 'wide');
      if (heading) {
        var h = document.createElement('h2');
        h.className = 'yt-heading';
        h.textContent = heading;
        root.insertBefore(h, root.firstChild);
      }
      root.appendChild(channelLink());
    });
  }

  global.H53D_YT = {
    CHANNEL: CHANNEL,
    videosForSlug: videosForSlug,
    mountPreview: mountPreview,
    mountSupport: mountSupport,
    mountTeaser: mountTeaser,
    mountCarousel: mountCarousel
  };
})(window);
