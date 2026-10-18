// 공개 핫딜 페이지. deals.js(window.HOTDEAL_DATA) 또는 deals.json 을 읽어 화면을 그린다.
// 모든 값은 textContent 로 넣어 HTML 주입을 막는다.
(function () {
  "use strict";
  var state = { deals: [], group: "", category: "", q: "", sort: "latest" };
  // 탭: 쿠팡 / 토스 / 그 밖의 모든 쇼핑몰
  var GROUPS = [["", "전체"], ["coupang", "쿠팡"], ["toss", "토스"], ["etc", "다른 쇼핑몰"]];
  function groupOf(d) { return d.mall === "coupang" || d.mall === "toss" ? d.mall : "etc"; }
  var $ = function (id) { return document.getElementById(id); };

  function won(n) { return n == null ? "" : n.toLocaleString("ko-KR") + "원"; }
  function safeUrl(u) { return /^https?:\/\//i.test(u || "") ? u : ""; }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  var NO_IMAGE = "no-image.svg";

  // "51분 전" 처럼 상품 정보가 마지막으로 바뀐 시각을 짧게 보여 준다
  function ago(iso) {
    var t = Date.parse(iso || "");
    if (isNaN(t)) return "";
    var m = Math.floor((Date.now() - t) / 60000);
    if (m < 1) return "방금 전";
    if (m < 60) return m + "분 전";
    if (m < 60 * 24) return Math.floor(m / 60) + "시간 전";
    if (m < 60 * 24 * 7) return Math.floor(m / 1440) + "일 전";
    return new Date(t).toLocaleDateString("ko-KR");
  }

  // 목록형 카드: 왼쪽 이미지, 오른쪽 상품명·가격·배송·조건, 맨 아래 원글 링크와 구매 버튼
  function card(d) {
    var c = el("article", "card" + (d.sold_out ? " soldout" : ""));
    c.dataset.mall = d.mall || "";

    // 이미지: 없거나 불러오지 못하면 항상 같은 기본 그림 (영역 크기는 고정)
    var thumb = el("div", "thumb");
    var img = el("img");
    img.alt = d.title;
    img.loading = "lazy";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    var src = safeUrl(d.image_url);
    img.src = src || NO_IMAGE;
    if (!src) img.className = "placeholder";
    img.onerror = function () { img.onerror = null; img.src = NO_IMAGE; img.className = "placeholder"; };
    thumb.appendChild(img);
    if (d.sold_out) { var m = el("div", "sold-mask"); m.appendChild(el("span", "", "품절")); thumb.appendChild(m); }
    c.appendChild(thumb);

    var body = el("div", "body");
    var head = el("div", "head");
    head.appendChild(el("span", "mall", d.mall_name || "기타"));
    if (d.category) head.appendChild(el("span", "cat", d.category));
    var when = ago(d.updated_at);
    if (when) head.appendChild(el("span", "time", when));
    body.appendChild(head);
    body.appendChild(el("h2", "title", d.title));

    var price = el("div", "price");
    if (d.discount_rate) price.appendChild(el("span", "rate", d.discount_rate + "%"));
    price.appendChild(el("span", "sale" + (d.sale_price == null ? " none" : ""), d.sale_price != null ? won(d.sale_price) : "가격 확인 필요"));
    if (d.regular_price) price.appendChild(el("span", "regular", won(d.regular_price)));
    body.appendChild(price);

    // 배송비와 할인 조건은 작은 꼬리표로. 배송비를 모르면 '배송비 확인 필요' 그대로 보여 준다
    var tags = el("ul", "conds");
    var label = d.shipping_label || "배송비 확인 필요";
    tags.appendChild(el("li", "ship" + (label === "무료배송" ? " free" : (label === "배송비 확인 필요" ? " unknown" : "")), label));
    (d.conditions || []).forEach(function (t) {
      var i = t.indexOf(": ");
      var li = el("li", t.indexOf("카드") === 0 ? "card-cond" : "");
      if (i > 0) { li.appendChild(el("b", "", t.slice(0, i))); li.appendChild(document.createTextNode(" " + t.slice(i + 2))); }
      else li.textContent = t;
      tags.appendChild(li);
    });
    body.appendChild(tags);

    // 구매 버튼(판매처, 색 있는 버튼)과 원본 게시글 링크(커뮤니티, 회색 글자)는 모양과 위치를 분리한다
    var actions = el("div", "actions");
    var row = el("div", "src-row");
    var post = safeUrl(d.source_post_url);
    if (post) {
      var s = el("a", "src", "💬 원글 보기");
      s.href = post; s.target = "_blank"; s.rel = "nofollow noopener noreferrer";
      row.appendChild(s);
    }
    actions.appendChild(row);
    var url = safeUrl(d.buy_url);
    var buyBox = el("div", "buy-box");
    if (url) {
      var a = el("a", "buy" + (d.sold_out ? " off" : ""), d.sold_out ? "판매 페이지" : "구매하기");
      a.href = url;
      a.target = "_blank";
      a.rel = "sponsored nofollow noopener noreferrer";
      a.setAttribute("aria-label", d.title + " " + a.textContent);
      buyBox.appendChild(a);
      // 제휴 링크일 때만 버튼 옆에 '광고·제휴' 표시 (판매처 원본 링크는 표시 생략)
      if (d.is_affiliate) buyBox.appendChild(el("span", "aff", "광고·제휴"));
    } else {
      buyBox.appendChild(el("span", "aff", "구매 링크 준비 중"));
    }
    actions.appendChild(buyBox);
    body.appendChild(actions);
    c.appendChild(body);
    return c;
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var list = state.deals.filter(function (d) {
      if (state.group && groupOf(d) !== state.group) return false;
      if (state.category && d.category !== state.category) return false;
      if (q && (d.title + " " + (d.category || "") + " " + (d.mall_name || "")).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var big = Number.MAX_SAFE_INTEGER;
    var cmp = {
      latest: function (a, b) { return (b.updated_at || "").localeCompare(a.updated_at || ""); },
      price_asc: function (a, b) { return (a.sale_price == null ? big : a.sale_price) - (b.sale_price == null ? big : b.sale_price); },
      price_desc: function (a, b) { return (b.sale_price == null ? -1 : b.sale_price) - (a.sale_price == null ? -1 : a.sale_price); },
      discount: function (a, b) { return (b.discount_rate || 0) - (a.discount_rate || 0); }
    }[state.sort];
    return list.sort(cmp);
  }

  function render() {
    var list = filtered();
    var grid = $("grid");
    grid.textContent = "";
    list.forEach(function (d) { grid.appendChild(card(d)); });
    $("count").textContent = "상품 " + list.length + "개";
    $("empty").hidden = list.length > 0;
    $("empty").textContent = !state.deals.length ? "아직 등록된 핫딜이 없습니다. 곧 올라올 예정이에요!"
      : (!state.q && !state.category ? "이 탭에는 아직 상품이 없습니다." : "조건에 맞는 상품이 없습니다.");
  }

  function chips() {
    var counts = { "": state.deals.length, coupang: 0, toss: 0, etc: 0 };
    state.deals.forEach(function (d) { counts[groupOf(d)] += 1; });
    var box = $("malls");
    box.textContent = "";
    GROUPS.forEach(function (g) {
      var b = el("button", "chip", g[1]);
      b.appendChild(el("span", "n", String(counts[g[0]])));
      b.type = "button";
      b.dataset.group = g[0];
      b.setAttribute("aria-pressed", String(state.group === g[0]));
      b.onclick = function () {
        state.group = g[0];
        Array.prototype.forEach.call(box.children, function (x) { x.setAttribute("aria-pressed", String(x.dataset.group === state.group)); });
        render();
      };
      box.appendChild(b);
    });
    var cats = {};
    state.deals.forEach(function (d) { if (d.category) cats[d.category] = 1; });
    var sel = $("category");
    Object.keys(cats).sort().forEach(function (c) { var o = el("option", "", c); o.value = c; sel.appendChild(o); });
  }

  function start(data) {
    state.deals = (data && data.deals) || [];
    if (data && data.generated_at) {
      $("updated").textContent = "· 업데이트 " + new Date(data.generated_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
    }
    var chat = data && /^https:\/\/open\.kakao\.com\//.test(data.kakao_openchat_url || "") ? data.kakao_openchat_url : "";
    if (chat) { $("openchat").href = chat; $("openchat").hidden = false; }
    // 쿠팡 파트너스·토스쇼핑 쉐어링크 고지 문장 (게시 파일에 든 문장을 글자 그대로 맨 위에)
    var notices = document.querySelector(".notices");
    ((data && data.disclosures) || []).slice().reverse().forEach(function (t) {
      notices.insertBefore(el("li", "disclosure", t), notices.firstChild);
    });
    chips();
    render();
  }

  var wrap = document.querySelector(".controls-wrap");
  var topEl = document.querySelector(".top");
  var toTop = $("to-top");
  window.addEventListener("scroll", function () {
    var y = window.scrollY || 0;
    wrap.classList.toggle("stuck", topEl.getBoundingClientRect().bottom < 0);
    toTop.hidden = y < 800;
  }, { passive: true });
  toTop.addEventListener("click", function (e) { e.preventDefault(); window.scrollTo(0, 0); });

  $("q").addEventListener("input", function (e) { state.q = e.target.value; render(); });
  $("sort").addEventListener("change", function (e) { state.sort = e.target.value; render(); });
  $("category").addEventListener("change", function (e) { state.category = e.target.value; render(); });

  if (window.HOTDEAL_DATA) {
    start(window.HOTDEAL_DATA);
  } else {
    fetch("deals.json", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(start)
      .catch(function () { $("count").textContent = "상품 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."; });
  }
})();
