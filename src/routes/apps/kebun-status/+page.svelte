<script lang="ts">
    import { onMount } from 'svelte';
    import DefaultLayout from '$lib/layouts/DefaultLayout.svelte';
    import PageBreadcrumb from '$lib/components/PageBreadcrumb.svelte';
    import { Card, CardBody, Badge, Alert, Row, Col, Nav, NavItem, NavLink } from '@sveltestrap/sveltestrap';
    import Icon from '@iconify/svelte';
    import mapboxgl from 'mapbox-gl';
    import type { PageData } from './$types';

    export let data: PageData;

    $: companyName = data.companyName;
    $: companyId = data.companyId;
    $: compliance = data.compliance;
    $: ganoderma = data.ganoderma;
    $: polygon = data.polygon || [];
    $: mapboxAccessToken = data.mapboxAccessToken;
    $: error = data.error;

    let activeTab = 'compliance';
    let mapContainer: HTMLDivElement;
    let mapInstance: mapboxgl.Map | null = null;

    onMount(() => {
        if (mapboxAccessToken && polygon.length > 0) {
            initMap();
        }
    });

    function initMap() {
        mapboxgl.accessToken = mapboxAccessToken;
        
        const center = polygon.length > 0 
            ? [polygon[0][1], polygon[0][0]]
            : [106.816635, -6.598333];

        mapInstance = new mapboxgl.Map({
            container: mapContainer,
            style: 'mapbox://styles/mapbox/satellite-streets-v12',
            center: center as [number, number],
            zoom: 14,
        });

        mapInstance.addControl(new mapboxgl.NavigationControl(), 'top-right');
        mapInstance.addControl(new mapboxgl.FullscreenControl(), 'top-right');

        mapInstance.on('load', () => {
            mapInstance?.addSource('kebun-polygon', {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    geometry: {
                        type: 'Polygon',
                        coordinates: [polygon.map(p => [p[1], p[0]])],
                    },
                    properties: {},
                },
            });

            mapInstance?.addLayer({
                id: 'kebun-fill',
                type: 'fill',
                source: 'kebun-polygon',
                paint: {
                    'fill-color': '#198754',
                    'fill-opacity': 0.25,
                },
            });

            mapInstance?.addLayer({
                id: 'kebun-outline',
                type: 'line',
                source: 'kebun-polygon',
                paint: {
                    'line-color': '#198754',
                    'line-width': 3,
                },
            });

            const bounds = new mapboxgl.LngLatBounds();
            polygon.forEach(p => bounds.extend([p[1], p[0]]));
            mapInstance?.fitBounds(bounds, { padding: 50 });
        });
    }

    // ✅ FIX: Added 'SANGAT TINGGI' case
    function getRiskColor(riskLevel: string): string {
        switch (riskLevel) {
            case 'RENDAH': return '#198754';      // Bootstrap success green
            case 'SEDANG': return '#ffc107';      // Bootstrap warning yellow  
            case 'TINGGI': return '#fd7e14';      // Orange
            case 'SANGAT TINGGI': return '#dc3545'; // Bootstrap danger red
            case 'EKSTREM': return '#dc3545';     // Bootstrap danger red
            default: return '#198754';
        }
    }

    function getRiskBadgeColor(riskLevel: string): string {
        switch (riskLevel) {
            case 'RENDAH': return 'success';
            case 'SEDANG': return 'warning';
            case 'TINGGI': return 'warning';
            case 'SANGAT TINGGI': return 'danger';
            case 'EKSTREM': return 'danger';
            default: return 'success';
        }
    }

    function getLandCoverColor(landCover: string): string {
        switch (landCover) {
            case 'Perkebunan Sawit': return '#198754';
            case 'Hutan Alam': return '#0d6efd';
            case 'Karet': return '#ffc107';
            case 'Semak Belukar': return '#6c757d';
            case 'Gambut': return '#795548';
            default: return '#6c757d';
        }
    }
</script>

<svelte:head>
    <title>Status Kebun - GanoAI</title>
</svelte:head>

