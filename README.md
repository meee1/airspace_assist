# Radio Calls AU

**Open the app: https://meee1.github.io/airspace_assist/app/** (source: [`app/`](app/))

Phone and tablet web app for VFR pilots (built with helicopters in mind):
- the closest aerodrome (or the next one on your flight plan), with CTAF, ATIS/AWIS, tower and approach frequencies, runways and a radio call guide
- the area frequency and airspace class for your position and altitude, with an alert when controlled or restricted airspace is within 10 NM ahead
- an airspace map at the top of the screen (pan, pinch zoom, track or north up) with a 10 NM lead line ahead of you, terrain, VTC/VNC chart underlay, waypoints, towns and suburbs
- GPX flight plans (or plans built and edited on the phone, saved back as GPX) with auto-advancing waypoints, direct-to and resume, an elevation profile and suggested VFR altitudes
- the frequencies where you're going as well as where you are: CTAF/tower and area/ATC at the Go to point, tower hours at your ETA
- NOTAMs from a NAIPS briefing (pasted, shared or opened as a PDF), on the aerodrome card, the map and along the route
- ADS-B traffic through a small proxy, with TCAS-style symbols and spoken alerts (not TCAS)
- a flight log you can show on the map or download as GPX
- search and Go to for any aerodrome, waypoint, navaid, town or suburb, typed or spoken (mic button, phonetic alphabet), or by pressing and holding on the map, which also shows any restricted or danger areas there with their ERSA status, hours and contact

It all runs offline once loaded (live NOTAMs and traffic need signal). While it starts, a loading screen lists each step (aerodromes and airspace with the ERSA date, towns and suburbs, app code) with the MB received, and says whether it is loading from offline storage. If something can't load, it shows which step failed and why. ERSA and the DAH are always the first source. The layout adapts from phones to 10" tablets.

## Top bar
Always visible at the top of the screen:
- **GPS:** an icon only, to save space. It's green when the phone reports accuracy better than 50 m, orange to 300 m, and red worse than that, or with no fix or permission denied. It's grey before the first fix. In the simulator it's orange with SIM under it. Hover or long-press for the accuracy (e.g. "GPS fix, accuracy ±8m").
- **TRK / HDG:** your GPS track in °M, or the compass heading when you're too slow for a track (hovering, taxiing, on the ground).

**Compass alignment:** a phone in a cradle rarely points exactly along the aircraft, and the airframe bends the compass too. While you fly straight and steady at 20 kt or more, the app averages the difference between GPS track and compass (about 20 s to align) and adds it to the compass whenever it falls back to it, so HDG lines up with where the nose points. The button below the map shows "Compass aligned +12°" (or "aligning …%"); tap it to reset after moving the phone. The offset also takes in the wind correction angle at the time, so it's best learnt into wind or in light wind. It's kept on the phone until you reset it. Simulation doesn't change it.
- **PLAN:** the magnetic bearing to the active flight plan waypoint (or the Go to point when there's no plan), with the waypoint name and the turn from your current track (L/R in degrees; orange at 10° or more). No wind correction, so it's the planned track rather than a heading to steer.
- **GS** in knots, and **ALT** (GPS, ft) with height above the terrain under it.
  - **Altitude datum:** Android gives GPS altitude above the WGS84 ellipsoid, while SRTM terrain and AIP limits are above mean sea level (the EGM96 geoid). The app subtracts the geoid height from a 0.25° EGM96 grid (8–46°S, 104–170°E), so ALT is above mean sea level. The difference is small around Melbourne (+2 m at Barwon Heads, +4 m at Moorabbin) but large elsewhere: +62 m (204 ft) at Cairns, +72 m at Cape York, −32 m (−104 ft) at Perth. iPhones already report sea-level altitude and aren't corrected. On a computer, hovering over the ALT tile shows the correction in use; the footer says it is applied.
- **CLASS:** the airspace class at your position and altitude, the top of that band (cap) and its lower limit (LL); a restricted or danger area you're in is added.
- **CTAF:** the CTAF of the aerodrome closest to you, with its code. It follows your position, not the aerodrome card, which may be pinned or following the flight plan (the Go to tiles cover where you are heading). During tower hours it shows the tower frequency instead (**TWR**). Where ERSA splits the tower by side, it shows the one for your side, e.g. at Moorabbin **TWR W 123.0** west of the field and **TWR E 118.1** east of it. Over the field it uses the side of your next flight-plan waypoint. Without one it keeps the side you arrived from for 3 minutes, takes it from your track after take-off, and otherwise says "see ATIS". On the ground at a towered aerodrome (under 30 kt and within 200 ft of its elevation) it shows **GND**, e.g. GND 134.25 at Moorabbin. Where ERSA ties an arrival reporting point to a frequency, that wins over the bearing. For example, Moorabbin's "When RWY 17 or 35 in use, ARR VFR ACFT from the S should track via and report at CARR on 123.0" applies when you're heading for CARR, within 3 NM of it, or south of the field. So Carrum shows **TWR W 123.0 · via CARR (RWY 17/35)**, even though it's just east of south. It goes back to the side rule if you pick another runway in Radio calls.
- **AREA:** the Class G/E area frequency at your position and altitude, or **ATC** (coloured by class) when you're in controlled airspace, with the unit ("Melbourne Ctr", "Moorabbin Twr"). Both are the same as the frequency list below, just always visible. Where more than one area frequency is stacked over your position (e.g. 123.35 from SFC and 135.3 from A085 near Barwon Heads), the unit line adds where yours starts ("Melbourne Ctr · LL SFC"); the Go to area tile does the same, and the map's area frequency labels read "123.35 SFC" / "135.3 A085".
- **Controlled aerodrome row:** when the closest aerodrome has a tower or approach in ERSA, a row under CTAF/AREA lists its other frequencies: ATIS (or AWIS), TWR (with E/W at a split tower), GND, DEL, APP and the first DEP. At Moorabbin: ATIS 120.9 · TWR 118.1 E · TWR 123.0 W · GND 134.25. Outside tower hours it says "TWR closed" and strikes through TWR, GND and DEL. Tap it to scroll to the aerodrome card.
- **Go to tiles (dashed, marked →):** while a Go to point is set (a flight plan sets it to the active waypoint), a second pair shows where you are heading:
  - **→ CTAF / → TWR:** the aerodrome at the Go to point, or the nearest one within 10 NM of it ("CARR 25 NM · YMMB 6.0 NM from it"), with distance and time to go. Tower hours are checked at your ETA ("TWR closed at ETA" when that differs from now), and a split tower gives the side you are approaching from (Moorabbin from the west: TWR W 123.0).
  - **→ AREA / → ATC:** the area or ATC frequency over the Go to point at your current altitude, e.g. "ATC D 123.0 Moorabbin Twr W · over YMMB at 1500 ft".
  - **→ controlled aerodrome row:** the destination's ATIS, TWR, GND and APP when it has a tower. Tapping it shows that aerodrome in the card.
  - They hide when you are within 0.3 NM of the point, or when they would repeat the top tiles (you are already at the destination).
- **Next CTAF / next AREA:** under each, the frequency you can expect next and how far away it changes, e.g. "next 121.6 in 9.0 NM · YMEL" or "next ATC 132.0 in 4.0 NM · Melbourne App". The path ahead is the rest of your flight plan, or a straight line along your track when there's no plan (nothing is shown when you're stationary), out to 80 NM at your current altitude. Next CTAF is the first ERSA aerodrome you'll come within 10 NM of whose CTAF differs from the one in the CTAF tile (the same aerodromes the tile uses: with **All** on, private strips count too; HLS only with heliports on). Next AREA is the first point where the frequency for your altitude changes in the DAH. If you climb or descend, the answer changes with you.
- **IN alert:** while you're inside a restricted (R), prohibited (P) or danger (D) area at your current altitude, a red-edged row under the top bar shows it, e.g. **IN D373** SFC–FL125 · danger area · parachuting (skydiving) · check status · HJ · BARWON HEADS, or **IN R222F** SFC–UNL · restricted RA2 · military flying/non-flying · clearance or check status. Limits are from the DAH. The status (RA1/2/3), activity and hours come from the ERSA SUA list. The row wraps on a narrow screen rather than cutting the end off. Above or below the area's limits it doesn't show. One line per area if you're in several.
- **NEXT CLASS alert:** a red row under the top bar appears when controlled airspace (class A, C or D, including control zones) or a restricted area starts within 10 NM ahead at your current altitude. It shows the class or area, its limits and the distance, e.g. "C A025–FL180 in 4.0 NM · Melbourne App 132.0 · clearance" or "R330B SFC–A045 in 5.0 NM · restricted, check status". Ahead means along the flight plan, or along your track without one. Class G/E changes and anything further away don't show; the CLASS tile and the AREA "next" line cover those. For a split tower it gives the frequency for your side, e.g. "Moorabbin Twr W 123.0" approaching from the west.

