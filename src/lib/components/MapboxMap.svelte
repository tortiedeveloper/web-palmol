<script lang="ts">
    import { onMount, onDestroy, afterUpdate, tick } from 'svelte';
    import mapboxgl from 'mapbox-gl';
    import type { FeatureCollection, Point, Feature as GeoJsonFeatureType } from 'geojson';
    import type { TreeGeoJSONProperties } from '$lib/types';
    import { Modal, ModalBody, ModalHeader, Button } from "@sveltestrap/sveltestrap";
    import Icon from '@iconify/svelte';

    // ... (sisa kode <script> dari respons sebelumnya tetap sama) ...
    // Pastikan fungsi toggleImageModal dan openImageModal ada:
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

    const statusDisplayMap: Record<string, string> = {
        'sick': 'Terkena Ganoderma',
        'recovered': 'Sehat',
        'maintenance': 'Dalam Perawatan',
        'default': 'Status Tidak Diketahui'
    };

    function getDisplayStatus(status: string | undefined | null): string {
        if (!status) return statusDisplayMap.default;
        return statusDisplayMap[status.toLowerCase()] || status;
    }

    const statusColors: Record<string, string> = {
        'sick': '#FF4136', 'recovered': '#2ECC40', 'maintenance': '#FFDC00', 'default': '#AAAAAA'
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
        const sourceId = 'trees';
        if (mapInstance.getSource(sourceId)) {
            if (mapInstance.getLayer('unclustered-point')) mapInstance.removeLayer('unclustered-point');
            if (mapInstance.getLayer('cluster-count')) mapInstance.removeLayer('cluster-count');
            if (mapInstance.getLayer('clusters')) mapInstance.removeLayer('clusters');
            mapInstance.removeSource(sourceId);
        }
        mapInstance.addSource(sourceId, {
            type: 'geojson', data: data, cluster: true, clusterMaxZoom: 14, clusterRadius: 50,
        });
        mapInstance.addLayer({ id: 'clusters', type: 'circle', source: sourceId, filter: ['has', 'point_count'], paint: {
            'circle-color': ['step', ['get', 'point_count'], '#51bbd6', 10, '#f1f075', 30, '#f28cb1'],
            'circle-radius': ['step', ['get', 'point_count'], 15, 10, 20, 30, 25]
        }});
        mapInstance.addLayer({ id: 'cluster-count', type: 'symbol', source: sourceId, filter: ['has', 'point_count'], layout: {
            'text-field': '{point_count_abbreviated}',
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'], 'text-size': 12
        }, paint: { "text-color": "#ffffff" }});
        mapInstance.addLayer({ id: 'unclustered-point', type: 'circle', source: sourceId, filter: ['!', ['has', 'point_count']], paint: {
            'circle-color': ['match', ['get', 'last_status'], 'sick', statusColors['sick'], 'recovered', statusColors['recovered'], 'maintenance', statusColors['maintenance'], statusColors['default']],
            'circle-radius': 7, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#ffffff'
        }});

        mapInstance.on('click', 'unclustered-point', (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
            if (!e.features || e.features.length === 0 || !mapInstance) return;
            const clickedFeature = e.features[0];
            if (!clickedFeature.geometry || clickedFeature.geometry.type !== 'Point' || !clickedFeature.properties) return;
            const properties = clickedFeature.properties as TreeGeoJSONProperties;
            const geometry = clickedFeature.geometry;
            const coordinates = geometry.coordinates.slice();
            
            const popupContentContainer = document.createElement('div');
            popupContentContainer.style.maxWidth = '250px';
            popupContentContainer.style.fontSize = '0.85rem';

            let innerHTML = `<strong>${properties.name || 'Detail Pohon'}</strong><br>Status: ${getDisplayStatus(properties.last_status)}`;
            if (properties.description) {
                innerHTML += `<br><small>Deskripsi: ${properties.description.substring(0,100)}${properties.description.length > 100 ? '...' : ''}</small>`;
            }
            popupContentContainer.innerHTML = innerHTML;
            
            if (properties.img) {
                const viewImageButton = document.createElement('button');
                viewImageButton.type = 'button';
                viewImageButton.className = 'btn btn-sm btn-link p-0 mt-1';
                viewImageButton.style.fontSize = '0.8rem';
                viewImageButton.style.textDecoration = 'none';
                viewImageButton.innerHTML = `<span style="vertical-align: middle; margin-right: 4px;">🖼️</span>Lihat Foto`;
                viewImageButton.onclick = (event) => {
                    event.stopPropagation();
                    openImageModal(properties.img!, properties.name || 'Foto Pohon');
                };
                popupContentContainer.appendChild(document.createElement('br'));
                popupContentContainer.appendChild(viewImageButton);
            }
            
            while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
                coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
            }

            new mapboxgl.Popup({ closeButton: true, closeOnClick: true, maxWidth: '280px' })
                .setLngLat(coordinates as [number, number])
                .setDOMContent(popupContentContainer)
                .addTo(mapInstance);
        });

        mapInstance.on('click', 'clusters', (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
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
        mapInstance.on('mouseenter', 'clusters', () => { if(mapInstance) mapInstance.getCanvas().style.cursor = 'pointer'; });
        mapInstance.on('mouseleave', 'clusters', () => { if(mapInstance) mapInstance.getCanvas().style.cursor = ''; });
        mapInstance.on('mouseenter', 'unclustered-point', () => { if(mapInstance) mapInstance.getCanvas().style.cursor = 'pointer'; });
        mapInstance.on('mouseleave', 'unclustered-point', () => { if(mapInstance) mapInstance.getCanvas().style.cursor = ''; });
    }
    
    onMount(() => { setupMap(); });
    onDestroy(() => { mapInstance?.remove(); mapInstance = null; });
    afterUpdate(() => {
        if (!mapInstance && mapContainer) setupMap();
        if (mapInstance && mapInstance.isStyleLoaded() && treeDataGeoJSON) {
            const source = mapInstance.getSource('trees') as mapboxgl.GeoJSONSource;
            if (source) source.setData(treeDataGeoJSON);
            else updateMapData(treeDataGeoJSON);
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
        <Button color="secondary" on:click={toggleImageModal}>Tutup</Button>
    </div>
</Modal>