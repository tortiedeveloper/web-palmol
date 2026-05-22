<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import mapboxgl from 'mapbox-gl';
    import type { Feature, FeatureCollection, Point, Polygon, LineString } from 'geojson';
    import type { Tree } from '$lib/types';

    export let accessToken: string;
    export let sickTrees: Tree[] = [];
    export let criticalZoneTrees: Tree[] = [];
    export let warningZoneTrees: Tree[] = [];
    export let selectedTree: { tree: Tree; source: { id: string } } | null = null;
    export let focusedSickTree: Tree | null = null;
    export let initialViewState = { longitude: 106.8456, latitude: -6.2088, zoom: 12 };

    let mapContainer: HTMLDivElement;
    let mapInstance: mapboxgl.Map | null = null;

    function haversineDist(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371e3;
        const toRad = (d: number) => d * Math.PI / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    interface CircleInput {
        center: [number, number];
        radius: number;
    }

    function mergeOverlappingCircles(circles: CircleInput[]): CircleInput[] {
        const merged: CircleInput[] = [];
        const used = new Set<number>();
        for (let i = 0; i < circles.length; i++) {
            if (used.has(i)) continue;
            const group: CircleInput[] = [circles[i]];
            used.add(i);
            let foundNew = true;
            while (foundNew) {
                foundNew = false;
                for (let j = 0; j < circles.length; j++) {
                    if (used.has(j)) continue;
                    for (const member of group) {
                        const d = haversineDist(
                            member.center[1], member.center[0],
                            circles[j].center[1], circles[j].center[0]
                        );
                        if (d <= member.radius + circles[j].radius) {
                            group.push(circles[j]);
                            used.add(j);
                            foundNew = true;
                            break;
                        }
                    }
                    if (foundNew) break;
                }
            }
            if (group.length === 1) {
                merged.push(group[0]);
            } else {
                let sumLat = 0, sumLng = 0;
                for (const c of group) { sumLat += c.center[1]; sumLng += c.center[0]; }
                const centroid: [number, number] = [sumLng / group.length, sumLat / group.length];
                let maxDist = 0;
                for (const c of group) {
                    const d = haversineDist(centroid[1], centroid[0], c.center[1], c.center[0]);
                    maxDist = Math.max(maxDist, d + c.radius);
                }
                merged.push({ center: centroid, radius: maxDist });
            }
        }
        return merged;
    }

    function createCircle(center: [number, number], radiusInMeters: number, points = 64): Polygon {
        const coords = { latitude: center[1], longitude: center[0] };
        const km = radiusInMeters / 1000;
        const ret: [number, number][] = [];
        const distanceX = km / (111.320 * Math.cos(coords.latitude * Math.PI / 180));
        const distanceY = km / 110.574;
        for (let i = 0; i < points; i++) {
            const theta = (i / points) * (2 * Math.PI);
            ret.push([coords.longitude + distanceX * Math.cos(theta), coords.latitude + distanceY * Math.sin(theta)]);
        }
        ret.push(ret[0]);
        return { type: 'Polygon', coordinates: [ret] };
    }

    function setupMap() {
        if (!mapContainer || mapInstance || !accessToken) return;
        mapboxgl.accessToken = accessToken;
        mapInstance = new mapboxgl.Map({
            container: mapContainer,
            style: 'mapbox://styles/mapbox/satellite-streets-v12',
            center: [initialViewState.longitude, initialViewState.latitude],
            zoom: initialViewState.zoom
        });
        mapInstance.addControl(new mapboxgl.NavigationControl(), 'top-right');
        mapInstance.on('load', updateMapLayers);
    }

    function updateMapLayers() {
        if (!mapInstance || !mapInstance.isStyleLoaded()) {
             setTimeout(updateMapLayers, 200);
             return;
        }

        const warningCircleInputs: CircleInput[] = [];
        const criticalCircleInputs: CircleInput[] = [];

        sickTrees.forEach(tree => {
            if (!tree.location) return;
            const center: [number, number] = [tree.location.longitude, tree.location.latitude];
            warningCircleInputs.push({ center, radius: 100 });
            criticalCircleInputs.push({ center, radius: 10 });
        });

        const mergedWarning = mergeOverlappingCircles(warningCircleInputs);
        const mergedCritical = mergeOverlappingCircles(criticalCircleInputs);

        const warningCircles: FeatureCollection<Polygon> = { type: 'FeatureCollection', features: [] };
        const criticalCircles: FeatureCollection<Polygon> = { type: 'FeatureCollection', features: [] };
        const sickTreePoints: FeatureCollection<Point> = { type: 'FeatureCollection', features: [] };
        const criticalPoints: FeatureCollection<Point> = { type: 'FeatureCollection', features: [] };
        const warningPoints: FeatureCollection<Point> = { type: 'FeatureCollection', features: [] };

        for (const wc of mergedWarning) {
            warningCircles.features.push({ type: 'Feature', geometry: createCircle(wc.center, wc.radius), properties: {} });
        }
        for (const cc of mergedCritical) {
            criticalCircles.features.push({ type: 'Feature', geometry: createCircle(cc.center, cc.radius), properties: {} });
        }

        sickTrees.forEach(tree => {
            if (!tree.location) return;
            sickTreePoints.features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [tree.location.longitude, tree.location.latitude] }, properties: { name: tree.name, id: tree.id } });
        });

        criticalZoneTrees.forEach(item => {
            if (!item.location) return;
            criticalPoints.features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [item.location.longitude, item.location.latitude] }, properties: { name: item.name, id: item.id } });
        });
        warningZoneTrees.forEach(item => {
             if (!item.location) return;
            warningPoints.features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [item.location.longitude, item.location.latitude] }, properties: { name: item.name, id: item.id } });
        });

        const layers = ['warning-fill', 'critical-fill', 'sick-points', 'critical-points', 'warning-points', 'threat-line'];
        const sources = ['warning-circles', 'critical-circles', 'sick-trees', 'critical-trees', 'warning-trees', 'threat-line-source'];
        layers.forEach(id => { if (mapInstance?.getLayer(id)) mapInstance.removeLayer(id); });
        sources.forEach(id => { if (mapInstance?.getSource(id)) mapInstance.removeSource(id); });

        mapInstance.addSource('warning-circles', { type: 'geojson', data: warningCircles });
        mapInstance.addSource('critical-circles', { type: 'geojson', data: criticalCircles });
        mapInstance.addSource('sick-trees', { type: 'geojson', data: sickTreePoints });
        mapInstance.addSource('critical-trees', { type: 'geojson', data: criticalPoints });
        mapInstance.addSource('warning-trees', { type: 'geojson', data: warningPoints });
        mapInstance.addSource('threat-line-source', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

        mapInstance.addLayer({ id: 'warning-fill', type: 'fill', source: 'warning-circles', paint: { 'fill-color': '#f1c40f', 'fill-opacity': 0.25 } });
        mapInstance.addLayer({ id: 'critical-fill', type: 'fill', source: 'critical-circles', paint: { 'fill-color': '#e74c3c', 'fill-opacity': 0.4 } });
        mapInstance.addLayer({ id: 'warning-points', type: 'circle', source: 'warning-trees', paint: { 'circle-radius': 5, 'circle-color': '#f1c40f', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5 }});
        mapInstance.addLayer({ id: 'critical-points', type: 'circle', source: 'critical-trees', paint: { 'circle-radius': 5, 'circle-color': '#e74c3c', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5 }});
        mapInstance.addLayer({ id: 'sick-points', type: 'circle', source: 'sick-trees', paint: { 'circle-radius': 7, 'circle-color': '#c0392b', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 }});
        mapInstance.addLayer({ id: 'threat-line', type: 'line', source: 'threat-line-source', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 2, 'line-dasharray': [2, 2] } });

        if (sickTrees.length > 0 && sickTrees[0].location) {
             mapInstance.flyTo({ center: [sickTrees[0].location.longitude, sickTrees[0].location.latitude], zoom: 18, duration: 1500 });
        }
    }
    
    $: if (mapInstance && selectedTree && selectedTree.tree.location) {
        const sourceSickTree = sickTrees.find(st => st.id === selectedTree.source.id);
        if (sourceSickTree?.location) {
            const healthyCoords: [number, number] = [selectedTree.tree.location.longitude, selectedTree.tree.location.latitude];
            const sickCoords: [number, number] = [sourceSickTree.location.longitude, sourceSickTree.location.latitude];
            
            const lineFeature: Feature<LineString> = { type: 'Feature', geometry: { type: 'LineString', coordinates: [healthyCoords, sickCoords] }, properties: {} };
            (mapInstance.getSource('threat-line-source') as mapboxgl.GeoJSONSource)?.setData({ type: 'FeatureCollection', features: [lineFeature] });

            const bounds = new mapboxgl.LngLatBounds(healthyCoords, sickCoords);
            mapInstance.fitBounds(bounds, { padding: 100, maxZoom: 18 });
        }
    } else if (mapInstance) {
         (mapInstance.getSource('threat-line-source') as mapboxgl.GeoJSONSource)?.setData({ type: 'FeatureCollection', features: [] });
    }

    // BLOK BARU: Reaktif untuk fokus ke hotspot yang dipilih
    $: if (mapInstance && focusedSickTree && focusedSickTree.location) {
        mapInstance.flyTo({
            center: [focusedSickTree.location.longitude, focusedSickTree.location.latitude],
            zoom: 18,
            essential: true
        });
    }

    onMount(setupMap);
    onDestroy(() => { mapInstance?.remove(); mapInstance = null; });
</script>

<div bind:this={mapContainer} style="width: 100%; height: 100%; min-height: 600px; border-radius: 8px;"></div>