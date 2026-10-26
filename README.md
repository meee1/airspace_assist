# Radio Calls AU

**Open the app: https://meee1.github.io/airspace_assist/app/** (source: [`app/`](app/))

Phone web app: closest aerodrome, CTAF with a radio call guide, ATIS/AWIS, the area frequency for your position and altitude, and a small airspace map showing classes and CTA steps.

## Simulate locally (any lat/lng)
No GPS needed. Either:

- Open `app/index.html` directly in a desktop browser, tap **Simulate**, and type a position.
- Or run `./simulate.sh -38.04,144.47 2500 270 90` (macOS/Linux) or `simulate.bat -38.04,144.47 2500 270 90` (Windows). The arguments are position, altitude in ft, track in °M and ground speed in kt. This serves the app on http://localhost:8765 and opens it.

The position field accepts:
- decimal degrees: `-38.04, 144.47` (a missing minus is assumed south)
- DMS: `38 02 22S 144 28 10E`
- packed degrees and minutes: `3802.4S 14428.2E`
- an ICAO code: `YMAV`

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

## Runways and aerodrome diagram
The aerodrome card shows a small runway diagram and a runway list.
- **Diagram:** runways are drawn to scale and labelled with their designators. You appear as an arrow, or on the edge of the diagram with your distance when you're further out, so you can see which side you're joining from. It follows the main map's track-up or north-up setting.
- **List:** designator, length, surface and right-hand circuits, e.g. "17L/35R 1,341 m sealed 35R RH". Tap an RH tag for ERSA's conditions (Moorabbin's day and night circuit directions, for example). Other circuits are left-hand unless ERSA says otherwise.
- **Sources, AIP first:**
  - For 345 certified aerodromes, runway positions come from the DAH threshold table (Section 18).
  - For other aerodromes they're drawn from the ERSA bearing and length, or from the designator heading when ERSA gives no bearing. These are dashed and labelled "schematic".
  - Lengths, surface and width come from ERSA.
- **Radio calls:** a Runway picker lists that aerodrome's runways (RH marked), and the calls use the one you pick instead of "runway [XX]".

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
Under CTAF, open **Radio calls**. Enter your aircraft type and callsign, and choose aeroplane or helicopter; all are saved on the device.
- **Non-towered aerodromes:** you get the standard CTAF calls from AIP ENR 1.1: inbound, overflying, joining, straight-in, taxiing, lining up and departing. Distance, compass point and level are filled in from your position.
- **Tower aerodromes:** the app reads the tower hours (TWR HR) from ERSA and works out whether the tower is open now, allowing for daylight saving.
  - When it's open, you get Class D calls: ATIS, taxi call to Ground, ready call, an inbound call naming the ERSA reporting points (e.g. CARR, BAW, BTO, ACE, SHOL or GMH at Moorabbin) at the CTR entry altitude, and the downwind report where ERSA requires it.
  - Outside tower hours it switches to CTAF calls.
  - Public holidays and NOTAM changes aren't included, so confirm on the ATIS. You can force Tower or CTAF.
- **Split tower frequencies:** where ERSA's procedure text ties a tower frequency to a side, the frequency is labelled with it. At Moorabbin, 118.1 is East because "DEP to the E call 118.1" and "ARR from E must call 118.1". 123.0 is West because "DEP to the W call 123.0" and "report at CARR on 123.0 … western circuit". The quoted ERSA text is shown under each frequency, and the inbound call suggests the side you're on. The ERSA COMM line and the VTC only say "TWR 118.1 / 123.0", so the ATIS has the final word.
- **Key values** from ERSA are shown as chips: CTR entry altitude, circuit altitude, helicopter altitude, reporting points.
- **ERSA local procedures:** the full text from ERSA (communications notes, local traffic regulations, flight procedures). With Helicopter selected, helicopter items are highlighted.

## Install on your phone
Open https://meee1.github.io/airspace_assist/app/ on your phone, tap Start, then Add to Home Screen. After the first load it works offline. It's served by GitHub Pages from this repo's [`app/`](app/) folder. GPS needs HTTPS, so any other static HTTPS host works too.

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
