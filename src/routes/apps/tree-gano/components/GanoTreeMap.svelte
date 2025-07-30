<script lang="ts">
	import { onMount, onDestroy, afterUpdate } from 'svelte';
	import mapboxgl from 'mapbox-gl';
	import type { FeatureCollection, Point } from 'geojson';
	import type { Tree, TreeGeoJSONProperties } from '$lib/types';

	export let accessToken: string;
	export let treeDataGeoJSON: FeatureCollection<Point, TreeGeoJSONProperties> | null = null;
	export let initialViewState = {
		longitude: 106.8456,
		latitude: -6.2088,
		zoom: 12
	};
	// PROPERTI BARU untuk menerima pohon yang harus di-fokus
	export let focusedTree: Tree | null = null;

	let mapInstance: mapboxgl.Map | null = null;
	let mapContainer: HTMLDivElement;
	
	const statusColors: Record<string, string> = {
		sick: '#FF4136',
		recovered: '#2ECC40',
		maintenance: '#FFDC00',
		default: '#AAAAAA'
	};

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

		mapInstance.on('load', () => {
			if (treeDataGeoJSON) {
				updateMapData(treeDataGeoJSON);
			}
		});
	}

	function updateMapData(data: FeatureCollection<Point, TreeGeoJSONProperties>) {
		if (!mapInstance || !mapInstance.isStyleLoaded()) {
			setTimeout(() => { if (mapInstance && data) updateMapData(data); }, 200);
			return;
		}

		const sourceId = 'gano-trees';
		if (mapInstance.getSource(sourceId)) {
			if (mapInstance.getLayer('clusters')) mapInstance.removeLayer('clusters');
			if (mapInstance.getLayer('cluster-count')) mapInstance.removeLayer('cluster-count');
			if (mapInstance.getLayer('unclustered-point')) mapInstance.removeLayer('unclustered-point');
			mapInstance.removeSource(sourceId);
		}

		mapInstance.addSource(sourceId, { type: 'geojson', data: data, cluster: true, clusterMaxZoom: 14, clusterRadius: 50 });
		mapInstance.addLayer({ id: 'clusters', type: 'circle', source: sourceId, filter: ['has', 'point_count'], paint: { 'circle-color': ['step', ['get', 'point_count'], '#51bbd6', 100, '#f1f075', 750, '#f28cb1'], 'circle-radius': ['step', ['get', 'point_count'], 20, 100, 30, 750, 40] }});
		mapInstance.addLayer({ id: 'cluster-count', type: 'symbol', source: sourceId, filter: ['has', 'point_count'], layout: { 'text-field': '{point_count_abbreviated}', 'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'], 'text-size': 12 }});
		mapInstance.addLayer({ id: 'unclustered-point', type: 'circle', source: sourceId, filter: ['!', ['has', 'point_count']], paint: { 'circle-color': [ 'match', ['get', 'last_status'], 'sick', statusColors['sick'], 'recovered', statusColors['recovered'], 'maintenance', statusColors['maintenance'], statusColors['default'] ], 'circle-radius': 6, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#ffffff' }});
		
        mapInstance.on('click', 'unclustered-point', (e) => {
			if (!e.features || e.features.length === 0 || !e.features[0].properties || e.features[0].geometry.type !== 'Point') return;
			const coordinates = e.features[0].geometry.coordinates.slice();
			const props = e.features[0].properties;
			new mapboxgl.Popup().setLngLat(coordinates as [number, number]).setHTML(`<strong>${props.name}</strong>`).addTo(mapInstance!);
		});

        mapInstance.on('mouseenter', ['clusters', 'unclustered-point'], () => { if(mapInstance) mapInstance.getCanvas().style.cursor = 'pointer'; });
		mapInstance.on('mouseleave', ['clusters', 'unclustered-point'], () => { if(mapInstance) mapInstance.getCanvas().style.cursor = ''; });
	}

	onMount(setupMap);
	onDestroy(() => { mapInstance?.remove(); mapInstance = null; });
	afterUpdate(() => {
		if (mapInstance && mapInstance.isStyleLoaded() && treeDataGeoJSON) {
			const source = mapInstance.getSource('gano-trees') as mapboxgl.GeoJSONSource;
			if (source) { source.setData(treeDataGeoJSON); } else { updateMapData(treeDataGeoJSON); }
		}
	});

    // BLOK REAKTIF BARU: Ini akan otomatis berjalan saat `focusedTree` berubah
    $: if (mapInstance && focusedTree && focusedTree.location) {
        mapInstance.flyTo({
            center: [focusedTree.location.longitude, focusedTree.location.latitude],
            zoom: 18, // Zoom lebih dekat
            essential: true
        });
    }

</script>

<div bind:this={mapContainer} style="width: 100%; height: 100%;"></div>