// เดโมลองเล่นในหน้า /system: จำลองทั้งหมดในเบราว์เซอร์ ไม่ต่อเซิร์ฟเวอร์ ไม่ส่ง LINE ไม่มีออเดอร์จริง
(function () {
  var MENU = [
    { id: "latte", name: "มัทฉะลาเต้", price: 75, art: ["#F5F0DD", "#9DB54A"], powder: true, milk: true },
    { id: "iced", name: "มัทฉะเย็น", price: 70, art: ["#F3E6C8", "#7A9A3A"], powder: true, milk: true },
    { id: "hoji", name: "โฮจิฉะลาเต้", price: 80, art: ["#E7D8B5", "#7B5A2F"], powder: false, milk: true },
    { id: "yuzu", name: "มัทฉะส้มยูซุ", price: 90, art: ["#F7E7B4", "#5B7A2F"], powder: true, milk: false },
  ];
  var POWDER = [["ผงทั่วไป", 0], ["เกรดพิธีชงชา", 15]];
  var MILK = [["นมสด", 0], ["นมโอ๊ต", 15]];
  var SWEET = [["หวานน้อย", 0], ["หวานปกติ", 0], ["หวานมาก", 0]];
  var SVC = ["ทานที่ร้าน", "กลับบ้าน"];
  var phone = document.getElementById("dmPhone");
  var board = document.getElementById("dmBoard");
  var guide = document.getElementById("dmGuide");
  if (!phone || !board || !guide) return;
  var st;

  function fresh(keep) {
    st = { screen: "menu", cart: [], edit: null, opt: null, svc: 0, order: null, stage: "none", msgs: [], sales: 4820, orders: 38, cups: 61 };
    if (keep) { st.sales = keep.sales; st.orders = keep.orders; st.cups = keep.cups; }
    render();
  }
  function price(it, o) { return it.price + (it.powder ? POWDER[o.p][1] : 0) + (it.milk ? MILK[o.m][1] : 0); }
  function detail(it, o) { return [it.powder && POWDER[o.p][0], it.milk && MILK[o.m][0], SWEET[o.s][0]].filter(Boolean).join(" · "); }
  function total() { return st.cart.reduce(function (a, l) { return a + l.price; }, 0); }
  function chips(key, list, cur) {
    return '<div class="dm-chips">' + list.map(function (x, i) {
      return '<button type="button" class="dm-chip" data-k="' + key + '" data-v="' + i + '" aria-pressed="' + (i === cur) + '">' + x[0] + (x[1] ? " +฿" + x[1] : "") + "</button>";
    }).join("") + "</div>";
  }
  var HEAD = '<div class="app-head"><span class="seal" style="width:34px;height:34px;font-size:13px;border-radius:5px">暗<br>号</span><div><b>DEMO-MATCHA</b><br><small>ร้านตัวอย่าง · เปิดอยู่</small></div></div>';

  function qrCells() {
    var out = "", seed = 7;
    function finder(a, b) { return a < 7 && b < 7 && (a === 0 || a === 6 || b === 0 || b === 6 || (a > 1 && a < 5 && b > 1 && b < 5)); }
    for (var y = 0; y < 21; y++) for (var x = 0; x < 21; x++) {
      var k;
      if ((x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12)) k = finder(x, y) || finder(20 - x, y) || finder(x, 20 - y);
      else { seed = (seed * 9301 + 49297) % 233280; k = seed / 233280 > 0.52; }
      out += '<i class="' + (k ? "k" : "") + '"></i>';
    }
    return out;
  }

  function renderPhone() {
    var h = HEAD, n = st.cart.length, t = total();
    if (st.screen === "menu") {
      h += '<div class="seg"><span class="on">เมนู</span><span>แต้มของฉัน</span><span>ออเดอร์</span></div>';
      h += MENU.map(function (it) {
        return '<button type="button" class="mi dm-item" data-add="' + it.id + '"><i style="background:linear-gradient(' + it.art[0] + " 0 40%," + it.art[1] + ' 40% 100%)"></i><div><b>' + it.name +
          "</b><br><small>เลือกผง นม ความหวานได้</small></div><em>฿" + it.price + '</em><span class="plus" aria-hidden="true">+</span></button>';
      }).join("");
      if (!n) h += '<p class="dm-hint">ลองแตะเมนูสักแก้ว</p>';
      h += '<button type="button" class="dm-main" data-go="checkout"' + (n ? "" : " disabled") + "><span>ตะกร้า " + n + " แก้ว · ฿" + t + "</span><span>ไปชำระเงิน</span></button>";
      if (n) h += '<p class="dm-hint">เพิ่มอีกแก้วได้ หรือกดไปชำระเงิน</p>';
    } else if (st.screen === "opt") {
      var it = st.edit, o = st.opt;
      h += '<button type="button" class="dm-back" data-go="menu">‹ กลับไปเมนู</button><h3>' + it.name + "</h3>";
      if (it.powder) h += '<div class="dm-opt"><b>เกรดผงมัทฉะ</b>' + chips("p", POWDER, o.p) + "</div>";
      if (it.milk) h += '<div class="dm-opt"><b>นม</b>' + chips("m", MILK, o.m) + "</div>";
      h += '<div class="dm-opt"><b>ความหวาน</b>' + chips("s", SWEET, o.s) + "</div>";
      h += '<p class="note">ราคาคิดใหม่ทันทีตามตัวเลือก</p><button type="button" class="dm-main" data-go="addcart"><span>ใส่ตะกร้า</span><span>฿' + price(it, o) + "</span></button>";
    } else if (st.screen === "checkout") {
      h += '<button type="button" class="dm-back" data-go="menu">‹ เพิ่มเมนู</button><h3>สรุปออเดอร์</h3>';
      h += '<div class="dm-opt"><b>วิธีรับ</b>' + chips("svc", SVC.map(function (x) { return [x, 0]; }), st.svc) + "</div>";
      h += '<div class="dm-sum">' + st.cart.map(function (l) {
        return '<div class="r"><span>' + l.name + "<br><small>" + l.detail + "</small></span><span>฿" + l.price + "</span></div>";
      }).join("") + '<div class="r tot"><span>ยอดชำระ</span><span>฿' + t + "</span></div></div>";
      h += '<p class="note">ได้แต้มสะสม ' + Math.floor(t / 25) + ' แต้ม (ทุก ฿25 = 1 แต้ม)</p><button type="button" class="dm-main red center" data-go="pay">ชำระเงิน ฿' + t + "</button>";
    } else if (st.screen === "pay") {
      h += '<h3>สแกนจ่าย PromptPay</h3><div class="dm-qr" role="img" aria-label="QR ตัวอย่าง ใช้จ่ายจริงไม่ได้">' + qrCells() + '</div><p class="dm-amt">฿' + t + "</p>";
      h += '<p class="note" style="text-align:center">ของจริง: บันทึก QR ไปสแกนในแอปธนาคาร แล้วแนบสลิป</p><button type="button" class="dm-main center" data-go="slip">จำลองว่าโอนแล้ว · แนบสลิป</button><p class="dm-hint">เดโม ไม่มีการตัดเงินจริง</p>';
    } else if (st.screen === "checking") {
      h += '<div class="dm-spin" role="status" aria-label="กำลังตรวจสลิป"></div><p style="text-align:center;margin:0;font-weight:600">กำลังตรวจสลิปอัตโนมัติ…</p>';
    } else if (st.screen === "status") {
      var od = st.order;
      if (st.stage === "picked") h += '<div class="dm-ok" aria-hidden="true">✓</div><p style="text-align:center;margin:0;font-weight:700;font-size:17px">ขอบคุณที่อุดหนุน</p><span class="dm-pts">+' + od.points + " แต้มเข้าบัตรสมาชิกแล้ว</span>";
      if (st.stage === "new" || st.stage === "making") h += '<p class="dm-hint">ตาร้านแล้ว ลองกดปุ่มในหลังร้าน (ฝั่งขวา หรือด้านล่างบนมือถือ)</p>';
      if (st.stage === "ready") h += '<p class="dm-hint">ลูกค้ามารับแล้ว? กด "ลูกค้ารับแล้ว" ที่หลังร้าน</p>';
      h += '<div class="dm-chat"><p class="who">DEMO-MATCHA · LINE</p>' + st.msgs.slice().reverse().map(function (m) {
        return '<div class="dm-msg"><div class="hd' + (m.red ? " red" : "") + '"><span>' + m.t + "</span><span>#" + od.no + '</span></div><div class="bd">' + m.b + "</div></div>";
      }).join("") + "</div>";
      if (st.stage === "picked") h += '<button type="button" class="dm-main center" data-go="again">ลองสั่งอีกรอบ</button>';
    }
    phone.innerHTML = h;
  }

  function ticket(no, when, items) { return '<div class="tk"><div class="r"><b>#' + no + "</b><span>" + when + "</span></div>" + items + "</div>"; }

  function renderBoard() {
    var o = st.order, h = "", mine = "";
    if (st.stage === "new") {
      h += '<div class="dm-alert" role="alert"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>ออเดอร์ใหม่ #' + o.no + " · เสียงเตือนดังจนกว่าจะกดรับทราบ</div>";
    }
    h += '<div class="stats"><div class="stat"><small>ยอดวันนี้</small><b>฿' + st.sales.toLocaleString("th-TH") + '</b></div><div class="stat"><small>ออเดอร์</small><b>' + st.orders +
      '</b></div><div class="stat"><small>แก้วที่ขาย</small><b>' + st.cups + "</b></div></div>";
    if (o) {
      var btn = {
        new: '<button type="button" class="go red" data-act="ack">รับทราบ · เริ่มทำ</button>',
        making: '<button type="button" class="go" data-act="done">ทำเสร็จแล้ว</button>',
        ready: '<button type="button" class="go" data-act="pick">ลูกค้ารับแล้ว</button>',
        picked: '<div class="go off">เสร็จสิ้น</div>',
      }[st.stage];
      mine = '<div class="tk mine' + (st.stage === "new" ? " alarm" : "") + '"><span class="you">ออเดอร์ของคุณ</span><div class="r"><b>#' + o.no + "</b><span>" + SVC[o.svc] + "</span></div>" +
        o.lines.map(function (l) { return "1× " + l.name + '<br><span class="opt">' + l.detail + "</span>"; }).join("<br>") +
        '<div class="opt">ตรวจสลิปผ่าน ฿' + o.total + "</div>" + btn + "</div>";
    }
    function col(title, html) { return "<div><h4>" + title + "</h4>" + html + "</div>"; }
    h += '<div class="kan">' +
      col("กำลังทำ", (st.stage === "new" || st.stage === "making" ? mine : "") + ticket(12, "ทานที่ร้าน", "1× มัทฉะเย็น") + ticket(13, "กลับบ้าน", "1× โฮจิฉะลาเต้")) +
      col("พร้อมรับ", (st.stage === "ready" ? mine : "") + ticket(11, "โต๊ะ 3", "2× มัทฉะส้มยูซุ")) +
      col("เสร็จแล้ว", (st.stage === "picked" ? mine : "") + ticket(10, "กลับบ้าน", "1× มัทฉะลาเต้")) +
      "</div>";
    if (!o) h += '<p class="dm-idle">รอออเดอร์จากมือถือลูกค้า…</p>';
    board.innerHTML = h;
  }

  function renderGuide() {
    var cur = !st.order ? (st.screen === "menu" || st.screen === "opt" ? 1 : 2) : st.stage === "new" ? 3 : st.stage === "picked" ? 5 : 4;
    guide.querySelectorAll("li").forEach(function (li) {
      var g = +li.getAttribute("data-g");
      li.className = g < cur ? "done" : g === cur ? "on" : "";
    });
  }
  function render() { renderPhone(); renderBoard(); renderGuide(); }

  // เสียงเตือนสั้น ๆ 3 ครั้ง (เล่นได้เพราะเกิดหลังผู้ใช้กดปุ่ม)
  var ac;
  function beep() {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.25, 0.5].forEach(function (t) {
        var o = ac.createOscillator(), g = ac.createGain(), at = ac.currentTime + t;
        o.frequency.value = 880; o.connect(g); g.connect(ac.destination);
        g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.15, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
        o.start(at); o.stop(at + 0.2);
      });
    } catch (e) {}
  }
  // จอแคบ: มือถือจำลองกับหลังร้านเรียงบนล่าง เลื่อนไปหาส่วนที่ต้องกดต่อให้เอง
  function bring(el) {
    if (window.innerWidth > 900) return;
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  }
  function say(t, b, red) { st.msgs.push({ t: t, b: b, red: red }); }

  phone.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    var d = b.dataset;
    if (d.add) {
      st.edit = MENU.filter(function (m) { return m.id === d.add; })[0];
      st.opt = { p: 0, m: 0, s: 1 };
      st.screen = "opt";
    } else if (d.k) {
      if (d.k === "svc") st.svc = +d.v; else st.opt[d.k] = +d.v;
    } else if (d.go === "addcart") {
      st.cart.push({ name: st.edit.name, detail: detail(st.edit, st.opt), price: price(st.edit, st.opt) });
      st.screen = "menu";
    } else if (d.go === "slip") {
      st.screen = "checking";
      render();
      setTimeout(function () {
        var t = total();
        st.order = { no: 15, svc: st.svc, lines: st.cart.slice(), total: t, points: Math.floor(t / 25) };
        st.stage = "new"; st.screen = "status";
        st.orders += 1; st.cups += st.cart.length; st.sales += t;
        say("ตรวจสลิปผ่าน เข้าคิวแล้ว", "ยอด ฿" + t + " · " + SVC[st.svc] + "<br><small>ออเดอร์เสร็จเมื่อไรจะแจ้งอีกครั้ง</small>");
        beep();
        render();
        bring(board);
      }, 1400);
      return;
    } else if (d.go === "again") {
      fresh({ sales: st.sales, orders: st.orders, cups: st.cups });
      return;
    } else if (d.go) {
      st.screen = d.go;
    }
    render();
    phone.scrollTop = 0;
  });

  board.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-act]");
    if (!b) return;
    var a = b.dataset.act, o = st.order;
    if (a === "ack") { st.stage = "making"; say("กำลังทำเครื่องดื่ม", "บาริสต้ารับออเดอร์แล้ว"); }
    else if (a === "done") { st.stage = "ready"; say("พร้อมรับแล้ว", o.lines.length + " แก้ว · " + SVC[o.svc] + "<br><small>แสดงเลข #" + o.no + " ที่เคาน์เตอร์</small>", true); }
    else if (a === "pick") { st.stage = "picked"; say("ขอบคุณที่อุดหนุน", "ได้รับ " + o.points + " แต้ม<br><small>สะสมแต้มแลกเครื่องดื่มฟรีได้</small>"); }
    render();
    phone.scrollTop = 0;
    if (a !== "ack") bring(phone);
  });

  document.getElementById("dmReset").addEventListener("click", function () { fresh(); });
  fresh();
})();
