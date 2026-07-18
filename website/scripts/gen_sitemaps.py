#!/usr/bin/env python3
"""Portage sitemap generator — emits the app sitemap as SVG in three variants
(landscape, landscape with the admin cluster collapsed, vertical) into
website/static/img/sitemap/. Pages are generated to mirror apps/web/src/app;
update ROUTE data below when routes change, then re-run:

    python3 website/scripts/gen_sitemaps.py
"""
import math, os

GREEN = "#2D5A27"; TEAL = "#1A7A6D"; INK = "#1e2225"; SUB = "#8a8f94"
CARD_BG = "#ffffff"; CANVAS = "#F4F2ED"; BORDER = "#d9d5cc"
OUT = os.path.join(os.path.dirname(__file__), "..", "static", "img", "sitemap")

def esc(s): return s.replace("&","&amp;").replace("<","&lt;")

class Draw:
    def __init__(self):
        self.parts = []
        self.boxes = []   # (x0,y0,x1,y1,title) incl. label zone
        self.paths = []   # (samples, desc) — endpoint-trimmed point lists

    def card(self, x, y, title, route, kind="generic", w=170, h=120, accent=GREEN, badge=None):
        self.boxes.append((x, y, x+w, y+h+36, title))
        e = [f'<g transform="translate({x},{y})">']
        e.append(f'<rect width="{w}" height="{h}" rx="10" fill="{CARD_BG}" stroke="{BORDER}" stroke-width="1.5"/>')
        e.append(f'<rect width="{w}" height="16" rx="10" fill="{accent}" opacity="0.9"/>')
        e.append(f'<rect y="9" width="{w}" height="7" fill="{accent}" opacity="0.9"/>')
        ib = 26
        if kind == "grid":
            cols = max(2, (w-24)//50)
            for r in range(2):
                for c in range(cols):
                    e.append(f'<rect x="{12+c*50}" y="{ib+6+r*40}" width="42" height="32" rx="4" fill="#e8e5de"/>')
        elif kind == "rows":
            n = max(2, (h-ib-8)//21)
            for r in range(n):
                e.append(f'<rect x="12" y="{ib+6+r*21}" width="26" height="15" rx="3" fill="#e8e5de"/>')
                e.append(f'<rect x="46" y="{ib+9+r*21}" width="{w-90}" height="4" rx="2" fill="#dcd8cf"/>')
                e.append(f'<rect x="46" y="{ib+16+r*21}" width="{(w-90)*0.6:.0f}" height="3" rx="1.5" fill="#eae7e0"/>')
        elif kind == "chat":
            e.append(f'<rect x="12" y="{ib+6}" width="{w*0.52:.0f}" height="16" rx="8" fill="#e8f2e6"/>')
            e.append(f'<rect x="{w*0.42:.0f}" y="{ib+28}" width="{w*0.52:.0f}" height="16" rx="8" fill="#e3eeec"/>')
            if h - ib > 74:
                e.append(f'<rect x="12" y="{ib+50}" width="{w*0.62:.0f}" height="16" rx="8" fill="#e8f2e6"/>')
            e.append(f'<rect x="12" y="{h-22}" width="{w-24}" height="12" rx="6" fill="#f0ede6" stroke="{BORDER}"/>')
        elif kind == "form":
            n = max(1, (h-ib-6)//24)
            for r in range(n):
                e.append(f'<rect x="12" y="{ib+4+r*24}" width="52" height="5" rx="2.5" fill="#c9c4b8"/>')
                e.append(f'<rect x="12" y="{ib+12+r*24}" width="{w-24}" height="11" rx="4" fill="#f4f2ed" stroke="{BORDER}"/>')
        elif kind == "detail":
            e.append(f'<rect x="12" y="{ib+4}" width="62" height="52" rx="5" fill="#e8e5de"/>')
            e.append(f'<rect x="82" y="{ib+8}" width="{w-94}" height="6" rx="3" fill="#c9c4b8"/>')
            e.append(f'<rect x="82" y="{ib+20}" width="{(w-94)*0.7:.0f}" height="4" rx="2" fill="#dcd8cf"/>')
            e.append(f'<rect x="82" y="{ib+30}" width="44" height="10" rx="5" fill="#e3eeec"/>')
            e.append(f'<rect x="12" y="{ib+62}" width="{w-24}" height="9" rx="4" fill="#e8f2e6"/>')
            e.append(f'<rect x="12" y="{h-24}" width="{w-24}" height="14" rx="7" fill="{accent}" opacity="0.85"/>')
        elif kind == "dash":
            e.append(f'<rect x="12" y="{ib+4}" width="46" height="30" rx="4" fill="#e8f2e6"/>')
            e.append(f'<rect x="64" y="{ib+4}" width="46" height="30" rx="4" fill="#e3eeec"/>')
            e.append(f'<rect x="116" y="{ib+4}" width="42" height="30" rx="4" fill="#f0e6d9"/>')
            e.append(f'<polyline points="14,{ib+72} 45,{ib+58} 76,{ib+64} 107,{ib+48} {w-14},{ib+54}" fill="none" stroke="{TEAL}" stroke-width="2.5"/>')
        elif kind == "camera":
            e.append(f'<rect x="10" y="{ib}" width="{w-20}" height="{h-ib-26}" rx="6" fill="#23282c"/>')
            gs = min(w-20, h-ib-26) - 16
            gx = 10+((w-20)-gs)/2; gy = ib+((h-ib-26)-gs)/2
            e.append(f'<rect x="{gx:.0f}" y="{gy:.0f}" width="{gs}" height="{gs}" fill="none" stroke="white" stroke-width="1.5" stroke-dasharray="6 4"/>')
            e.append(f'<circle cx="{w/2}" cy="{h-14}" r="9" fill="white"/>')
            e.append(f'<circle cx="{w-24}" cy="{h-14}" r="7" fill="{TEAL}"/>')
        elif kind == "editor":
            e.append(f'<rect x="10" y="{ib}" width="{w-20}" height="{h-ib-30}" rx="6" fill="#23282c"/>')
            e.append(f'<rect x="{w/2-24}" y="{ib+8}" width="48" height="{h-ib-46}" rx="4" fill="#3a4046"/>')
            for i,c in enumerate(["#e8f2e6","#e3eeec","#f0e6d9","#ecdfe8"]):
                e.append(f'<rect x="{14+i*((w-28)/4):.0f}" y="{h-24}" width="{(w-28)/4-6:.0f}" height="14" rx="7" fill="{c}"/>')
        elif kind == "table":
            n = max(2, (h-ib-8)//20)
            for r in range(n):
                e.append(f'<rect x="12" y="{ib+6+r*20}" width="{w-24}" height="12" rx="2" fill="{"#f4f2ed" if r%2 else "#eceae3"}"/>')
        if badge:
            bw = 8+len(badge)*6.5
            e.append(f'<rect x="{w-bw-6}" y="20" width="{bw:.0f}" height="15" rx="7.5" fill="{TEAL}"/>')
            e.append(f'<text x="{w-bw/2-6:.0f}" y="31" font-size="9.5" fill="white" text-anchor="middle" font-weight="700">{esc(badge)}</text>')
        e.append(f'<text x="{w/2}" y="{h+18}" font-size="13.5" font-weight="700" fill="{INK}" text-anchor="middle">{esc(title)}</text>')
        e.append(f'<text x="{w/2}" y="{h+33}" font-size="10.5" fill="{SUB}" text-anchor="middle" font-family="ui-monospace,monospace">{esc(route)}</text>')
        e.append('</g>')
        self.parts.append("\n".join(e))


    @staticmethod
    def _sample_seg(a, b, step=6):
        n = max(1, int(math.hypot(b[0]-a[0], b[1]-a[1]) // step))
        return [(a[0]+(b[0]-a[0])*i/n, a[1]+(b[1]-a[1])*i/n) for i in range(n+1)]

    @staticmethod
    def _trim(samples, dist=24):
        if len(samples) < 3:
            return []
        def cum(seq):
            out, acc = [0.0], 0.0
            for i in range(1, len(seq)):
                acc += math.hypot(seq[i][0]-seq[i-1][0], seq[i][1]-seq[i-1][1])
                out.append(acc)
            return out
        c = cum(samples); total = c[-1]
        return [pt for pt, d0 in zip(samples, c) if dist < d0 < total - dist]

    def _register(self, pts, desc):
        samples = []
        for i in range(len(pts)-1):
            samples += self._sample_seg(pts[i], pts[i+1])
        self.paths.append((self._trim(samples), desc, pts[0], pts[-1]))

    def check(self, name):
        bad = {}
        for samples, desc, start, end in self.paths:
            for (x0, y0, x1, y1, title) in self.boxes:
                # attach exemption: a wire may touch the card it starts or ends on
                if any(x0-4 <= pt[0] <= x1+4 and y0-4 <= pt[1] <= y1+4 for pt in (start, end)):
                    continue
                for (px, py) in samples:
                    if x0 < px < x1 and y0 < py < y1:
                        bad[f"{name}: wire[{desc}] crosses [{title}]"] = (px, py)
                        break
        return [f"{k} near ({v[0]:.0f},{v[1]:.0f})" for k, v in sorted(bad.items())]

    _STYLES = {"nav": (GREEN, "none", 2), "overlay": (TEAL, "5 4", 2), "tab": ("#b3ada0", "2 4", 1.6), "ext": ("#c07a24", "none", 2)}

    def wire(self, pts, kind="nav", label=None, label_at=0, dy=-6):
        color, dash, sw = self._STYLES[kind]
        r = 12
        d = f"M {pts[0][0]} {pts[0][1]}"
        for i in range(1, len(pts)-1):
            (x0,y0),(x1,y1),(x2,y2) = pts[i-1], pts[i], pts[i+1]
            def toward(a,b,dist):
                dx,dy2 = b[0]-a[0], b[1]-a[1]; L = math.hypot(dx,dy2) or 1
                return (a[0]+dx/L*dist, a[1]+dy2/L*dist)
            p1 = toward((x1,y1),(x0,y0),r); p2 = toward((x1,y1),(x2,y2),r)
            d += f" L {p1[0]:.0f} {p1[1]:.0f} Q {x1} {y1} {p2[0]:.0f} {p2[1]:.0f}"
        d += f" L {pts[-1][0]} {pts[-1][1]}"
        self._register(pts, label or f"{pts[0]}→{pts[-1]}")
        dash_attr = f' stroke-dasharray="{dash}"' if dash != "none" else ""
        self.parts.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{sw}"{dash_attr} marker-end="url(#arr-{kind})" opacity="0.9"/>')
        if label:
            a, b = pts[label_at], pts[label_at+1]
            self.parts.append(f'<text x="{(a[0]+b[0])/2:.0f}" y="{(a[1]+b[1])/2+dy:.0f}" font-size="10" fill="{color}" text-anchor="middle" font-weight="700">{esc(label)}</text>')

    def link(self, x1,y1,x2,y2, kind="nav", label=None, bend=0.5):
        color, dash, sw = self._STYLES[kind]
        mx = x1 + (x2-x1)*bend
        bez = [((1-t)**3*x1 + 3*(1-t)**2*t*mx + 3*(1-t)*t*t*mx + t**3*x2,
                (1-t)**3*y1 + 3*(1-t)**2*t*y1 + 3*(1-t)*t*t*y2 + t**3*y2) for t in [i/24 for i in range(25)]]
        self.paths.append((self._trim(bez), label or f"link({x1},{y1})→({x2},{y2})", (x1,y1), (x2,y2)))
        d = f"M {x1} {y1} C {mx} {y1}, {mx} {y2}, {x2} {y2}"
        dash_attr = f' stroke-dasharray="{dash}"' if dash != "none" else ""
        self.parts.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{sw}"{dash_attr} marker-end="url(#arr-{kind})" opacity="0.85"/>')
        if label:
            self.parts.append(f'<text x="{(x1+x2)/2:.0f}" y="{(y1+y2)/2-6:.0f}" font-size="10" fill="{color}" text-anchor="middle" font-weight="600">{esc(label)}</text>')

    def vlink(self, x1,y1,x2,y2, kind="nav", label=None):
        color, dash, sw = self._STYLES[kind]
        my = y1 + (y2-y1)*0.5
        bez = [((1-t)**3*x1 + 3*(1-t)**2*t*x1 + 3*(1-t)*t*t*x2 + t**3*x2,
                (1-t)**3*y1 + 3*(1-t)**2*t*my + 3*(1-t)*t*t*my + t**3*y2) for t in [i/24 for i in range(25)]]
        self.paths.append((self._trim(bez), label or f"vlink({x1},{y1})→({x2},{y2})", (x1,y1), (x2,y2)))
        d = f"M {x1} {y1} C {x1} {my}, {x2} {my}, {x2} {y2}"
        dash_attr = f' stroke-dasharray="{dash}"' if dash != "none" else ""
        self.parts.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{sw}"{dash_attr} marker-end="url(#arr-{kind})" opacity="0.85"/>')
        if label:
            self.parts.append(f'<text x="{(x1+x2)/2+6:.0f}" y="{my+4:.0f}" font-size="10" fill="{color}" text-anchor="middle" font-weight="600">{esc(label)}</text>')

    def cluster(self, x,y,w,h, title, color=SUB):
        self.parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="16" fill="none" stroke="{color}" stroke-width="1.2" stroke-dasharray="8 6" opacity="0.55"/>')
        self.parts.append(f'<text x="{x+16}" y="{y+24}" font-size="14" font-weight="800" fill="{color}" letter-spacing="2">{esc(title)}</text>')

    def header(self, title, sub, legend_x):
        self.parts.append(f'<text x="60" y="62" font-size="30" font-weight="800" fill="{INK}">{esc(title)}</text>')
        self.parts.append(f'<text x="60" y="88" font-size="13.5" fill="{SUB}">{esc(sub)}</text>')
        for i,(kind,label) in enumerate([("nav","navigation"),("overlay","overlay / panel (no route change)"),("tab","tab bar"),("ext","external (eBay)")]):
            color = self._STYLES[kind][0]
            dash = {"nav":"","overlay":' stroke-dasharray="5 4"',"tab":' stroke-dasharray="2 4"',"ext":""}[kind]
            y = 46+i*17
            self.parts.append(f'<line x1="{legend_x}" y1="{y}" x2="{legend_x+42}" y2="{y}" stroke="{color}" stroke-width="2.5"{dash}/>')
            self.parts.append(f'<text x="{legend_x+50}" y="{y+4}" font-size="11.5" fill="{INK}">{label}</text>')

    def fab(self, cx, cy, label_y=None):
        self.parts.append(f'<circle cx="{cx}" cy="{cy}" r="34" fill="{GREEN}"/>')
        self.parts.append(f'<text x="{cx}" y="{cy+7}" font-size="26" fill="white" text-anchor="middle" font-weight="700">+</text>')
        self.parts.append(f'<text x="{cx}" y="{label_y or cy+52}" font-size="12.5" font-weight="700" fill="{INK}" text-anchor="middle">Scan FAB</text>')

    def svg(self, W, H):
        markers = "".join(
            f'<marker id="arr-{k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="{c}"/></marker>'
            for k,(c,_,_) in self._STYLES.items())
        body = chr(10).join(self.parts)
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
                f"font-family=\"'Instrument Sans','Plus Jakarta Sans',system-ui,sans-serif\">\n"
                f'<defs>{markers}</defs>\n<rect width="{W}" height="{H}" fill="{CANVAS}"/>\n{body}\n</svg>')


ADMIN_CHILDREN = [("Users","/admin/users","table"),("User Detail","/admin/users/[id]","detail"),("Inventory","/admin/inventory","table"),
                  ("Listings","/admin/listings","table"),("Orders","/admin/orders","table"),("Marketplace","/admin/marketplace","form"),
                  ("Porter","/admin/porter","chat"),("Observability","/admin/observability","dash"),("Audit Log","/admin/audit","table"),
                  ("Settings","/admin/settings","form")]
SETTINGS = [("Profile","/settings/profile"),("Marketplace","/settings/marketplace"),("Seller Profile","/settings/seller-profile"),
            ("Notifications","/settings/notifications"),("Billing","/settings/billing"),("Help","/settings/help")]


def build_landscape(admin_collapsed=False):
    d = Draw()
    W = 2480
    H = 1480 if admin_collapsed else 2060
    variant = " · admin collapsed" if admin_collapsed else ""
    d.header("Portage — App Sitemap",
             f"Every shipped route (38 pages) + full-screen panels/overlays · generated from apps/web/src/app{variant}", 1650)

    d.cluster(40, 120, 420, 250, "AUTH & LEGAL")
    d.card(70, 155, "Cloudflare Access", "edge IdP · no passwords", "form", w=340, h=110, accent="#c07a24", badge="CF gate")
    d.card(70, 305, "Privacy", "/legal/privacy", "rows", w=150, h=46)
    d.card(260, 305, "Terms", "/legal/terms", "rows", w=150, h=46)

    TABY = 210
    d.cluster(520, 120, 1560, 300, "BOTTOM TAB BAR")
    for t,route,kind,x in [("Home","/home","dash",560),("Inventory","/inventory","grid",790),("Listings","/listings","rows",1020),
                           ("Porter","/porter","chat",1390),("Orders","/orders","rows",1620),("More","/more","rows",1850)]:
        d.card(x, TABY, t, route, kind, w=170, h=120)
    d.fab(1290, 270, 322)

    d.wire([(240,155),(240,108),(500,108),(500,250),(560,250)], "nav", "authenticated", label_at=1)

    d.cluster(40, 470, 560, 640, "CAPTURE (overlays)", TEAL)
    d.card(90, 520, "ScanFlow", "overlay z-60", "detail", accent=TEAL, badge="AI scan")
    d.card(340, 520, "Camera", "multi-shot · 1:1 guide", "camera", accent=TEAL, badge="NEW")
    d.card(340, 750, "Photo Editor", "full-screen panel", "editor", accent=TEAL)
    d.card(340, 950, "Crop", "pan/zoom · fixed 1:1", "camera", accent=TEAL, badge="NEW")
    d.card(90, 830, "Create Listing", "sheet", "form", accent=TEAL, w=170, h=110)

    d.wire([(1290,304),(1290,452),(260,452),(260,520)], "overlay", "scan item", label_at=1, dy=14)
    d.link(260, 580, 340, 580, "overlay", "take photos")
    d.vlink(425, 675, 425, 750, "overlay", "tap photo")
    d.vlink(425, 905, 425, 950, "overlay", "crop tool")
    d.vlink(175, 675, 175, 830, "overlay", "Save & List")
    d.wire([(215,520),(215,438),(855,438),(855,378)], "nav", "save → Inventory", label_at=1)
    d.wire([(260,912),(636,912),(636,430),(1040,430),(1040,378)], "nav", "draft / live", label_at=2)

    DY = 520
    d.cluster(660, 470, 1000, 640, "DETAIL & CREATE")
    d.card(720, DY, "Item Detail", "/inventory/[id]", "detail")
    d.card(720, DY+250, "Item Edit", "/inventory/[id]/edit", "form")
    d.card(980, DY, "Listing Detail", "/listings/[id]", "detail", badge="GTC date")
    d.card(1240, DY, "Order Detail", "/orders/[id]", "detail")
    d.card(1240, DY+250, "eBay item page", "external · Ship-It", "rows", accent="#c07a24", w=170, h=80)
    d.card(980, DY+250, "Create Listing Flow", "/list · hybrid | convo | swipe", "chat", w=210, h=150, badge="preview+comps")
    d.card(1460, DY, "Share Preview", "/inventory/[id]/preview", "detail", h=110, badge="buyer view")
    d.wire([(875,DY),(875,DY-25),(1545,DY-25),(1545,DY)], "nav", "share preview", label_at=1)

    d.vlink(875, 420, 805, DY, "nav")
    d.vlink(805, DY+155, 805, DY+250, "nav", "edit")
    d.vlink(1105, 420, 1065, DY, "nav")
    d.vlink(1705, 420, 1325, DY, "nav")
    d.vlink(1325, DY+155, 1325, DY+250, "ext", "Ship-It")
    d.vlink(890, DY+120, 1000, DY+280, "nav", "List It")
    d.wire([(1005,DY+155),(1005,715),(630,715),(630,800),(510,800)], "overlay", "edit photo", label_at=1)
    d.wire([(760,DY+155),(760,700),(640,700),(640,780),(510,780)], "overlay", None)
    d.wire([(1190,DY+330),(1205,DY+330),(1205,395),(1105,395),(1105,378)], "nav", "publish", label_at=2)
    d.wire([(1020,DY+250),(1020,730),(620,730),(620,585),(510,585)], "overlay", "capture", label_at=2)
    d.wire([(1060,DY+405),(1060,745),(650,745),(650,830),(510,830)], "overlay", "hero tap", label_at=1)

    SX = 2130
    d.cluster(2100, 120, 340, 1100, "SETTINGS & COMMS")
    for i,(t,route) in enumerate(SETTINGS):
        d.card(SX, 160+i*118, t, route, "form", w=170, h=76, badge=("GTC toggle" if t=="Seller Profile" else None))
    d.card(SX, 160+6*118+16, "OAuth callback", "/settings/marketplace/callback", "rows", w=170, h=46)
    d.card(SX, 160+6*118+122, "Messages", "/messages", "rows", w=170, h=76)
    d.card(SX, 160+6*118+248, "Thread", "/messages/[key]", "chat", w=170, h=90)
    d.card(SX, 160+6*118+384, "Beta Report", "/beta/report · via Beta badge", "form", w=170, h=76, badge="beta")
    for i in range(6):
        d.link(2020, 270, SX, 198+i*118, "nav", None, bend=0.6)
    d.vlink(SX+85, 852, SX+85, 882, "nav")
    d.link(2020, 290, SX, 1032, "nav")
    d.vlink(SX+85, 1064, SX+85, 1114, "nav")

    d.cluster(40, 1180, 560, 240, "TUTORIALS")
    d.card(90, 1230, "Tutorial Hub", "/tutorials", "grid", w=200, h=110, badge="8 topics")
    d.card(340, 1230, "Tutorial Topic", "/tutorials/[topic]", "detail", w=200, h=110)
    d.link(290, 1290, 340, 1290, "nav", "topic")
    d.wire([(615,366),(615,1150),(190,1150),(190,1230)], "nav", "tutorials", label_at=1)

    if admin_collapsed:
        d.cluster(660, 1220, 640, 220, "ADMIN (collapsed)")
        d.card(720, 1270, "Admin Panel", "/admin · 11 pages: users (+detail), inventory, listings, orders, marketplace, porter, observability, audit, settings", "dash", w=260, h=110, badge="role gate")
        d.wire([(1935,378),(1935,1255),(1050,1255),(1050,1325),(980,1325)], "nav", None)
        d.parts.append(f'<text x="1120" y="1243" font-size="10" fill="{GREEN}" font-weight="700">More → Admin (role gate)</text>')
    else:
        d.cluster(660, 1380, 1780, 560, "ADMIN (requires role=admin · sidebar layout)")
        d.card(720, 1450, "Admin Home", "/admin", "dash", badge="admin")
        for i,(t,route,kind) in enumerate(ADMIN_CHILDREN):
            col = i % 5; row = i // 5
            x = 990 + col*280; y = 1450 + row*250
            d.card(x, y, t, route, kind, w=170, h=110)
            if row == 0:
                d.wire([(805,1450),(805,1428),(x+85,1428),(x+85,y)], "nav", None)
            else:
                d.wire([(805,1560),(805,1655),(x+85,1655),(x+85,y)], "nav", None)
        d.link(1160, 1505, 1270, 1505, "nav", None, bend=0.5)
        d.wire([(1935,378),(1935,1415),(805,1415),(805,1450)], "nav", None)
        d.parts.append(f'<text x="1080" y="1378" font-size="10" fill="{GREEN}" font-weight="700">More → Admin (role gate)</text>')

    return d.svg(W, H), d


def build_vertical():
    d = Draw()
    W, H = 1240, 3080
    d.header("Portage — App Sitemap", "Vertical · 38 routes + overlays · generated from apps/web/src/app", 880)

    # AUTH
    d.cluster(40, 110, 1160, 230, "AUTH & LEGAL")
    d.card(80, 150, "Cloudflare Access", "edge IdP · no passwords", "form", w=360, h=110, accent="#c07a24", badge="CF gate")
    d.card(900, 150, "Privacy", "/legal/privacy", "rows", w=150, h=46)
    d.card(900, 232, "Terms", "/legal/terms", "rows", w=150, h=46)

    # TAB BAR
    d.cluster(40, 380, 1160, 280, "BOTTOM TAB BAR")
    TABS_V = [("Home","/home","dash",70),("Inventory","/inventory","grid",250),("Listings","/listings","rows",430),
              ("Porter","/porter","chat",700),("Orders","/orders","rows",880),("More","/more","rows",1060, )]
    for t,route,kind,x in [v[:4] for v in TABS_V]:
        d.card(x, 440, t, route, kind, w=150, h=110)
    d.fab(632, 495, 560)

    d.vlink(260, 260, 145, 440, "nav", "authenticated")

    # CAPTURE
    d.cluster(40, 720, 1160, 300, "CAPTURE (overlays)", TEAL)
    d.card(70, 770, "ScanFlow", "overlay z-60", "detail", accent=TEAL, w=170, badge="AI scan")
    d.card(290, 770, "Camera", "multi-shot · 1:1", "camera", accent=TEAL, w=170, badge="NEW")
    d.card(510, 770, "Photo Editor", "full-screen panel", "editor", accent=TEAL, w=170)
    d.card(730, 770, "Crop", "pan/zoom · 1:1", "camera", accent=TEAL, w=170, badge="NEW")
    d.card(950, 770, "Create Listing", "sheet", "form", accent=TEAL, w=170, h=110)

    d.wire([(632,529),(632,690),(155,690),(155,770)], "overlay", "scan item", label_at=1, dy=14)
    d.link(240, 830, 290, 830, "overlay")
    d.link(460, 830, 510, 830, "overlay", "tap photo")
    d.link(680, 830, 730, 830, "overlay", "crop")
    d.wire([(155,895),(155,938),(912,938),(912,830),(950,830)], "overlay", "Save & List", label_at=1, dy=14)
    d.wire([(100,770),(100,675),(325,675),(325,588)], "nav", "save → Inventory", label_at=1)
    d.wire([(1120,800),(1208,800),(1208,645),(505,645),(505,588)], "nav", "draft / live", label_at=2, dy=14)

    # DETAIL & CREATE
    d.cluster(40, 1080, 1160, 480, "DETAIL & CREATE")
    d.card(90, 1130, "Item Detail", "/inventory/[id]", "detail")
    d.card(330, 1130, "Listing Detail", "/listings/[id]", "detail", badge="GTC date")
    d.card(570, 1130, "Order Detail", "/orders/[id]", "detail")
    d.card(90, 1370, "Item Edit", "/inventory/[id]/edit", "form")
    d.card(330, 1370, "Create Listing Flow", "/list · hybrid | convo | swipe", "chat", w=210, h=140, badge="preview+comps")
    d.card(610, 1390, "eBay item page", "external · Ship-It", "rows", accent="#c07a24", w=170, h=80)
    d.card(870, 1130, "Messages", "/messages", "rows", w=150, h=76)
    d.card(870, 1290, "Thread", "/messages/[key]", "chat", w=150, h=90)
    d.card(870, 1440, "Share Preview", "/inventory/[id]/preview", "detail", w=150, h=76, badge="buyer view")
    d.wire([(175,1130),(175,1064),(1210,1064),(1210,1428),(945,1428),(945,1440)], "nav", "share preview", label_at=1, dy=-4)

    d.wire([(325,588),(325,652),(265,652),(265,1048),(175,1048),(175,1130)], "nav")  # Inventory → Item Detail
    d.wire([(505,588),(505,646),(478,646),(478,1042),(415,1042),(415,1130)], "nav")  # Listings → Listing Detail
    d.wire([(955,588),(955,652),(925,652),(925,1048),(655,1048),(655,1130)], "nav")  # Orders → Order Detail
    d.vlink(175, 1285, 175, 1370, "nav", "edit")
    d.vlink(655, 1285, 695, 1390, "ext", "Ship-It")
    d.vlink(260, 1250, 350, 1390, "nav", "List It")
    d.wire([(335,1285),(335,1330),(30,1330),(30,700),(492,700),(492,858),(510,858)], "overlay", None)  # listing detail → editor via left margin
    d.parts.append(f'<text x="70" y="1322" font-size="10" fill="{TEAL}" font-weight="700">edit photo</text>')
    d.wire([(445,1370),(445,1350),(540,1350),(540,1050),(560,1050),(560,905)], "overlay", "capture / hero tap", label_at=3, dy=-4)
    d.wire([(540,1485),(580,1485),(580,1568),(1220,1568),(1220,630),(465,630),(465,588)], "nav", None)  # publish → Listings via right margin
    d.parts.append(f'<text x="620" y="1584" font-size="10" fill="{GREEN}" font-weight="700">publish → Listings</text>')

    # SETTINGS
    d.cluster(40, 1620, 1160, 330, "SETTINGS & COMMS")
    for i,(t,route) in enumerate(SETTINGS):
        col = i % 3; row = i // 3
        d.card(90 + col*260, 1670 + row*130, t, route, "form", w=200, h=76, badge=("GTC toggle" if t=="Seller Profile" else None))
    d.card(890, 1670, "OAuth callback", "/settings/marketplace/callback", "rows", w=200, h=46)
    d.card(890, 1800, "Beta Report", "/beta/report · via Beta badge", "form", w=200, h=76, badge="beta")
    d.wire([(1135,588),(1135,1640),(1010,1640),(1010,1670)], "nav", None)   # More → settings column
    d.parts.append(f'<text x="1140" y="1100" font-size="10" fill="{GREEN}" font-weight="700" transform="rotate(90 1140 1100)">More → Settings · Messages · Admin</text>')
    d.wire([(450,1670),(450,1654),(990,1654),(990,1670)], "nav", "OAuth", label_at=1, dy=-3)
    d.vlink(945, 1206, 945, 1290, "nav")           # Messages → Thread
    d.wire([(1135,900),(1135,1180),(1020,1180),(1020,1168)], "nav", None)  # More → Messages

    # TUTORIALS
    d.cluster(40, 2010, 1160, 180, "TUTORIALS")
    d.card(610, 2060, "Tutorial Hub", "/tutorials", "grid", w=200, h=76, badge="8 topics")
    d.card(870, 2060, "Tutorial Topic", "/tutorials/[topic]", "detail", w=200, h=76)
    d.link(810, 2098, 870, 2098, "nav", "topic")
    d.wire([(710,1912),(710,2060)], "nav", "Help → tutorials", label_at=0, dy=14)

    # ADMIN
    d.cluster(40, 2190, 1160, 810, "ADMIN (requires role=admin · sidebar layout)")
    d.card(90, 2240, "Admin Home", "/admin", "dash", badge="admin")
    for i,(t,route,kind) in enumerate(ADMIN_CHILDREN):
        col = i % 5; row = i // 5
        x = 90 + col*225; y = 2490 + row*250
        d.card(x, y, t, route, kind, w=170, h=110)
        if row == 0:
            d.wire([(175,2360),(175,2460),(x+85,2460),(x+85,y)], "nav", None)
        else:
            d.wire([(120,2360),(120,2420),(60,2420),(60,2710),(x+85,2710),(x+85,y)], "nav", None)
    d.wire([(1185,588),(1185,615),(1232,615),(1232,2215),(260,2215),(260,2240)], "nav", None)    # More → Admin along right margin
    d.parts.append(f'<text x="420" y="2230" font-size="10" fill="{GREEN}" font-weight="700">More → Admin (role gate)</text>')

    return d.svg(W, H), d


def _build_all():
    builders = [("portage-sitemap.svg", lambda: build_landscape(False)),
                ("portage-sitemap-admin-collapsed.svg", lambda: build_landscape(True)),
                ("portage-sitemap-vertical.svg", build_vertical_checked)]
    return builders

def build_vertical_checked():
    return build_vertical()

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    total_bad = []
    for name, builder in [("portage-sitemap.svg", lambda: build_landscape(False)),
                          ("portage-sitemap-admin-collapsed.svg", lambda: build_landscape(True)),
                          ("portage-sitemap-vertical.svg", build_vertical)]:
        svg, d = builder()
        bad = d.check(name)
        total_bad += bad
        path = os.path.join(OUT, name)
        with open(path, "w") as f:
            f.write(svg)
        print("wrote", path, len(svg), "bytes,", len(bad), "collisions")
    for b in total_bad:
        print("  COLLISION:", b)
    raise SystemExit(1 if total_bad else 0)