## Simulate locally (any lat/lng)
No GPS needed. The app loads its data from `app/data.json`, so it has to be served over http (opening `index.html` as a file won't work):

- Run `./simulate.sh -38.04,144.47 2500 270 90` (macOS/Linux) or `simulate.bat -38.04,144.47 2500 270 90` (Windows). The arguments are position, altitude in ft, track in °M and ground speed in kt. This serves the app on http://localhost:8765 and opens it.

The position field accepts:
- decimal degrees: `-38.04, 144.47` (a missing minus is assumed south)
- DMS: `38 02 22S 144 28 10E`
- packed degrees and minutes: `3802.4S 14428.2E`
- an aerodrome code: `YMAV`
- a VFR waypoint (`CARR`), navaid ident (`AV`) or IFR waypoint, or a VFR waypoint name (`CARRUM`)

**Fly** moves the position along the track at the ground speed, so you can watch the frequencies change as you go. With a flight plan loaded it flies the route; typing a track takes over until you press Fly again. Track, ground speed and altitude apply as you type. On the phone, the **Simulate** button opens the same panel. URL form: `index.html?sim=YBTH&alt=3000&trk=320&gs=90`.

## Area frequency and altitude
The area frequency depends on altitude. The app builds the airspace stack above your position from the DAH steps. Class G uses the area (FIA) frequency, class E uses the E frequency boundary, and C and D use the controlling unit. Your current band is highlighted. At Avalon, for example, it lists SFC–A025 D Avalon Tower 120.1, then A025–A045 E Avalon 133.55, then A045+ C Melbourne Approach 132.0. GPS altitude is geometric, not pressure altitude, so near a band boundary go by the altimeter and the chart.

## Airspace map
The map sits at the top of the screen, straight under the top bar, with Go to, the flight plan and the aerodrome card below it. Pinch to zoom (2.5 to 320 NM; the mouse wheel on a computer), or use − and + to step through 2.5, 5, 10, 20, 40, 80, 160 and 320 NM, and the button to switch between track up and north up. Below them, **CTAF**, **Terrain**, **Charts**, **Lead** and **Log** turn those layers on and off (remembered on the phone).

**Log** draws the flight log on the map: the track you've flown in the last 6 hours (the same fixes that **Flight log** downloads), as a dark line that fades with age, broken where there's a gap of over a minute or 1.5 NM (screen off, app closed). A ring marked →4 shows where the flight plan moved on to waypoint 4. In simulation, the simulated track of this session is shown in grey; it's never stored or exported. Off by default.
- Lines follow chart conventions: C solid blue, D and CTR dashed blue, E violet, restricted areas red, danger areas dashed orange.
- Each step is labelled chart-style: class, then upper over lower limit.
- Area frequency boundaries are dotted green, with the frequency inside each area.
- The airspace you're in at your altitude is shaded.
- **Lead line:** an orange dashed line runs 10 NM ahead of your arrow along your track (or compass heading when slow), with a cross line every 1 NM and every second one numbered (2, 4 … 10), so you can judge distances to anything ahead at a glance. The **Lead** button turns it off and on.
- **CTAF layer:** the CTAF button turns it on and off.
  - Each aerodrome gets a 10 NM area (the AIP CTAF call distance), along with any DAH broadcast areas.
  - A tower aerodrome gets its whole control zone instead of a circle: on its CTAF when it has one for when the tower is closed (Moorabbin 118.1, Avalon 120.1), otherwise on the tower frequency, labelled TWR (Melbourne TWR 120.5). Where two tower aerodromes share a zone (Essendon in Melbourne's), the zone goes to the one nearer its middle.
  - Tower aerodromes come first: with **Split overlapping CTAF areas** on, the CTAF areas around a control zone stop at its edge. A smaller zone inside a bigger one keeps its own frequency. A strip inside a zone (such as YAVE at Avalon) doesn't cut its neighbours' circles.
  - Areas on the same frequency merge into one translucent shape with one outline and one colour.
  - Frequencies in view never share a colour. The AIP default 126.7 is drawn in neutral grey so specific CTAFs stand out.
  - The legend lists the frequencies in view, and each aerodrome's frequency is printed beside it.
- **Runways:** at 5 NM and closer, runways are drawn on the map; at 2.5 NM they're labelled with their designators.
- The map only shows airspace starting below FL125, or below 5,000 ft above you, so the high-level steps don't clutter it.
- **Labels:** each airspace label sits wholly inside its own area. Controlled-airspace labels also avoid any part with lower controlled airspace, so a "C A045" label doesn't land inside the A025 step or a control zone. If a step has no room on screen, its label is left off.
- **Chart underlay (VTC/VNC):** the site carries 39 Airservices sheets (26 NOV 2026): every VTC and VNC except the Tindal VNC and the Sydney inset VTC, which couldn't be located automatically. The Melbourne VNC and VTC download by default; tick others in **Options**. The VTC is drawn above the VNC.
  - **Download:** they come with the app as pre-rendered tiles in `app/charts/` (about 12 MB, built by `tools/chartiles.py`). They download in the background the first time the app opens with signal and are then stored for offline use; the footer counts the stored tiles.
  - **Which charts download:** **Options** (in the buttons row, next to **Simulate**) lists the charts the site offers with their edition and size; untick one to stop downloading it and free its stored tiles, tick it to fetch it. On first use only the sheets marked `"default": true` in `tools/charts.json` are ticked (the Melbourne VNC and VTC); any other sheet, and one added to the site later, starts unticked (later additions are marked **NEW**), so pilots download only the regions they pick.
  - **Controls:** the **Charts** button turns the underlay on and off. **Chart underlay** under the map opens a pop-up over the map with import and the opacity slider; ✕, Esc or touching the map closes it. With one or two sheets the line under the map names them; with more it shows a count and size ("39 charts · 175 MB"). In the pop-up, more than four sheets fold into that count line: tap it to list them.
  - **Newer edition:** you can import an Airservices PDF on the phone (rendered there with pdf.js in `app/lib/pdfjs`). An imported chart replaces the built-in one for that sheet until you remove it.
  - **Georeferencing:** each chart panel is fitted to its own printed latitude/longitude graticule (`tools/chartref.py`), within about 10 m; aerodrome symbols land within ~10-15 m of their ERSA position and R/D/P areas within ~45 m. The PDF artwork is ~0.4 % wider east-west than north-south, so this is an affine fit. Waypoints, airspace and frequencies drawn on top still come from the AIP data; the chart's cyan C/D/A lines are printed ~100-130 m from the DAH positions, so the app's own airspace lines will not sit exactly on them.
  - **Terrain:** with a chart showing, the grey terrain relief is hidden, but the red and amber terrain warnings stay.
  - **Copyright:** the charts are Airservices copyright. Publishing the tiles on this site is the owner's decision.
- **Zoomed far out (160 / 320 NM):** aerodrome dots get smaller, and the CTAF layer, NOTAM circles, waypoints and labels only show at 80 NM and closer (the CTAF legend says so); the map uses a flat projection centred on you, so shapes at the edges are stretched by a few percent at 320 NM.
- **Pan and zoom:** drag the map with one finger to look around; pinch with two to zoom (about the centre of the view). While panned it shows north up and stays put as you move; tap **◎ Centre** to go back to your position. A tap without dragging still picks a waypoint or aerodrome for Go to.
- **Split overlapping CTAF areas** (**Options**, on by default): with **CTAF** on, where two aerodromes with different CTAFs are less than 20 NM apart their 10 NM circles are cut halfway between them, so each spot shows only the nearer aerodrome's frequency. Untick it to see the full overlapping circles.
- **Split 126.7 areas too** (**Options**, off by default): with it off, the grey 126.7 circles of strips without their own CTAF don't cut anything and aren't cut, so a specific CTAF keeps its full 10 NM circle (this matters with **All** on, where private strips such as Lethbridge and Little River would otherwise cut Point Cook or Eynesbury). Tick it to split 126.7 like any other frequency.
- **Legend:** tap an item (C, D / CTR, E, R, Danger, Area freq boundary, VFR waypoint, Terrain) to hide or show it on the map; hidden items are struck through and remembered. Terrain is the same switch as the Terrain button.
- **Computer / landscape tablet:** the map takes the full window height left after its buttons and legends, so everything shows without scrolling, even with CTAF on.
- **Press and hold** anywhere on the map (right-click on a computer; the note beside the zoom buttons is a reminder) for that point's details, with a crosshair marking it:
  - **Where it is:** the nearest town, locality or suburb ("St Andrews", or "1.6 NM N of Seville East").
  - **Its position:** degrees and decimal minutes plus decimal lat/lon, its distance and bearing from you, and the terrain height there.
  - **Special use airspace there:** every prohibited, restricted, danger and military operating area over the point, at all levels, from the ERSA SUA list:
    - its limits (from the DAH) and hours, with HJ, H24 and NOTAM explained
    - the activity, e.g. Parachuting or Military Flying
    - the controlling authority or contact, with a tap-to-call phone number
    - for restricted areas, the RA1/RA2/RA3 conditional status and what ERSA says it means
    - for example, R330A Point Cook: RA3, NOTAM, Point Cook AD OPR 03 8348 6888
  - **What you can do:** **Go to this point**, **Move simulator here** (in the simulator; keeps its altitude, track and speed), **Go to** the nearest aerodrome, VFR waypoint or navaid within 2 NM, **Copy lat/lon**, and add the point to the flight plan: **Start flight plan at …** when there is none, or **Insert … after …** (where it adds the least distance to the rest of the route) and **Add … at end of plan**. Pressed within 0.3 NM of an aerodrome, VFR waypoint or navaid, that point is added rather than a bare position. While a waypoint is marked for replacing in Edit, **Replace … with …** appears too.
  - **Closing it:** tap elsewhere, drag the map or tap ✕.

## Runways and aerodrome diagram
The aerodrome card's head (code, name, distance and arrow) stays at the top of the screen while you scroll down through the runways and frequencies; on a landscape tablet it sits under the top bar. In the runway diagram every runway number stays inside the box, whatever way track up turns it.
The aerodrome card shows a small runway diagram and a runway list.
- **Diagram:** runways are drawn to scale and labelled with their designators. You appear as an arrow, or on the edge of the diagram with your distance when you're further out, so you can see which side you're joining from. It follows the main map's track-up or north-up setting.
- **List:** designator, length, surface and right-hand circuits, e.g. "17L/35R 1,341 m sealed 35R RH". Tap an RH tag for ERSA's conditions (Moorabbin's day and night circuit directions, for example). Other circuits are left-hand unless ERSA says otherwise.
- **Sources, AIP first:**
  - For 345 certified aerodromes, runway positions come from the DAH threshold table (Section 18).
  - For other aerodromes they're drawn from the ERSA bearing and length, or from the designator heading when ERSA gives no bearing. These are dashed and labelled "schematic".
  - Lengths, surface and width come from ERSA.
- **Radio calls:** a Runway picker lists that aerodrome's runways (RH marked), and the calls use the one you pick instead of "runway [XX]".

## Flight plan (GPX)
Tap **Import GPX** and pick a route exported from OzRunways, AvPlan or similar. Tested with an OzRunways export: YBRS – NAV2 – YBSS – RLR – … – PIPS – YBRS, 14 points.
- **What it reads:** the route points (`rtept`). If the file has no route it uses the waypoints (`wpt`), then a track (`trkpt`, thinned to 60 points).
- **AIP labels:** each point is matched against the AIP by name and position, e.g. "RLR VFR waypoint · Rosslynne Resv" or "YBSS Aerodrome · Bacchus Marsh". Unmatched points keep the description from the GPX, or show as a user point with the nearest VFR waypoint.
- **Next waypoint:** a panel shows it with bearing °M, distance, cross-track error (L/R), ETE at your ground speed, leg course, and distance and time to go.
- **Elevation profile:** under the next-waypoint panel, the whole route drawn side-on:
  - **Terrain:** from the SRTM tiles, the highest point in each 30″ cell.
  - **Controlled airspace and restricted/danger areas:** from the DAH, in the airspace map colours, with each base drawn as a solid line.
  - **Waypoints:** dashed lines.
  - **You:** your position and GPS altitude, shown while you're within 5 NM of the route.
  - **Red line:** wherever terrain comes within 1,000 ft of the airspace base above it.
  - **Summary:** the highest terrain, the lowest controlled-airspace base, any control zones from the surface you cross (shown as class G when ERSA says the tower is closed), and the tightest terrain-to-base gap.
  - **Altitude zoom:** + and − above the chart set the top altitude, from 1,000 ft up to 25,000 ft, and **Auto** goes back to fitting the route. A red note shows when terrain is above the top.
  - **Tap:** shows the distance, leg, terrain height and the airspace stack at that point.
  - **Accuracy:** terrain is along straight legs, and the 30″ grid can miss a narrow peak or mast. It's for planning awareness, not obstacle clearance.
- **Suggested altitude per leg:** shown in the leg list, as a purple line on the profile, and spelled out under the next-waypoint panel for the active leg.
  - **VFR levels:** taken from AIP ENR 1.7 Table B by the leg's magnetic track. Tracks 000–179° use 1,500, 3,500, 5,500…; tracks 180–359° use 2,500, 4,500, 6,500…
  - **Minimum height** (red dashed line on the profile), from CASR 91.265/91.267 and the MOS 12.01 note:
    - over populous areas, 1,000 ft above the highest terrain within 600 m (300 m for helicopters);
    - elsewhere, 500 ft above the highest terrain within 300 m.
  - **Populous areas:** the ABS Urban Centres and Localities 2021, drawn as a grey strip along the bottom of the profile. Helicopter or aeroplane follows the category set in Radio calls.
  - **Ceiling:** the base of class C, D or A airspace, less a buffer you choose (500 ft by default). Class E needs no clearance for VFR, so it doesn't limit the suggestion; the note says when you'd be in E, and offers an altitude below it where one fits.
  - **Control zones:** a control zone of the aerodrome at either end of a leg is left out, because you'll be talking to the tower. The ERSA CTR entry or helicopter altitude is quoted instead.
  - **Climb and descent:** the minimum height isn't counted within 2 NM of the plan's first and last aerodrome.
  - **Below 3,000 ft:** the table applies only "whenever practicable" (ENR 1.7 3.1.4), so a non-table altitude is offered when no table level fits (shown orange).
  - **Flagged in red:** a leg that needs different levels along its length ("split" — add a waypoint), or where the minimum height is above the airspace limit ("!" — get a clearance or re-route).
  - **Obstacles:** masts and buildings are not in the data. Check the VTC/VNC.
- **Leg list:** each leg's course and distance. Tap a leg to make it active; Prev, Next, Edit, Reverse, Remove, Save GPX and Flight log are below the list.
- **Editing:** tap **Edit** (or **New plan** when none is loaded) to change the route on the phone. Edits are saved with the plan.
  - **Add:** a search box above the list uses the same fuzzy search as Go to (codes, names, towns, suburbs). Tap a match or press Enter; the box stays open for the next point. The menu beside it says where it goes: **at end**, **best fit** (least added distance to the rest of the route) or **as next** (it becomes the active waypoint).
  - **Move and delete:** ▲ and ▼ move a waypoint, ✕ deletes it. The active waypoint stays the same point when others move around it.
  - **Replace:** ⇄ marks a waypoint; the next point you pick in the search box, or with **Replace … with …** in the map menu, takes its place. Tap ⇄ again to cancel.
  - While Edit is on, tapping a row doesn't change the active waypoint. Tap **Done** to finish. Edits stay on the phone; the original GPX file isn't changed.
- **Save GPX:** downloads the plan as it is now, edits included, as a GPX route (`rte`/`rtept`, named like `YBRS-YMMB-2026-10-28.gpx`). Each point is named with its AIP code where it matched (YMMB, CARR), else its own name, with the description kept. It opens in OzRunways or AvPlan, or here again with **Import GPX**.
- **Auto-advance:** the active waypoint moves on, like a GNSS navigator, in any of these cases:
  - within 0.5 NM of it;
  - when you cross the turn bisector at it, within 5 NM, so passing a mile or two off track or cutting the corner still counts;
  - leaving the first point of the plan;
  - catch-up: after a GPS gap (screen locked, app closed), if you're clearly on a later leg (within 2 NM of it and tracking along it), it jumps there.

  A waypoint picked by hand with Prev, Next or a leg tap only sequences within 0.5 NM until you've flown 1 NM towards it. The active waypoint drives **Go to**.

  Checked against a real flight of the example route (27 Oct 2026, from its Flightradar24 track): all 13 points sequence, including YRSY and WAN passed about 3 NM abeam. YTYA, which was skipped, catches up once you're on the next leg.

  A second flight (28 Oct 2026: YBRS, through the Avalon zone and up the bay, Moorabbin, a landing near Lang Lang, Tyabb, YBRS) was replayed through the top tiles with `tools/fr24replay.js`. It found and fixed: the next-CTAF line pointing at Avalon "in 0.5 NM" while minor fields were on screen, NEXT CLASS giving Moorabbin 118.1 from the west, and "see ATIS" over the field.
- **Direct to:** with a plan loaded, choosing a Go to point yourself (search, a map tap, or Go to in the press-and-hold menu) works like a GNSS "direct to". Go to, the PLAN tile, the next-frequency lines and simulated flying all point at that point, and the plan is **paused**: waypoints don't sequence and the aerodrome card goes back to the closest aerodrome. The flight plan section shows "Direct to … Plan paused at 4/13 YMMB" with **Resume plan**, and the Go to bar has a **Resume plan** button in place of Clear. Resuming (or clearing Go to) goes back to the plan's next waypoint, and normal sequencing, including catch-up onto a later leg, takes it from there. Choosing a point that is in the plan (e.g. YLIL) instead makes it the next waypoint, with no pause. Prev, Next or tapping a leg also ends a direct-to; editing the plan doesn't. A direct-to is remembered across restarts.
- **Flight log:** the app keeps every GPS fix (one per 5 s, last 6 hours) and each waypoint change. **Flight log** downloads it as a GPX, to check what happened after a flight. Simulation isn't logged. It's stored on the phone in IndexedDB, one record per fix written as it happens, and **kept for 90 days**: **Options → Flight logs** lists each flight (fixes split at gaps over 30 min) with its date, time and length, and **GPX** downloads it. The map's **Log** layer and the **Flight log** button use the last 6 hours. (Older builds kept the log in localStorage; that copy moves across by itself.)
- **Aerodrome on screen:** with a plan loaded, the aerodrome card follows the plan instead of simply the closest:
  - the next aerodrome in the plan once you're within 10 NM, so the inbound or overflying call is ready at the CTAF call point
  - from 15 NM, when the active waypoint is one of that aerodrome's ERSA reporting points, so the tower inbound call is ready before you get there (e.g. ACE then YMMB)
  - the aerodrome you just left or overflew, out to 5 NM
  - otherwise the closest aerodrome. The header says which rule applied, and tapping an aerodrome in the list still pins it.
- **Map:** the route is drawn in purple with waypoint labels, and the active waypoint is filled in.
- **Simulation:** Fly steers along the route. Typing a track while flying takes over from the plan (fly that track); press Fly again to go back to following the plan. Track, ground speed and altitude apply as you type, with no Enter needed (a phone's number pad has none).
- **Storage:** the plan is saved on the phone until you remove it or import another.

## Navigation points
- **Sources:** VFR waypoints (about 1,080) come from ERSA VFR-GEN. Navaids (VOR, NDB, DME, TACAN) come from DAH Section 21, with frequencies from the ERSA aerodrome entries. IFR waypoints (about 7,900) come from DAH Section 22 and are used for search and simulation only.
- **Go to:** type a waypoint code, navaid ident, IFR waypoint or aerodrome code, or tap a point on the map. The bar shows bearing (°M), distance and an arrow, and the map draws a dotted line to it. It's remembered until you clear it. With a flight plan loaded, a Go to you pick yourself is a direct-to that pauses the plan (see Flight plan → Direct to).
- **Map:** at 20 NM and closer, VFR waypoints are drawn as purple VTC-style diamonds with their codes. Navaids are drawn as VOR hexagons (boxed for VOR/DME) and dotted NDB circles, with the frequency shown at 10 NM and closer.
- **Radio calls:**
  - Position reports start with "over <waypoint>" when you're within 1.5 NM of a VFR waypoint, e.g. "over Carrum, 5 miles south".
  - At tower aerodromes, the ERSA reporting points are shown as chips with full name, bearing and distance, nearest first. Tap a chip to go to it. The inbound call says "over Carrum" once you're within 3 NM of a reporting point.
- **Search:** typing in **Go to** (or the simulator's Position) shows a pick list as you type.
  - **What it searches:** aerodromes (ICAO or name), VFR waypoints, navaids, IFR waypoints, towns from the ABS urban centres and localities (e.g. "Ocean Grove - Barwon Heads" matches either name), and suburbs from the ABS suburbs and localities (shown with their state, e.g. "Belmont, Vic"; a suburb with the same name as a town within 5 NM is left out).
  - **Fuzzy matching:** prefix, any word, substring, small typos ("geelng", "belmomt"), names typed without spaces ("stkilda") and letters in order (not for suburbs: too many). Aerodromes and nearby places rank first.
  - **Each row** shows the type, name, and distance and bearing from you. Tap a row or press Enter to pick it; choosing an aerodrome also selects it as the aerodrome on screen.
  - **Ranking:** aerodromes, then VFR waypoints, navaids, towns, localities and suburbs; nearer places rank higher.
  - **Phonetic alphabet:** spelled codes are understood, typed or spoken: "yankee lima india lima" finds YLIL, "charlie alpha romeo romeo" CARR, "Y L I L" YLIL. A leading "go to" or "direct to" is ignored.
  - **Voice (mic button):** tap the mic beside Go to and say a place ("Moorabbin", "St Andrews") or spell a code. What you said goes into the box with the pick list open; tap the match to confirm.
    - **On the phone:** the app uses Chrome's speech recognition on the phone itself when it can. Chrome downloads its offline English pack once, while you have signal.
    - **Offline fallback:** where the browser can only recognise speech online and you have no signal, the app says so. Use the keyboard's mic instead; Gboard voice typing works offline on the Pixel.
- **Town names on the map:** urban centres at 20 NM range and below, localities at 10 NM and below, suburbs at 5 NM and below, placed clear of other labels. They're hidden while a chart is showing, since the chart names them.

## Terrain (SRTM)
The app uses SRTM terrain for three things:
- **Height above ground:** the ALT tile shows AGL under the GPS altitude.
- **AGL limits:** limits such as "700 AGL" are measured from the terrain at your position.
- **Map shading:** terrain at or above your altitude is red, and terrain within 500 ft below you is amber. The **Terrain** button under the map turns the shading (warnings included) off and on; AGL in the top bar and the elevation profile aren't affected.

The site carries terrain for all of Australia (914 tiles, about 11 MB); with signal the app downloads all of it in the background and keeps it for offline use.

Terrain is a 30 arc-second grid (about 900 m). Each cell holds the highest SRTM point inside it, so AGL errs low. It's for awareness, not terrain clearance.

### Update or add terrain (SRTM)
The tiles are built on your own computer (Python 3, standard library only, normal internet access) and published with the site in `app/terrain/`.

1. **Pick the area.** Tiles are 1°×1°, named by their south-west corner (`S38E144.bin.z`). Choose one of:
   ```
   fetch_srtm.bat --around=-38.15,144.36,300            (Windows: within 300 km of Geelong)
   python tools/fetch_srtm.py --bbox=-39.5,140.5,-33.5,150.5
   python tools/fetch_srtm.py --australia                (all Australian land, about 900 tiles)
   ```
   To extend the coverage, just run it again with the new area: tiles already built (and tiles found to be all sea) are skipped, and the new ones are added to the list in `app/terrain/index.json`.
2. **Source data:** by default it downloads SRTM 1 arc-second tiles from the public AWS Terrain Tiles bucket (about 10–25 MB each; only the small processed tiles, about 5–30 KB each, are kept). To use SRTM files you already have, add `--from-dir <folder>`; it accepts `.hgt`, `.hgt.gz` and `.hgt.zip` (e.g. NASA SRTMGL1 or SRTMGL3 from https://search.earthdata.nasa.gov, free Earthdata login).
3. **Rebuild a tile** (e.g. from a better source): delete that `app/terrain/<name>.bin.z` and run the script again for its area; it's rebuilt because the file is missing.
4. **Publish:** commit and push `app/terrain/` (the new tiles and `index.json`). Nothing else needs rebuilding: the app reads `terrain/index.json` at start-up.
5. **On the phone:** with signal, the app downloads every tile listed in `index.json` that it hasn't stored yet, in the background, and keeps them for offline use (the footer shows when it's ready to fly without signal). A tile that was rebuilt under the same name is **not** fetched again by a phone that already has it; clear the site's data (or reinstall the app) to pick it up.

Format, if you need it: each tile is zlib-compressed little-endian int16, 121×121 posts at 30 arc-seconds, row 0 at the north edge, each post the highest SRTM elevation (metres) around it.

## Radio call guide
Under CTAF, open **Radio calls**. Enter your aircraft type and callsign, and choose aeroplane or helicopter; all are saved on the device. Type the callsign as the registration (`EAN` or `VH-EAN`) and it's spelled in the phonetic alphabet ("ECHO ALPHA NOVEMBER"): a preview shows under the box while you type, and it expands in the box when you press Enter or leave it. VH- is dropped. Digits are spoken (9 = NINER). Anything with spaces (`POLAIR 31`), or one word of 5+ letters (`RESCUE`), is left as typed.
- **Non-towered aerodromes:** you get the standard CTAF calls from AIP ENR 1.1: inbound, overflying, joining, straight-in, taxiing, lining up and departing. Distance, compass point and level are filled in from your position.
- **Tower aerodromes:** the app reads the tower hours (TWR HR) from ERSA and works out whether the tower is open now, allowing for daylight saving.
  - When it's open, you get Class D calls: ATIS, taxi call to Ground, ready call, an inbound call naming the ERSA reporting points (e.g. CARR, BAW, BTO, ACE, SHOL or GMH at Moorabbin) at the CTR entry altitude, and the downwind report where ERSA requires it.
  - Outside tower hours it switches to CTAF calls. Where ERSA says plainly "Outside TWR HR airspace becomes Class G" (Moorabbin, Bankstown, Archerfield, Parafield, Jandakot, Camden and others), that Class D zone is shown as Class G while the tower is closed, with the ERSA sentence quoted. Reversions with conditions (Avalon to Class E, or altitude limits such as Albury, Gold Coast and Tamworth) stay as published.
  - Public holidays and NOTAM changes aren't included, so confirm on the ATIS. You can force Tower or CTAF.
- **Circuit direction:** right-hand circuits are flagged on the runway picker from ERSA, including "all circuits to the WEST" style notes (Lilydale: RWY 18 right, 36 left by day; the reverse at night).
- **Split tower frequencies:** where ERSA's procedure text ties a tower frequency to a side, the frequency is labelled with it. At Moorabbin, 118.1 is East because "DEP to the E call 118.1" and "ARR from E must call 118.1". 123.0 is West because "DEP to the W call 123.0" and "report at CARR on 123.0 … western circuit". The quoted ERSA text is shown under each frequency, and the inbound call suggests the side you're on (on the aerodrome, the side of your next flight plan waypoint). The ERSA COMM line and the VTC only say "TWR 118.1 / 123.0", so the ATIS has the final word.
- **Key values** from ERSA are shown as chips: CTR entry altitude, circuit altitude, helicopter altitude, reporting points.
- **ERSA local procedures:** the full text from ERSA (communications notes, local traffic regulations, flight procedures). With Helicopter selected, helicopter items are highlighted.

## AIRAC data sets
`app/data.json` is the AIRAC in force when the app was built. `app/data-next.json`, if present, is the next one. The loader picks whichever is in force on the phone's clock: AIRAC data takes effect at 1600 UTC the day before the nominated date (AIP GEN 3.1 4.3). Both are stored for offline use. If the change happens while the app is open, a banner offers a reload. Build each one with `build_data.py` (current → `tools/data.json`, next → `tools/data-next.json`), then run `assemble.py`.

## Files
`app/` holds:
- `index.html`: the page, plus a small loader with a loading screen
- `app.js`: the app code
- `data.json` / `data-next.json`: all ERSA, DAH, waypoint and variation data for the current and next AIRAC
- `urban.json`: ABS urban centres and localities (populous areas) and suburb names, shared by both
- `sw.js`: the service worker that stores everything for offline use
- `terrain/`: the SRTM tiles
- `charts/`: the VTC/VNC tiles and their index
- `lib/pdfjs/`: pdf.js, used only when importing a chart PDF on the phone
- `manifest.webmanifest`: install details, including the share target (POST `./share`, handled by the service worker) that takes a NAIPS briefing shared from another app as text or PDF

`tools/` holds the build scripts (see Refresh data each AIRAC), `geoid.py` and `egm96_au.json` (the EGM96 geoid grid used to turn GPS altitude into height above mean sea level), `playthrough.js` and `fr24replay.js` (replay a plan or a recorded track through the app), and `notam-worker/`, the Cloudflare Worker traffic proxy for NOTAMs and traffic with its own README.

The loader fetches `data.json`, then starts `app.js`. A data-only update changes just `data.json` (and the version tags in `index.html` and `sw.js`), so the phone picks it up the next time it has signal.

## NOTAMs
NOTAMs come only from a NAIPS briefing you load into the app (see **NAIPS briefings** below); there is no live NOTAM feed. The settings section is **NOTAMs (NAIPS) and traffic** at the bottom of the page.
- **Where they show:**
  - **CTAF and Go to tiles:** "YMMB · 2 NOTAM" when the aerodrome has active NOTAMs.
  - **Aerodrome card:** a NOTAMs box (open by itself when something is closed or unserviceable), with key words such as CLSD, U/S, RWY, FREQ, ACT and PJE highlighted. Times are UTC with local time in brackets; NOTAMs starting within 24 hours are shown faded.
  - **Map:** airspace and warning NOTAMs (restricted-area activations, parachuting, drone operations and similar) as dashed red circles from their Q line, labelled at 40 NM range and closer.
  - **Press and hold on the map:** the NOTAMs whose circle covers that point, and for a restricted or danger area, any NOTAM that names it (e.g. "R330A ACT").
  - **Flight plan:** NOTAMs along the route (within 1 NM of a leg) and for its aerodromes.
- **Restricted / danger area status:** from the loaded briefing each R, D and M area gets a status:
  - **ACTIVE** when a NOTAM activates it ("R352 PARTIAL ACT", "R360CEF ACT" = R360C, E and F), with the NOTAM's limits and end time. When the briefing lists it under "no current NOTAM", it's ACTIVE if ERSA says H24, or by its ERSA daily hours or HJ/HN.
  - **OFF** when a NOTAM deactivates it ("D342 DEACTIVATED"), or when the briefing lists it under "no current NOTAM" and ERSA says it is activated only by NOTAM.
  - A NOTAM's own schedule (HJ, HN, DAILY hhmm-hhmm) is applied, with sunrise and sunset worked out for the area. With no briefing, or once it has expired, there's no status and the app says "check status" as before.
  - **On the map:** active areas get a stronger fill and outline, with a short "ACT →1300Z" line under the label. Areas that are off are a thin grey dashed outline labelled "OFF".
  - **In the top bar:** the IN row leads with "ACTIVE NOTAM C4/26 →1300Z". An area you're in that is off shows greyed as "OFF no NOTAM". NEXT CLASS ignores an R area that will be off when you get there (by groundspeed). The CLASS tile ignores areas that are off.
  - **Aerodrome card and press-and-hold:** the same status with its reason.
- **Temporary zones:** a NOTAM that bounds an area with three or more coordinates (a temporary restricted area or an air display box) is drawn as a red dashed polygon labelled with the NOTAM and its limits. It's dimmer in the 3 hours before it starts. When you're inside it at its levels (or inside a NOTAM circle with limits, e.g. drone operations SFC to 700 ft AGL during its daily hours), it shows in the IN row. Obstacle lists and apron charts are left out.
- **NAIPS briefings:** set your **NAIPS areas** (e.g. 9300, up to five) and tap **Brief in NAIPS** to open an area briefing (NOTAMs, 12 h) in your browser, signed in as you; **NAIPS area page** just opens the form. The app only opens NAIPS and never reads it (NAIPS terms bar automated access). Bring the result back by copying it into **NAIPS briefing** (or **Paste from clipboard**), by sharing the text or a saved PDF to the installed app on Android, or with **Open PDF / file** (a briefing saved with the browser's Save as PDF / Print, or a .txt). The app reads each NOTAM (location, number, replaces, FROM/TO with year rollover, EST, schedules such as HJ or DAILY 1800-0700, and the listed active periods), the limits (SFC TO 400FT AGL, 4000FT AMSL TO FL210), and positions (WI 3NM RADIUS OF ARP, WI 500M RADIUS OF PSN …, PSN of obstacles). Restricted and danger area NOTAMs (R352 PARTIAL ACT, R360D ACT) are tied to the area. NOTAMs are marked NAIPS; the "no current NOTAM" list at the end shows as "none current" on those aerodromes' cards. The briefing is kept on the phone for offline use; after its validity time the app says to get a new one.
- **Status:** the section header shows how many briefing NOTAMs are active, or that the briefing has expired.
- **Limits:** the app only knows what was in the last briefing you loaded: **get a fresh NAIPS briefing before each flight**.

## Traffic (ADS-B)
The **Traffic** button above the map (next to Track up) shows ADS-B traffic from adsb.lol (adsb.fi as a fallback), fetched through a small proxy you run yourself (a free Cloudflare Worker, `tools/notam-worker`; the app uses `https://test.mission.workers.dev` unless you enter another under **Traffic proxy**, and an empty box turns it off) every 10 seconds while there's signal. It's the TCAS-style display chosen on 27 Oct:
- **Symbols:** grey hollow diamond = other traffic; cyan filled diamond = within 6 NM and ±1,200 ft; amber circle = within 2.5 NM and ±600 ft. The number is the height difference in hundreds of feet (+03 = 300 ft above), with ↑ or ↓ when it's climbing or descending more than 500 ft/min. Cyan and amber targets have a line showing where they'll be in a minute.
- **Direction:** every airborne target has a short stick pointing along its track; cyan and amber targets also have a line showing where they'll be in 1 minute.
- **Tap a target** to select it: a dashed ring and a box with its registration and callsign, type, altitude (and the difference from yours, with climb or descent), track °M and ground speed, and distance, bearing and clock position from you. It updates live; tap it again or anywhere else on the map to clear it.
- **Alert:** for the nearest amber target an amber **TRAFFIC** row appears under the top tiles, e.g. "11 o'clock 1.7 NM · 300 ft above · VH-VOZ C172", and the phone says "Traffic, 11 o'clock, 2 miles, 300 feet above" (once a minute per aircraft; switch it off with **Speak traffic alerts**).
- **Heights:** from the target's GNSS altitude converted to mean sea level with the geoid, so it compares with your GPS altitude; pressure altitude when there's no GNSS altitude.
- **You:** your own aircraft is left out by the registration matching the callsign in Radio calls (EAN → VH-EAN), or anything within 0.15 NM and 300 ft of you.
- **Freshness:** positions are moved on along their track to now (up to 30 s). The corner of the map shows "ADS-B 3 · 2 s"; after 30 s without an update it says "stale", the symbols fade and there are no alerts.
- **Limits:** internet ADS-B only shows aircraft transmitting ADS-B that a ground receiver hears, 5–10 s late, and coverage is patchy at low level. It is **not TCAS** and doesn't replace looking out or the radio.

## Install on your phone
The app is built for and tested on a **Google Pixel 9 Pro** (Chrome on Android); iPhones work too.

- **Pixel / Android:** open https://meee1.github.io/airspace_assist/app/ in Chrome and tap **Install app** (in the buttons under the map, or Chrome's ⋮ menu → Install app). Tap **Start GPS & compass** and allow location (keep **Precise** on). The installed app runs full screen and Android keeps its stored data.
- **iPhone:** open the same link in Safari, tap Start, then Share → Add to Home Screen.

**Tablets (8–10" Android):** the layout adapts to the screen.
- **Portrait** (700 px wide or more, most 10" tablets): bigger tile text, a larger map, and Go to, the simulator and the flight plan beside the aerodrome card instead of under it.
- **Landscape** (960 px wide or more): the map is fixed on the left at full height (58% of the width) and everything else scrolls on the right, with the top tiles kept at the top of that column.
- **8" tablets in portrait** (about 600 px) get the phone layout at full width. Turning the tablet re-lays it out straight away.

**Offline:** after one load with signal, everything runs without a connection:
- **What's stored:** the page, the app code (`app.js`, about 290 KB including the EGM96 geoid grid), the ERSA/DAH data (`data.json` and `data-next.json`, about 2 MB each), the urban areas and suburb names (`urban.json`, about 1.8 MB), all the SRTM terrain tiles (about 650 KB) and the VTC/VNC chart tiles (about 12 MB). Terrain and charts are stored straight away, not only for places you've visited.
- **Needs nothing online:** GPS, compass, the map, charts, search, the elevation profile and flight plans.
- **Check:** the footer says "Offline: app and AIP data stored, terrain 42/42 tiles — ready to fly without signal" once it's ready.
- **Updates:** they land the next time you open the app with signal. The app waits up to 3 seconds for the network, then starts from the stored copy, so a weak signal in flight doesn't hold it up.
- **Which version you have:** the footer starts with "App updated <date and time> (<how long ago>)", the time that version was built. If it's older than the last change you expect, close the app and open it again with signal.
- **Not stored:** there are no NOTAMs or live weather, and there never were. Fonts fall back to the phone's own until they've been cached once.
- **Terrain area:** the tiles currently cover 36–42°S, 140–148°E. Run `fetch_srtm.bat` with a bigger area for more.
- **Compass in a cradle:** on Android the heading is worked out from the phone's full orientation, so it's right whether the phone lies flat (the top of the screen points ahead) or stands upright in a cradle (the back of the phone points ahead), in portrait or landscape. Compass alignment (above) takes out what's left of the cradle angle.
- **iPhone:** use the Home Screen app rather than a Safari tab. Safari can clear a website's stored data after a few weeks without visits. It's served by GitHub Pages from this repo's [`app/`](app/) folder. GPS needs HTTPS, so any other static HTTPS host works too.

**Keep screen on:** remembered between launches. The phone drops the lock whenever the app is hidden (screen off, app switch), so it's taken again when you come back, or on your next tap; the button says "Screen stays on" while it holds and "Screen on: tap to re-arm" if it has been lost. Where the Wake Lock API is missing or refused (older iPhones, and Home Screen apps before iOS 18.4) a tiny silent looping video keeps the screen awake instead.

## Refresh data each AIRAC
1. From the Airservices AIP page, download the current **complete ERSA** PDF and the **DAH** PDF into `data/aip/`.
   The ERSA also supplies the SUA tables (restricted and danger area status, hours, contacts), read by `tools/sua.py` during the build.
2. Optionally, download the XC Australia "All Classes" OpenAir file into `data/xcaustralia/`. It's only used where the AIP has nothing.
3. Run:
```
mkdir -p data && cd data
B=https://raw.githubusercontent.com/vatSys/australia-dataset/master
for f in Sectors Airspace Volumes ATIS; do curl -sSLo vs_$f.xml $B/$f.xml; done
O=https://raw.githubusercontent.com/davidmegginson/ourairports-data/main
curl -sSLo airports.csv $O/airports.csv; curl -sSLo airport-frequencies.csv $O/airport-frequencies.csv
cd ../tools && pip install pygeomag pillow pymupdf pyshp      # also needs pdftotext (poppler)
python3 build_data.py ../data data.json \
  --ersa ../data/aip/<ersa>.pdf --dah ../data/aip/DAH_<date>.pdf \
  --xc "../data/xcaustralia/<openair>.txt" \
  --urban ../data/abs/UCL_2021_AUST_GDA2020.shp --sal ../data/abs/SAL_2021_AUST_GDA2020.shp
python3 - <<'P'
from pygeomag import GeoMag; import json, datetime
g=GeoMag(); t=datetime.date.today().year+0.9
d=json.load(open('data.json'))
d['var']=dict(la0=-46,lo0=108,st=2,epoch=t,g=[[round(g.calculate(glat=la,glon=lo,alt=0,time=t).d,1) for lo in range(108,163,2)] for la in range(-46,-7,2)])
json.dump(d,open('data.json','w'),separators=(',',':'))
P
python3 assemble.py && cp dist/* ../app/
```
The app warns you when the AIP data isn't effective yet, or is more than two cycles old.

## Update or add VTC / VNC charts
The chart underlay is pre-rendered from the Airservices PDFs into JPEG tiles in `app/charts/`. Each sheet also needs a calibration entry in `tools/charts.json` (page size, file-name match, render scales, and for each map panel its georeference and clip outline). Run these on your own computer:
```
cd tools && pip install pymupdf pillow numpy scipy opencv-python matplotlib shapely
```

### A new edition of a sheet the app already has (Melbourne VTC / VNC)
1. Download the new PDFs from the Airservices AIP charts page (e.g. `Melbourne_VTC_<date>.pdf`, `Melbourne_VNC_<date>.pdf`). Keep the original file names: the edition date is read from them.
2. **Check the calibration still fits.** Airservices usually keeps the same layout between editions. Re-run the fit and compare it with the entry in `tools/charts.json`:
   ```
   python chartref.py ../data/charts/Melbourne_VTC_<date>.pdf --dah ../data/aip/DAH_<date>.pdf --data data.json \
          --sheet ML-VTC --name "Melbourne VTC" --kind VTC --match melbourne > /tmp/ml-vtc.json
   ```
   It prints, for each panel, the label matches, the airspace misfit (about 0.5 pt is normal) and which fit the app will use: the graticule (`rms` under ~20 m is good), the aerodrome symbols (median offset under ~20 m), or, for an inset with neither, the airspace similarity (about 45 m). If the page size, the panels or the numbers changed, replace that sheet's entry in `charts.json` with the new output (keep its `"sheet"` id).
3. **Render the tiles. Pass every chart in one run:** the script rewrites `app/charts/index.json` with only the sheets it was given and removes the folders of anything else (older editions included).
   ```
   python chartiles.py ../app/charts ../data/charts/Melbourne_VNC_<date>.pdf ../data/charts/Melbourne_VTC_<date>.pdf
   ```
   Output: `app/charts/<sheet>-<edition>/<level>/<i>_<j>.jpg` (512 px tiles at the `levels` scales, skipping tiles outside the panels) and `app/charts/index.json`.
4. **If `charts.json` changed**, rebuild the app so it carries the new calibration: `python3 assemble.py && cp dist/* ../app/`.
5. **Publish** on or after the edition's effective date (a brand-new sheet appears in each phone's **Options** as NEW and unticked; Melbourne editions replace the old ones for everyone who has them ticked): commit and push `app/charts/` (and `tools/charts.json` and the rebuilt `app/` files if they changed). Phones download the new edition's tiles in the background the next time the app opens with signal; until then they keep using what they have stored.

Without publishing, a pilot can also import a newer PDF on the phone (**Chart underlay → Import VTC/VNC PDF**). It uses the same calibration, so this only works while the layout is unchanged.

### A sheet the app doesn't have yet (e.g. another VTC)
1. **Calibrate it:**
   ```
   python chartref.py ../data/charts/Sydney_VTC_<date>.pdf --dah ../data/aip/DAH_<date>.pdf --data data.json \
          --sheet SY-VTC --name "Sydney VTC" --kind VTC --match sydney > /tmp/sy-vtc.json
   ```
   - `--sheet` is a short unique id; `--match` is a word that must appear in the file name or PDF title; `--kind` is VTC or VNC (VNCs are drawn under VTCs).
   - The map panels are found from the chart's black neatlines. If one is missed (or an inset needs separating), give it with `--panel x0,y0,x1,y1` in PDF points (repeatable).
   - **Projection:** each sheet gets its own Lambert conformal conic centred on what it covers (`"proj"` in `charts.json`), fitted in two passes; `--proj lat1,lat2,lat0,lon0` overrides it.
   - **Locating:** place names printed on the chart are matched to ERSA VFR waypoints and aerodromes and ABS towns/suburbs (some charts embed shifted font codes; those are decoded), refined on the printed controlled-airspace lines, then fitted to the printed graticule. Where the graticule isn't usable (or disagrees with the aerodrome symbols, or is a whole 10′ step out against the airspace lines), the purple aerodrome symbols are fitted to their ERSA positions instead. A chart with no readable text (Horn Island) needs `--near lat,lon` (use `--near=-10.59,142.29` form for negative numbers).
   - **Checks:** the fit must be conformal (x and y scale within 2 %); panels that can't be located are dropped with a message. Look at the result with a few aerodromes before publishing.
2. **Add the printed JSON object to the array in `tools/charts.json`.** Add `"default": true` only if every new install should download it; otherwise pilots tick it in **Options**.
3. **Check it lines up:** run `python3 assemble.py`, serve `dist/` (`cd dist && python3 -m http.server 8811`), import the PDF in **Chart underlay**, and compare aerodrome symbols, the coast and the graticule with the app's own aerodromes and airspace at a few places across the sheet.
4. **Render and publish** as for a new edition (step 3 onwards), passing all the sheets the site should have, old and new, in the one `chartiles.py` run.

**Legends and margins:** each panel's `clip` in `charts.json` is the chart's map frame, so legends, title strips and margins never cover the map. For the VNCs that is the neatline: the left legend column (where there is one) and the bottom title strip are left out.

**Rotated sheets:** the Tamworth VTC PDF is stored landscape with a 90° page rotation. The tiles are the page as displayed (portrait), so its fit and clip are in that same rotated space.

**Note on projection:** sheets with a `"proj"` entry use their own Lambert conformal conic (`lccFwdP` in `tools/template.html`, matching `LCC` in `tools/chartref.py`); the two Melbourne sheets have none and use the original Victorian one (standard parallels 36°S and 39°S, origin 37°48′S 145°E).

**Copyright:** the charts are Airservices copyright; publishing the tiles on this site is the owner's decision.

## Charted CTAFs
Some aerodromes have no CTAF in ERSA (they're in its runway index only, or not at all) but the VTC/VNC prints one in a label box. The chart text is vector outlines, so `tools/chartctaf.py` reads it with Tesseract OCR:
1. `python tools/chartctaf.py scan data/aip` OCRs every purple label box, then the whole sheet for the word CTAF, about 3 min per sheet (needs `tesseract`, `pytesseract`, `pymupdf`).
2. `python tools/chartctaf.py match` turns each label into lat/lon with the sheet's fit in `charts.json` and matches the name to aerodromes within 10 NM. It prints each one with its ERSA CTAF, if any, as a check on the OCR. On the 26 NOV 2026 sheets every ERSA aerodrome agreed except one OCR misread.
3. `python tools/chartctaf.py review data/aip` draws the chart round each aerodrome without an ERSA CTAF into `tools/chartctaf_work/review.png`. Read each frequency off the image and put the confirmed ones in `tools/chart_ctaf.json`; nothing goes into the app straight from the OCR.
4. `python tools/assemble.py` adds them to the aerodromes (only where ERSA has no CTAF).

The OCR doesn't find every label, so an aerodrome missing from the list may still have a charted CTAF: check the chart. Sheets in the north (Brisbane, Bundaberg, Cairns, Darwin VNCs; Cairns, Horn Island VTCs) had none. Redo this when new chart editions come out.

## Data sources and limits
The AIP always comes first. Every value in the app carries a source tag: green for AIP (ERSA, DAH, AIP rule), orange for anything else.
1. **ERSA:** aerodromes, positions and elevations, CTAF, ATIS, AWIS, tower, ground, delivery, approach, departures and UNICOM, plus the area frequency listed for each aerodrome. It also names the controlling unit for each control zone and CTA step.
2. **DAH:** all airspace (C, D, E, A, control zones, restricted and danger areas) with step limits, area (FIA) frequency boundaries, class E frequency boundaries and broadcast areas. Arcs and circles are computed from the published centres and radii. Boundaries that follow a coastline, river or road are drawn as straight lines between the published points.
3. **Charted CTAF:** where ERSA has no CTAF but the VTC/VNC prints one beside the aerodrome ("Wooloomanata CTAF 118.8"), that frequency is used, tagged **VTC**, **VNC** or **VTC/VNC**, with the sheets named on the card. AIP ENR 1.1 9.1.6 makes it the CTAF for an aerodrome published on aeronautical charts. It also wins over a broadcast area, which the card then shows as the other frequency. There are 23 of these on the 26 NOV 2026 sheets, for example Wooloomanata and Rothwell 118.8, Rowsley 132.25, Sunbury East 121.6, Ceres 119.0, Callington 127.5, Luskintyre 122.65, Trafalgar Lane 118.7, and the Sydney hospital and harbour sites on 120.8. They come from `tools/chart_ctaf.json`; see "Charted CTAFs" below.
4. **AIP default:** any other aerodrome not in ERSA gets CTAF 126.7, or the broadcast-area frequency if it sits inside one.
5. **Fallbacks, tagged:** VATPAC names the controlling unit where ERSA has none, for example class A. OurAirports supplies strips that aren't in ERSA, and any frequency it disagrees on is shown as "OurAirports says …". XC Australia is only used if no DAH is loaded.
6. **NOTAMs and traffic:** NOTAMs only from a NAIPS briefing you load (Airservices); ADS-B traffic from adsb.lol (adsb.fi fallback) through the proxy. Both are for awareness: get a fresh NAIPS briefing before each flight, and keep looking out.
7. **Other data:** terrain is NASA SRTM, with the EGM96 geoid (NGA) for the altitude datum. Populous areas, towns and suburbs are the ABS Urban Centres and Localities and Suburbs and Localities 2021 (CC BY 4.0). The VTC/VNC charts are Airservices copyright.
- Where ERSA lists several approach frequencies for a TMA (Sydney, for example), the app picks one by sector and lists the others.
- GPS altitude is geometric (converted to height above mean sea level on Android), so near a step boundary go by the altimeter.
- This is not an authoritative source. Confirm against the current ERSA, charts and NOTAMs.
