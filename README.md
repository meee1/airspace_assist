# Radio Calls AU

**Open the app: https://meee1.github.io/airspace_assist/app/** (source: [`app/`](app/))

Phone web app: closest aerodrome, CTAF with a radio call guide, ATIS/AWIS, the area frequency for your position and altitude, and a small airspace map showing classes and CTA steps.

## Simulate locally (any lat/lng)
No GPS needed. The app loads its data from `app/data.json`, so it has to be served over http (opening `index.html` as a file won't work):

- Run `./simulate.sh -38.04,144.47 2500 270 90` (macOS/Linux) or `simulate.bat -38.04,144.47 2500 270 90` (Windows). The arguments are position, altitude in ft, track in °M and ground speed in kt. This serves the app on http://localhost:8765 and opens it.

The position field accepts:
- decimal degrees: `-38.04, 144.47` (a missing minus is assumed south)
- DMS: `38 02 22S 144 28 10E`
- packed degrees and minutes: `3802.4S 14428.2E`
- an aerodrome code: `YMAV`
- a VFR waypoint (`CARR`), navaid ident (`AV`) or IFR waypoint, or a VFR waypoint name (`CARRUM`)

**Fly** moves the position along the track at the ground speed, so you can watch the frequencies change as you go. URL form: `index.html?sim=YBTH&alt=3000&trk=320&gs=90`.

## Area frequency and altitude
The area frequency depends on altitude. The app builds the airspace stack above your position from the DAH steps. Class G uses the area (FIA) frequency, class E uses the E frequency boundary, and C and D use the controlling unit. Your current band is highlighted. At Avalon, for example, it lists SFC–A025 D Avalon Tower 120.1, then A025–A045 E Avalon 133.55, then A045+ C Melbourne Approach 132.0. GPS altitude is geometric, not pressure altitude, so near a band boundary go by the altimeter and the chart.

## Airspace map
The map sits under the frequencies. Use − and + to zoom (2.5 to 80 NM) and the button to switch between track up and north up.
- Lines follow chart conventions: C solid blue, D and CTR dashed blue, E violet, restricted areas red, danger areas dashed orange.
- Each step is labelled chart-style: class, then upper over lower limit.
- Area frequency boundaries are dotted green, with the frequency inside each area.
- The airspace you're in at your altitude is shaded.
- **CTAF layer:** the CTAF button turns it on and off.
  - Each aerodrome gets a 10 NM area (the AIP CTAF call distance), along with any DAH broadcast areas.
  - Areas on the same frequency merge into one translucent shape with one outline and one colour.
  - Frequencies in view never share a colour. The AIP default 126.7 is drawn in neutral grey so specific CTAFs stand out.
  - The legend lists the frequencies in view, and each aerodrome's frequency is printed beside it.
- **Runways:** at 5 NM and closer, runways are drawn on the map; at 2.5 NM they're labelled with their designators.
- The map only shows airspace starting below FL125, or below 5,000 ft above you, so the high-level steps don't clutter it.
- **Labels:** each airspace label sits wholly inside its own area. Controlled-airspace labels also avoid any part with lower controlled airspace, so a "C A045" label doesn't land inside the A025 step or a control zone. If a step has no room on screen, its label is left off.
- **Chart underlay (VTC/VNC):** the Melbourne VNC and the Melbourne VTC (main map and Melbourne Basin inset) are shown under the map by default, with the VTC drawn above the VNC.
  - **Download:** they come with the app as pre-rendered tiles in `app/charts/` (about 12 MB, built by `tools/chartiles.py`). They download in the background the first time the app opens with signal and are then stored for offline use; the footer counts the stored tiles.
  - **Controls:** the **Charts** button turns the underlay on and off. The **Chart underlay** section below the map has an opacity slider.
  - **Newer edition:** you can import an Airservices PDF on the phone (rendered there with pdf.js in `app/lib/pdfjs`). An imported chart replaces the built-in one for that sheet until you remove it.
  - **Georeferencing:** by fitting each chart's printed controlled-airspace boundaries to the DAH (`tools/chartref.py`), with a median misfit of about 45 m on the VTC and 90 m on the VNC. Waypoints, airspace and frequencies drawn on top still come from the AIP data.
  - **Terrain:** with a chart showing, the grey terrain relief is hidden, but the red and amber terrain warnings stay.
  - **Copyright:** the charts are Airservices copyright. Publishing the tiles on this site is the owner's decision.
- **Pan:** drag the map to look around. While panned it shows north up and stays put as you move; tap **◎ Centre** to go back to your position. A tap without dragging still picks a waypoint or aerodrome for Go to.

## Runways and aerodrome diagram
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
- **PLAN in the top bar:** the magnetic bearing to the active waypoint (or the Go to point when there's no plan), with the waypoint name and the turn from your current track (L/R in degrees; orange at 10° or more). No wind correction, so it's the planned track rather than a heading to steer.
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
- **Leg list:** each leg's course and distance. Tap a leg to make it active; Prev, Next, Reverse and Remove are below the list.
- **Auto-advance:** the next waypoint moves on within 0.5 NM or once you've passed it, and it drives **Go to**.
- **Aerodrome on screen:** with a plan loaded, the aerodrome card follows the plan instead of simply the closest:
  - the next aerodrome in the plan once you're within 10 NM, so the inbound or overflying call is ready at the CTAF call point
  - from 15 NM, when the active waypoint is one of that aerodrome's ERSA reporting points, so the tower inbound call is ready before you get there (e.g. ACE then YMMB)
  - the aerodrome you just left or overflew, out to 5 NM
  - otherwise the closest aerodrome. The header says which rule applied, and tapping an aerodrome in the list still pins it.
- **Map:** the route is drawn in purple with waypoint labels, and the active waypoint is filled in.
- **Simulation:** Fly steers along the route.
- **Storage:** the plan is saved on the phone until you remove it or import another.

## Navigation points
- **Sources:** VFR waypoints (about 1,080) come from ERSA VFR-GEN. Navaids (VOR, NDB, DME, TACAN) come from DAH Section 21, with frequencies from the ERSA aerodrome entries. IFR waypoints (about 7,900) come from DAH Section 22 and are used for search and simulation only.
- **Go to:** type a waypoint code, navaid ident, IFR waypoint or aerodrome code, or tap a point on the map. The bar shows bearing (°M), distance and an arrow, and the map draws a dotted line to it. It's remembered until you clear it.
- **Map:** at 20 NM and closer, VFR waypoints are drawn as purple VTC-style diamonds with their codes. Navaids are drawn as VOR hexagons (boxed for VOR/DME) and dotted NDB circles, with the frequency shown at 10 NM and closer.
- **Radio calls:**
  - Position reports start with "over <waypoint>" when you're within 1.5 NM of a VFR waypoint, e.g. "over Carrum, 5 miles south".
  - At tower aerodromes, the ERSA reporting points are shown as chips with full name, bearing and distance, nearest first. Tap a chip to go to it. The inbound call says "over Carrum" once you're within 3 NM of a reporting point.

## Terrain (SRTM)
The app uses SRTM terrain for three things:
- **Height above ground:** the ALT tile shows AGL under the GPS altitude.
- **AGL limits:** limits such as "700 AGL" are measured from the terrain at your position.
- **Map shading:** terrain at or above your altitude is red, and terrain within 500 ft below you is amber.

Terrain is a 30 arc-second grid (about 900 m). Each cell holds the highest SRTM point inside it, so AGL errs low. It's for awareness, not terrain clearance.

Build the tiles on your own computer:
```
fetch_srtm.bat --around=-38.15,144.36,300      (Windows; tiles within 300 km of Geelong)
python tools/fetch_srtm.py --bbox=-39.5,140.5,-33.5,150.5
python tools/fetch_srtm.py --australia            (about 900 tiles)
```
- **Downloads:** by default it downloads SRTM 1 arc-second tiles from the public AWS Terrain Tiles bucket, about 10–25 MB each. Only the small processed tiles are kept, about 5–30 KB each, in `app/terrain/`.
- **Local files:** to use SRTM files you already have instead, add `--from-dir <folder>`. It accepts `.hgt`, `.hgt.gz` and `.hgt.zip`, such as NASA SRTMGL1 or SRTMGL3 from Earthdata.
- **Resuming:** re-running skips tiles already built.
- **On the phone:** tiles load as you move. The 5×5° around you is pre-loaded and kept for offline use.

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
- `index.html`: the page, plus a small loader
- `app.js`: the app code
- `data.json` / `data-next.json`: all ERSA, DAH, waypoint and variation data for the current and next AIRAC
- `urban.json`: ABS urban centres and localities (populous areas), shared by both
- `sw.js`: the service worker that stores everything for offline use
- `terrain/`: the SRTM tiles

The loader fetches `data.json`, then starts `app.js`. A data-only update changes just `data.json` (and the version tags in `index.html` and `sw.js`), so the phone picks it up the next time it has signal.

## Install on your phone
Open https://meee1.github.io/airspace_assist/app/ on your phone, tap Start, then Add to Home Screen.

**Offline:** after one load with signal, everything runs without a connection:
- **What's stored:** the page, the app code (`app.js`), the ERSA/DAH data (`data.json`, about 2 MB), and all the SRTM terrain tiles (about 650 KB). The terrain is stored straight away, not only for places you've visited.
- **Needs nothing online:** GPS, compass, the map, the elevation profile and flight plans.
- **Check:** the footer says "Offline: app and AIP data stored, terrain 42/42 tiles — ready to fly without signal" once it's ready.
- **Updates:** they land the next time you open the app with signal. The app waits up to 3 seconds for the network, then starts from the stored copy, so a weak signal in flight doesn't hold it up.
- **Not stored:** there are no NOTAMs or live weather, and there never were. Fonts fall back to the phone's own until they've been cached once.
- **Terrain area:** the tiles currently cover 36–42°S, 140–148°E. Run `fetch_srtm.bat` with a bigger area for more.
- **iPhone:** use the Home Screen app rather than a Safari tab. Safari can clear a website's stored data after a few weeks without visits. It's served by GitHub Pages from this repo's [`app/`](app/) folder. GPS needs HTTPS, so any other static HTTPS host works too.

## Refresh data each AIRAC
1. From the Airservices AIP page, download the current **complete ERSA** PDF and the **DAH** PDF into `data/aip/`.
2. Optionally, download the XC Australia "All Classes" OpenAir file into `data/xcaustralia/`. It's only used where the AIP has nothing.
3. Run:
```
mkdir -p data && cd data
B=https://raw.githubusercontent.com/vatSys/australia-dataset/master
for f in Sectors Airspace Volumes ATIS; do curl -sSLo vs_$f.xml $B/$f.xml; done
O=https://raw.githubusercontent.com/davidmegginson/ourairports-data/main
curl -sSLo airports.csv $O/airports.csv; curl -sSLo airport-frequencies.csv $O/airport-frequencies.csv
cd ../tools && pip install pygeomag pillow pymupdf      # also needs pdftotext (poppler)
python3 build_data.py ../data data.json \
  --ersa ../data/aip/<ersa>.pdf --dah ../data/aip/DAH_<date>.pdf \
  --xc "../data/xcaustralia/<openair>.txt"
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

## Data sources and limits
The AIP always comes first. Every value in the app carries a source tag: green for AIP (ERSA, DAH, AIP rule), orange for anything else.
1. **ERSA:** aerodromes, positions and elevations, CTAF, ATIS, AWIS, tower, ground, delivery, approach, departures and UNICOM, plus the area frequency listed for each aerodrome. It also names the controlling unit for each control zone and CTA step.
2. **DAH:** all airspace (C, D, E, A, control zones, restricted and danger areas) with step limits, area (FIA) frequency boundaries, class E frequency boundaries and broadcast areas. Arcs and circles are computed from the published centres and radii. Boundaries that follow a coastline, river or road are drawn as straight lines between the published points.
3. **AIP default:** an aerodrome not in ERSA gets CTAF 126.7, or the broadcast-area frequency if it sits inside one.
4. **Fallbacks, tagged:** VATPAC names the controlling unit where ERSA has none, for example class A. OurAirports supplies strips that aren't in ERSA, and any frequency it disagrees on is shown as "OurAirports says …". XC Australia is only used if no DAH is loaded.
- Where ERSA lists several approach frequencies for a TMA (Sydney, for example), the app picks one by sector and lists the others.
- GPS altitude is geometric, so near a step boundary go by the altimeter.
- This is not an authoritative source. Confirm against the current ERSA, charts and NOTAMs.