<DefaultLayout {data}>
    <PageBreadcrumb title="Status Kebun" subTitle="Aplikasi GanoAI" />

    <div class="page-container">
        <!-- Header Card -->
        <Card class="mb-4 border-0 shadow-sm bg-gradient-success text-white"
            style="background: linear-gradient(135deg, #198754 0%, #146c43 100%);"
        >
            <CardBody class="d-flex align-items-center">
                <div class="rounded-circle bg-white bg-opacity-25 p-3 me-3"
                    style="width: 56px; height: 56px; display: flex; align-items: center; justify-content: center;"
                >
                    <Icon icon="mdi:map-marker-radius" width="28" height="28" color="white" />
                </div>
                <div>
                    <h5 class="mb-1 text-white">{companyName}</h5>
                    <small class="text-white-50">ID: {companyId.substring(0, 12)}...</small>
                </div>
            </CardBody>
        </Card>

        {#if error}
            <Alert color="warning" class="mb-4 d-flex align-items-center">
                <Icon icon="mdi:alert-circle" class="me-2" width="20" height="20" />
                {error}
            </Alert>
        {/if}

        <!-- Map -->
        <Card class="mb-4 border-0 shadow-sm">
            <CardBody class="p-0">
                <div 
                    bind:this={mapContainer} 
                    style="width: 100%; height: 350px; border-radius: 8px;"
                ></div>
            </CardBody>
        </Card>

        <!-- Tabs -->
        <Card class="border-0 shadow-sm">
            <CardBody class="p-0">
                <Nav tabs class="px-3 pt-3">
                    <NavItem>
                        <NavLink 
                            active={activeTab === 'compliance'} 
                            on:click={() => activeTab = 'compliance'}
                            style="cursor: pointer; border: none; border-bottom: 3px solid transparent;"
                            class={activeTab === 'compliance' ? 'border-success text-success fw-bold' : 'text-muted'}
                        >
                            <Icon icon="mdi:shield-check" class="me-2" />
                            Compliance
                        </NavLink>
                    </NavItem>
                    <NavItem>
                        <NavLink 
                            active={activeTab === 'ganoderma'} 
                            on:click={() => activeTab = 'ganoderma'}
                            style="cursor: pointer; border: none; border-bottom: 3px solid transparent;"
                            class={activeTab === 'ganoderma' ? 'border-danger text-danger fw-bold' : 'text-muted'}
                        >
                            <Icon icon="mdi:virus" class="me-2" />
                            Ganoderma
                        </NavLink>
                    </NavItem>
                </Nav>

                <div class="p-3">
                    {#if activeTab === 'compliance'}
                        {#if compliance}
                            <Row class="g-3">
                                <!-- EUDR Card -->
                                <Col lg={6}>
                                    <Card class="h-100 border-0 shadow-sm {compliance.eudr2020.status === 'APPROVED' ? 'border-start border-success border-4' : 'border-start border-danger border-4'}"
                                    >
                                        <CardBody>
                                            <div class="d-flex justify-content-between align-items-start mb-4">
                                                <div class="d-flex align-items-center">
                                                    <div class="rounded-circle p-2 me-3 {compliance.eudr2020.status === 'APPROVED' ? 'bg-success bg-opacity-10' : 'bg-danger bg-opacity-10'}"
                                                        style="width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;"
                                                    >
                                                        <Icon 
                                                            icon={compliance.eudr2020.status === 'APPROVED' ? 'mdi:check-circle' : 'mdi:close-circle'} 
                                                            width="24" 
                                                            height="24" 
                                                            color={compliance.eudr2020.status === 'APPROVED' ? '#198754' : '#dc3545'}
                                                        />
                                                    </div>
                                                    <div>
                                                        <h5 class="mb-1">EUDR 2020</h5>
                                                        <small class="text-muted">European Deforestation Regulation</small>
                                                    </div>
                                                </div>
                                                <Badge 
                                                    color={compliance.eudr2020.status === 'APPROVED' ? 'success' : 'danger'}
                                                    class="px-3 py-2 rounded-pill"
                                                >
                                                    {compliance.eudr2020.status}
                                                </Badge>
                                            </div>
                                            
                                            <div class="row g-3 mb-4">
                                                <div class="col-6">
                                                    <div class="p-3 rounded-3 {compliance.eudr2020.status === 'APPROVED' ? 'bg-success bg-opacity-10' : 'bg-danger bg-opacity-10'}">
                                                        <small class="text-muted d-block mb-1">Red Flag</small>
                                                        <span class="fs-3 fw-bold {compliance.eudr2020.status === 'APPROVED' ? 'text-success' : 'text-danger'}">
                                                            {compliance.eudr2020.redFlagPercentage.toFixed(2)}%
                                                        </span>
                                                    </div>
                                                </div>
                                                <div class="col-6">
                                                    <div class="p-3 rounded-3 bg-light">
                                                        <small class="text-muted d-block mb-1">Dominant Cover</small>
                                                        <span class="fw-bold text-dark">{compliance.eudr2020.dominantCover}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <h6 class="fw-bold mb-3">Komposisi Lahan</h6>
                                            {#each Object.entries(compliance.eudr2020.komposisiDetail) as [label, percentage]}
                                                <div class="mb-3">
                                                    <div class="d-flex justify-content-between mb-1">
                                                        <span class="small">
                                                            <span class="d-inline-block rounded-circle me-2"
                                                                style="width: 10px; height: 10px; background-color: {getLandCoverColor(label)};"
                                                            ></span>
                                                            {label}
                                                        </span>
                                                        <span class="small fw-bold">{percentage.toFixed(1)}%</span>
                                                    </div>
                                                    <div class="progress" style="height: 8px; border-radius: 4px;">
                                                        <div 
                                                            class="progress-bar"
                                                            style="width: {percentage}%; background-color: {getLandCoverColor(label)}; border-radius: 4px;"
                                                            role="progressbar"
                                                        ></div>
                                                    </div>
                                                </div>
                                            {/each}
                                        </CardBody>
                                    </Card>
                                </Col>

                                <!-- RSPO Card -->
                                <Col lg={6}>
                                    <Card class="h-100 border-0 shadow-sm {compliance.rspo2005.status === 'APPROVED' ? 'border-start border-success border-4' : 'border-start border-danger border-4'}"
                                    >
                                        <CardBody>
                                            <div class="d-flex justify-content-between align-items-start mb-4">
                                                <div class="d-flex align-items-center">
                                                    <div class="rounded-circle p-2 me-3 {compliance.rspo2005.status === 'APPROVED' ? 'bg-success bg-opacity-10' : 'bg-danger bg-opacity-10'}"
                                                        style="width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;"
                                                    >
                                                        <Icon 
                                                            icon={compliance.rspo2005.status === 'APPROVED' ? 'mdi:check-circle' : 'mdi:close-circle'} 
                                                            width="24" 
                                                            height="24" 
                                                            color={compliance.rspo2005.status === 'APPROVED' ? '#198754' : '#dc3545'}
                                                        />
                                                    </div>
                                                    <div>
                                                        <h5 class="mb-1">RSPO 2005</h5>
                                                        <small class="text-muted">Roundtable Sustainable Palm Oil</small>
                                                    </div>
                                                </div>
                                                <Badge 
                                                    color={compliance.rspo2005.status === 'APPROVED' ? 'success' : 'danger'}
                                                    class="px-3 py-2 rounded-pill"
                                                >
                                                    {compliance.rspo2005.status}
                                                </Badge>
                                            </div>
                                            
                                            <div class="row g-3 mb-4">
                                                <div class="col-6">
                                                    <div class="p-3 rounded-3 {compliance.rspo2005.status === 'APPROVED' ? 'bg-success bg-opacity-10' : 'bg-danger bg-opacity-10'}">
                                                        <small class="text-muted d-block mb-1">Red Flag</small>
                                                        <span class="fs-3 fw-bold {compliance.rspo2005.status === 'APPROVED' ? 'text-success' : 'text-danger'}">
                                                            {compliance.rspo2005.redFlagPercentage.toFixed(2)}%
                                                        </span>
                                                    </div>
                                                </div>
                                                <div class="col-6">
                                                    <div class="p-3 rounded-3 bg-light">
                                                        <small class="text-muted d-block mb-1">Dominant Cover</small>
                                                        <span class="fw-bold text-dark">{compliance.rspo2005.dominantCover}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <h6 class="fw-bold mb-3">Komposisi Lahan</h6>
                                            {#each Object.entries(compliance.rspo2005.komposisiDetail) as [label, percentage]}
                                                <div class="mb-3">
                                                    <div class="d-flex justify-content-between mb-1">
                                                        <span class="small">
                                                            <span class="d-inline-block rounded-circle me-2"
                                                                style="width: 10px; height: 10px; background-color: {getLandCoverColor(label)};"
                                                            ></span>
                                                            {label}
                                                        </span>
                                                        <span class="small fw-bold">{percentage.toFixed(1)}%</span>
                                                    </div>
                                                    <div class="progress" style="height: 8px; border-radius: 4px;">
                                                        <div 
                                                            class="progress-bar"
                                                            style="width: {percentage}%; background-color: {getLandCoverColor(label)}; border-radius: 4px;"
                                                            role="progressbar"
                                                        ></div>
                                                    </div>
                                                </div>
                                            {/each}
                                        </CardBody>
                                    </Card>
                                </Col>
                            </Row>

                            <Alert color="light" class="mt-3 border">
                                <Icon icon="mdi:information" class="me-2 text-info" />
                                <strong>Kriteria Penilaian:</strong> APPROVED jika Red Flag &lt; 5%, REJECTED jika Red Flag ≥ 5%
                            </Alert>
                        {:else}
                            <div class="text-center py-5">
                                <Icon icon="mdi:shield-off" width="64" height="64" class="text-muted mb-3 opacity-50" />
                                <h5 class="text-muted">Data Compliance Tidak Tersedia</h5>
                                <p class="text-muted">Tidak dapat memuat data analisis compliance saat ini.</p>
                            </div>
                        {/if}

                    {:else}
                        <!-- Tab Ganoderma -->
                        {#if ganoderma}
                            <!-- Risk Level Hero Card -->
                            <Card class="mb-4 border-0 text-white"
                                style="background: linear-gradient(135deg, {getRiskColor(ganoderma.riskLevelShort)} 0%, {getRiskColor(ganoderma.riskLevelShort)}dd 100%);"
                            >
                                <CardBody class="text-center py-5">
                                    <div class="mb-3">
                                        <Icon 
                                            icon="mdi:virus" 
                                            width="64" 
                                            height="64" 
                                            color="white"
                                            class="opacity-75"
                                        />
                                    </div>
                                    
                                    <Badge color="light" class="mb-3 px-4 py-2 rounded-pill"
                                        style="color: {getRiskColor(ganoderma.riskLevelShort)};"
                                    >
                                        <Icon icon="mdi:alert-circle" class="me-1" />
                                        LEVEL RISIKO
                                    </Badge>
                                    
                                    <h2 class="mb-2 fw-bold">{ganoderma.riskLevelShort}</h2>
                                    <p class="mb-0 opacity-75">{ganoderma.riskDescription}</p>
                                </CardBody>
                            </Card>

                            <!-- Stats Cards -->
                            <Row class="g-3 mb-4">
                                <Col md={4}>
                                    <Card class="h-100 border-0 shadow-sm"
                                        style="border-top: 4px solid #198754 !important;"
                                    >
                                        <CardBody class="text-center py-4">
                                            <div class="mb-2">
                                                <Icon icon="mdi:tree" class="text-success" width="40" height="40" />
                                            </div>
                                            <h3 class="mb-1 fw-bold text-success">{ganoderma.sawitDurationYears}</h3>
                                            <p class="text-muted mb-0">Tahun Sawit</p>
                                        </CardBody>
                                    </Card>
                                </Col>
                                
                                <Col md={4}>
                                    <Card class="h-100 border-0 shadow-sm"
                                        style="border-top: 4px solid #ffc107 !important;"
                                    >
                                        <CardBody class="text-center py-4">
                                            <div class="mb-2">
                                                <Icon icon="mdi:forest" class="text-warning" width="40" height="40" />
                                            </div>
                                            <h3 class="mb-1 fw-bold text-warning">{ganoderma.karetDurationYears}</h3>
                                            <p class="text-muted mb-0">Tahun Karet</p>
                                        </CardBody>
                                    </Card>
                                </Col>
                                
                                <Col md={4}>
                                    <Card class="h-100 border-0 shadow-sm"
                                        style="border-top: 4px solid #6c757d !important;"
                                    >
                                        <CardBody class="text-center py-4">
                                            <div class="mb-2">
                                                <Icon icon="mdi:water" class="text-secondary" width="40" height="40" />
                                            </div>
                                            <h3 class="mb-1 fw-bold text-secondary">{ganoderma.gambutDurationYears}</h3>
                                            <p class="text-muted mb-0">Tahun Gambut</p>
                                        </CardBody>
                                    </Card>
                                </Col>
                            </Row>

                            <!-- Timeline -->
                            <Card class="border-0 shadow-sm"
                                style="border-top: 4px solid #0d6efd !important;"
                            >
                                <CardBody>
                                    <div class="d-flex align-items-center mb-4">
                                        <Icon icon="mdi:timeline-clock" class="text-primary me-2" width="24" height="24" />
                                        <h5 class="mb-0 fw-bold">Timeline Penggunaan Lahan</h5>
                                        <span class="ms-2 badge bg-secondary">2003-2022</span>
                                    </div>
                                    
                                    <div style="max-height: 400px; overflow-y: auto;">
                                        {#each Object.entries(ganoderma.timeline) as [year, landCover], index}
                                            <div class="d-flex align-items-center py-2 {index % 2 === 0 ? 'bg-light' : ''} px-2 rounded"
                                                style="transition: background-color 0.2s;"
                                            >
                                                <div class="me-3 text-end" style="width: 50px;">
                                                    <span class="fw-bold text-primary">{year}</span>
                                                </div>
                                                
                                                <div 
                                                    class="rounded-circle me-3 flex-shrink-0"
                                                    style="width: 14px; height: 14px; background-color: {getLandCoverColor(landCover)}; border: 2px solid white; box-shadow: 0 0 0 2px {getLandCoverColor(landCover)}40;"
                                                ></div>
                                                
                                                <span class="text-dark">{landCover}</span>
                                            </div>
                                        {/each}
                                    </div>
                                </CardBody>
                            </Card>

                            <Alert color="warning" class="mt-4 d-flex align-items-center border-0 shadow-sm"
                                style="background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%); border-left: 4px solid #ffc107 !important;"
                            >
                                <Icon icon="mdi:alert-circle" class="me-3 text-warning flex-shrink-0" width="28" height="28" />
                                <div>
                                    <strong>Peringatan:</strong> Risiko Ganoderma meningkat seiring usia tanaman sawit. 
                                    Lakukan pemantauan kondisi pangkal batang secara berkala untuk deteksi dini.
                                </div>
                            </Alert>
                        {:else}
                            <div class="text-center py-5">
                                <Icon icon="mdi:virus-off" width="64" height="64" class="text-muted mb-3 opacity-50" />
                                <h5 class="text-muted">Data Analisis Ganoderma Tidak Tersedia</h5>
                                <p class="text-muted">Tidak dapat memuat data analisis risiko Ganoderma saat ini.</p>
                            </div>
                        {/if}
                    {/if}
                </div>
            </CardBody>
        </Card>

        <div style="height: 32px;"></div>
    </div>
</DefaultLayout>

<style>
    :global(.bg-gradient-success) {
        background: linear-gradient(135deg, #198754 0%, #146c43 100%);
    }
    
    :global(.text-white-50) {
        color: rgba(255, 255, 255, 0.6) !important;
    }
</style>
