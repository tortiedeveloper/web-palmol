<script lang="ts">
    import { onMount, onDestroy, afterUpdate, tick } from 'svelte';
    import mapboxgl from 'mapbox-gl';
    import type { FeatureCollection, Point, Feature as GeoJsonFeatureType } from 'geojson';
    import type { TreeGeoJSONProperties, FruitCounts } from '$lib/types';
    import { Modal, ModalBody, ModalHeader, Button } from "@sveltestrap/sveltestrap";
    import Icon from '@iconify/svelte';

    export let accessToken: string;
    export let treeDataGeoJSON: FeatureCollection<Point, TreeGeoJSONProperties> | null = null;
    export let initialViewState = {
        longitude: 106.8456, 
        latitude: -6.2088,
        zoom: 10, 
    };

    let mapContainer: HTMLDivElement;
    let mapInstance: mapboxgl.Map | null = null;

    let isImageModalOpen = false;
    let currentModalImageUrl = '';
    let currentModalImageTitle = '';

    function toggleImageModal() {
        isImageModalOpen = !isImageModalOpen;
    }

    async function openImageModal(imageUrl: string, title: string) {
        currentModalImageUrl = imageUrl;
        currentModalImageTitle = title || "Foto Pohon";
        isImageModalOpen = true;
        await tick();
    }
    
    const ripenessMarkerColors = {
        terlaluMatang: '#E74C3C', 
        matang: '#2ECC40',         
        belumMatang: '#F1C40F',    
        tidakAdaBuah: '#AAAAAA',  
    };

    function setupMap() {
        if (!mapContainer || mapInstance) return;
        if (!accessToken) {
            console.error('Mapbox access token is required!');
            return;
        }
        mapboxgl.accessToken = accessToken;
        mapInstance = new mapboxgl.Map({
            container: mapContainer,
            style: 'mapbox://styles/mapbox/satellite-streets-v12',
            center: [initialViewState.longitude, initialViewState.latitude],
            zoom: initialViewState.zoom,
        });
        mapInstance.addControl(new mapboxgl.NavigationControl(), 'top-right');
        mapInstance.addControl(new mapboxgl.FullscreenControl(), 'top-right');
        mapInstance.addControl(new mapboxgl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: true, showUserHeading: true
        }), 'top-right');
        mapInstance.on('load', () => {
            if (treeDataGeoJSON && mapInstance) {
                updateMapData(treeDataGeoJSON);
            }
        });
    }

    function updateMapData(data: FeatureCollection<Point, TreeGeoJSONProperties>) {
        if (!mapInstance || !mapInstance.isStyleLoaded()) {
            setTimeout(() => { if (mapInstance && data) updateMapData(data); }, 200);
            return;
        }
        const sourceId = 'treesRipeness'; 
        if (mapInstance.getSource(sourceId)) {
            if (mapInstance.getLayer('unclustered-point-ripeness')) mapInstance.removeLayer('unclustered-point-ripeness');
            if (mapInstance.getLayer('cluster-count-ripeness')) mapInstance.removeLayer('cluster-count-ripeness');
            if (mapInstance.getLayer('clusters-ripeness')) mapInstance.removeLayer('clusters-ripeness');
            mapInstance.removeSource(sourceId);
        }
        mapInstance.addSource(sourceId, { type: 'geojson', data: data, cluster: true, clusterMaxZoom: 14, clusterRadius: 50 });
        mapInstance.addLayer({ id: 'clusters-ripeness', type: 'circle', source: sourceId, filter: ['has', 'point_count'], paint: {
            'circle-color': ['step', ['get', 'point_count'], '#51bbd6', 10, '#f1f075', 30, '#f28cb1'],
            'circle-radius': ['step', ['get', 'point_count'], 15, 10, 20, 30, 25]
        }});
        mapInstance.addLayer({ id: 'cluster-count-ripeness', type: 'symbol', source: sourceId, filter: ['has', 'point_count'], layout: {
            'text-field': '{point_count_abbreviated}',
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'], 'text-size': 12
        }, paint: { "text-color": "#ffffff" }});
        mapInstance.addLayer({
            id: 'unclustered-point-ripeness', type: 'circle', source: sourceId, filter: ['!', ['has', 'point_count']],
            paint: {
                'circle-color': [
                    'case',
                    ['>', ['coalesce', ['get', 'terlaluMatang', ['get', 'fruitCounts']], 0], 0], ripenessMarkerColors.terlaluMatang,
                    ['>', ['coalesce', ['get', 'matang', ['get', 'fruitCounts']], 0], 0], ripenessMarkerColors.matang,
                    ['>', ['coalesce', ['get', 'belumMatang', ['get', 'fruitCounts']], 0], 0], ripenessMarkerColors.belumMatang,
                    ripenessMarkerColors.tidakAdaBuah
                ],
                'circle-radius': 7, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#ffffff'
            }
        });

        mapInstance.on('click', 'unclustered-point-ripeness', (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
            if (!e.features || e.features.length === 0 || !mapInstance) return;
            const clickedFeature = e.features[0];
            if (!clickedFeature.geometry || clickedFeature.geometry.type !== 'Point' || !clickedFeature.properties) return;
            
            const rawProperties = clickedFeature.properties;
            const geometry = clickedFeature.geometry;
            const coordinates = geometry.coordinates.slice(); 
            
            const popupContentContainer = document.createElement('div');
            popupContentContainer.style.maxWidth = '250px';
            popupContentContainer.style.fontSize = '0.85rem';

            let baseHTML = `<strong>${rawProperties.name || 'Detail Pohon'}</strong>`;
            
            let fc: FruitCounts | undefined | null = undefined;
            if (typeof rawProperties.fruitCounts === 'string') {
                try {
                    fc = JSON.parse(rawProperties.fruitCounts) as FruitCounts;
                } catch (parseError) {
                    console.error("Error parsing fruitCounts JSON string:", parseError, rawProperties.fruitCounts);
                    fc = { matang: 0, belumMatang: 0, terlaluMatang: 0 };
                }
            } else if (typeof rawProperties.fruitCounts === 'object' && rawProperties.fruitCounts !== null) {
                fc = rawProperties.fruitCounts as FruitCounts;
            }

            if (fc) {
                baseHTML += `<br>Matang: <strong style="color:${ripenessMarkerColors.matang};">${typeof fc.matang === 'number' ? fc.matang : 0}</strong>`;
                baseHTML += `<br>Belum Matang: <strong style="color:${ripenessMarkerColors.belumMatang};">${typeof fc.belumMatang === 'number' ? fc.belumMatang : 0}</strong>`;
                baseHTML += `<br>Terlalu Matang: <strong style="color:${ripenessMarkerColors.terlaluMatang};">${typeof fc.terlaluMatang === 'number' ? fc.terlaluMatang : 0}</strong>`;
            } else {
                baseHTML += `<br>Data buah tidak tersedia.`;
            }

            if (rawProperties.description) {
                baseHTML += `<br><small>Deskripsi: ${rawProperties.description.substring(0,100)}${rawProperties.description.length > 100 ? '...' : ''}</small>`;
            }
            popupContentContainer.innerHTML = baseHTML;
            
            if (rawProperties.img) {
                const viewImageButton = document.createElement('button');
                viewImageButton.type = 'button';
                viewImageButton.className = 'btn btn-sm btn-link p-0 mt-1';
                viewImageButton.style.fontSize = '0.8rem';
                viewImageButton.style.textDecoration = 'none';
                viewImageButton.style.cursor = 'pointer';
                viewImageButton.innerHTML = `<span style="vertical-align: middle; margin-right: 4px;">🖼️</span>Lihat Foto`;
                viewImageButton.onclick = (clickEvent) => {
                    clickEvent.stopPropagation();
                    openImageModal(rawProperties.img!, rawProperties.name || 'Foto Pohon');
                };
                popupContentContainer.appendChild(document.createElement('br'));
                popupContentContainer.appendChild(viewImageButton);
            }
            
            while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) { coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360; }

            new mapboxgl.Popup({ closeButton: true, closeOnClick: true, maxWidth: '280px' })
                .setLngLat(coordinates as [number, number])
                .setDOMContent(popupContentContainer)
                .addTo(mapInstance);
        });

        mapInstance.on('click', 'clusters-ripeness', (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
            if (!e.features || e.features.length === 0 || !mapInstance) return;
            const firstFeature = e.features[0];
            if (!firstFeature.properties || !firstFeature.geometry || firstFeature.geometry.type !== 'Point') return;
            const clusterId = firstFeature.properties!.cluster_id;
            const source = mapInstance.getSource(sourceId) as mapboxgl.GeoJSONSource;
            source.getClusterExpansionZoom(clusterId, (err, zoomValue) => {
                if (err || !mapInstance || zoomValue == null) return;
                const geometry = firstFeature.geometry as Point;
                mapInstance.easeTo({ center: geometry.coordinates as [number, number], zoom: zoomValue });
            });
        });
        mapInstance.on('mouseenter', 'clusters-ripeness', () => { if(mapInstance) mapInstance.getCanvas().style.cursor = 'pointer'; });
        mapInstance.on('mouseleave', 'clusters-ripeness', () => { if(mapInstance) mapInstance.getCanvas().style.cursor = ''; });
        mapInstance.on('mouseenter', 'unclustered-point-ripeness', () => { if(mapInstance) mapInstance.getCanvas().style.cursor = 'pointer'; });
        mapInstance.on('mouseleave', 'unclustered-point-ripeness', () => { if(mapInstance) mapInstance.getCanvas().style.cursor = ''; });
    }
    
    onMount(() => { setupMap(); });
    onDestroy(() => { mapInstance?.remove(); mapInstance = null; });
    afterUpdate(() => {
        if (!mapInstance && mapContainer) {
            setupMap();
        }
        if (mapInstance && mapInstance.isStyleLoaded() && treeDataGeoJSON) {
            const source = mapInstance.getSource('treesRipeness') as mapboxgl.GeoJSONSource;
            if (source) {
                source.setData(treeDataGeoJSON);
            } else {
                updateMapData(treeDataGeoJSON);
            }
        }
    });
</script>

<div bind:this={mapContainer} style="width: 100%; height: 450px; border-radius: 8px;"></div>

<Modal bind:isOpen={isImageModalOpen} toggle={toggleImageModal} size="lg" centered scrollable>
    <ModalHeader toggle={toggleImageModal}>{currentModalImageTitle || 'Foto Pohon'}</ModalHeader>
    <ModalBody class="text-center">
        {#if currentModalImageUrl}
            <img src={currentModalImageUrl} alt={currentModalImageTitle || 'Foto Detail Pohon'} class="img-fluid" style="max-height: 75vh; border-radius: 0.25rem;" />
            {#if currentModalImageTitle && currentModalImageTitle !== 'Foto Pohon'}
            <p class="mt-2"><small>{currentModalImageTitle}</small></p>
            {/if}
        {:else}
            <p>Gambar tidak tersedia.</p>
        {/if}
    </ModalBody>
    <div class="modal-footer">
        <Button color="secondary" outline on:click={toggleImageModal}>Tutup</Button>
    </div>
</Modal>