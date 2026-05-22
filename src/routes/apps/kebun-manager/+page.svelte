<script lang="ts">
    import DefaultLayout from '$lib/layouts/DefaultLayout.svelte';
    import PageBreadcrumb from '$lib/components/PageBreadcrumb.svelte';
    import { Card, CardBody, Button, Badge, Progress, Alert, Row, Col, Modal, ModalHeader, ModalBody, ModalFooter, FormGroup, Label, Input, Table, Spinner } from '@sveltestrap/sveltestrap';
    import Icon from '@iconify/svelte';
    import type { PageData } from './$types';
    import Swal from 'sweetalert2';
    import mapboxgl from 'mapbox-gl';
    import { onMount } from 'svelte';

    export let data: PageData;

    $: kebunList = data.kebunList || [];
    $: groupData = data.groupData;
    $: activeCompanyId = data.activeCompanyId;
    $: mapboxAccessToken = data.mapboxAccessToken;
    $: sisaKuota = groupData ? groupData.maxHektar - groupData.totalHektar : 0;

    let isSwitching = false;
    let switchError = '';
    let switchSuccess = '';

    // === Modal Kelola Kawasan ===
    let showKawasanModal = false;
    let selectedKebun: typeof kebunList[0] | null = null;
    let kawasanInputs = [{ id: Date.now(), value: '' }];

    // === Modal Tambah Kebun ===
    let showAddKebunModal = false;
    let addKebunForm = {
        company_name: '',
        luasKebun: '',
    };
    let addKebunKawasanInputs = [{ id: Date.now(), value: '' }];
    let polygonPoints: Array<{id: number, lng: number, lat: number}> = [];
    let mapboxSearchQuery = '';
    let mapboxSearchResults: Array<{place_name: string, center: [number, number]}> = [];
    let isSearching = false;
    let isSubmitting = false;
    let addKebunError = '';
    let addKebunMapContainer: HTMLDivElement;
    let addKebunMap: mapboxgl.Map | null = null;
    let addKebunMarkers: mapboxgl.Marker[] = [];
    let searchTimeout: ReturnType<typeof setTimeout>;

    async function handleSwitchKebun(companyId: string) {
        if (companyId === activeCompanyId) return;
        
        isSwitching = true;
        switchError = '';
        switchSuccess = '';

        try {
            const response = await fetch('/api/gano-active-company', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyId }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Gagal mengganti kebun');
            }

            switchSuccess = 'Kebun aktif berhasil diubah!';
            setTimeout(() => window.location.reload(), 1000);
        } catch (err: any) {
            switchError = err.message || 'Terjadi kesalahan saat mengganti kebun';
        } finally {
            isSwitching = false;
        }
    }

    function getQuotaPercentage(): number {
        if (!groupData || groupData.maxHektar <= 0) return 0;
        return Math.min((groupData.totalHektar / groupData.maxHektar) * 100, 100);
    }

    function getQuotaColor(): 'success' | 'warning' | 'danger' {
        const pct = getQuotaPercentage();
        if (pct >= 100) return 'danger';
        if (pct >= 80) return 'warning';
        return 'success';
    }

    // === Kawasan Modal Functions ===
    function openKawasanModal(kebun: typeof kebunList[0]) {
        selectedKebun = kebun;
        kawasanInputs = [{ id: Date.now(), value: '' }];
        showKawasanModal = true;
    }

    function closeKawasanModal() {
        showKawasanModal = false;
        selectedKebun = null;
        kawasanInputs = [{ id: Date.now(), value: '' }];
    }

    function addKawasanInput() {
        kawasanInputs = [...kawasanInputs, { id: Date.now(), value: '' }];
    }

    function removeKawasanInput(id: number) {
        kawasanInputs = kawasanInputs.filter(item => item.id !== id);
    }

    async function confirmDeleteKawasan(kawasan: string) {
        if (!selectedKebun) return;
        const result = await Swal.fire({
            title: `Hapus Kawasan "${kawasan}"?`,
            text: "Tindakan ini tidak dapat dibatalkan.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Ya, Hapus!',
            cancelButtonText: 'Batal'
        });
        if (result.isConfirmed) {
            const form = document.getElementById(`delete-kawasan-form-${kawasan}`) as HTMLFormElement;
            if (form) form.submit();
        }
    }

    // === Tambah Kebun Modal Functions ===
    function openAddKebunModal() {
        addKebunForm = { company_name: '', luasKebun: '' };
        addKebunKawasanInputs = [{ id: Date.now(), value: '' }];
        polygonPoints = [];
        mapboxSearchQuery = '';
        mapboxSearchResults = [];
        addKebunError = '';
        showAddKebunModal = true;
        
        // Initialize map after modal is visible
        setTimeout(() => initAddKebunMap(), 300);
    }

    function closeAddKebunModal() {
        showAddKebunModal = false;
        cleanupAddKebunMap();
    }

    function cleanupAddKebunMap() {
        addKebunMarkers.forEach(m => m.remove());
        addKebunMarkers = [];
        if (addKebunMap) {
            addKebunMap.remove();
            addKebunMap = null;
        }
    }

    function initAddKebunMap() {
        if (!addKebunMapContainer || !mapboxAccessToken) return;
        
        mapboxgl.accessToken = mapboxAccessToken;
        
        addKebunMap = new mapboxgl.Map({
            container: addKebunMapContainer,
            style: 'mapbox://styles/mapbox/satellite-streets-v12',
            center: [106.816635, -6.598333], // Default Indonesia
            zoom: 13,
        });

        addKebunMap.addControl(new mapboxgl.NavigationControl(), 'top-right');

        addKebunMap.on('load', () => {
            // Add GeoJSON source for polygon line
            addKebunMap!.addSource('polygon-line', {
                type: 'geojson',
                data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } }
            });

            addKebunMap!.addLayer({
                id: 'polygon-line-layer',
                type: 'line',
                source: 'polygon-line',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 'line-color': '#198754', 'line-width': 3 }
            });

            // Add GeoJSON source for polygon fill
            addKebunMap!.addSource('polygon-fill', {
                type: 'geojson',
                data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [] } }
            });

            addKebunMap!.addLayer({
                id: 'polygon-fill-layer',
                type: 'fill',
                source: 'polygon-fill',
                paint: { 'fill-color': '#198754', 'fill-opacity': 0.25 }
            });

            // Click to add point
            addKebunMap!.on('click', (e) => {
                addPolygonPoint(e.lngLat.lng, e.lngLat.lat);
            });
        });
    }

    function addPolygonPoint(lng: number, lat: number) {
        if (!addKebunMap) return;
        
        const id = Date.now() + Math.random();
        polygonPoints = [...polygonPoints, { id, lng, lat }];

        // Create draggable marker
        const el = document.createElement('div');
        el.className = 'polygon-marker';
        el.innerHTML = `<div style="
            width: 20px; height: 20px; 
            background: #198754; 
            border: 3px solid white; 
            border-radius: 50%; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            cursor: grab;
        "></div>`;

        let isDragging = false;

        const marker = new mapboxgl.Marker({ element: el, draggable: true })
            .setLngLat([lng, lat])
            .addTo(addKebunMap);

        // Track drag state
        marker.on('dragstart', () => {
            isDragging = true;
        });

        // Handle drag end
        marker.on('dragend', () => {
            const newPos = marker.getLngLat();
            polygonPoints = polygonPoints.map(p => 
                p.id === id ? { ...p, lng: newPos.lng, lat: newPos.lat } : p
            );
            updatePolygonLine();
            // Reset drag flag after a short delay to prevent click from firing
            setTimeout(() => {
                isDragging = false;
            }, 100);
        });

        // Handle click (delete) — only if not dragging
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isDragging) return; // Skip if was just dragged
            
            Swal.fire({
                title: 'Hapus Titik?',
                text: 'Apakah Anda yakin ingin menghapus titik polygon ini?',
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                confirmButtonText: 'Hapus',
                cancelButtonText: 'Batal'
            }).then((result) => {
                if (result.isConfirmed) {
                    removePolygonPoint(id);
                    marker.remove();
                }
            });
        });

        addKebunMarkers.push(marker);
        updatePolygonLine();
    }

    function removePolygonPoint(id: number) {
        polygonPoints = polygonPoints.filter(p => p.id !== id);
        updatePolygonLine();
    }

    function updatePolygonLine() {
        if (!addKebunMap) return;
        
        const coordinates = polygonPoints.map(p => [p.lng, p.lat]);
        if (coordinates.length > 0) {
            coordinates.push(coordinates[0]); // Close the loop
        }

        // Update line
        const lineSource = addKebunMap.getSource('polygon-line') as mapboxgl.GeoJSONSource;
        if (lineSource) {
            lineSource.setData({
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates }
            });
        }

        // Update fill polygon (min 3 points to be valid)
        const fillSource = addKebunMap.getSource('polygon-fill') as mapboxgl.GeoJSONSource;
        if (fillSource) {
            if (polygonPoints.length >= 3) {
                fillSource.setData({
                    type: 'Feature',
                    properties: {},
                    geometry: { type: 'Polygon', coordinates: [coordinates] }
                });
            } else {
                fillSource.setData({
                    type: 'Feature',
                    properties: {},
                    geometry: { type: 'Polygon', coordinates: [] }
                });
            }
        }
    }

    // === Mapbox Search ===
    async function searchMapboxLocations() {
        if (!mapboxSearchQuery.trim() || !mapboxAccessToken) {
            mapboxSearchResults = [];
            return;
        }

        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(async () => {
            isSearching = true;
            try {
                const response = await fetch(
                    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(mapboxSearchQuery)}.json?access_token=${mapboxAccessToken}&limit=5&country=id`
                );
                const data = await response.json();
                mapboxSearchResults = data.features || [];
            } catch (err) {
                console.error('Search error:', err);
                mapboxSearchResults = [];
            } finally {
                isSearching = false;
            }
        }, 500);
    }

    function selectSearchResult(result: {place_name: string, center: [number, number]}) {
        if (!addKebunMap) return;
        addKebunMap.flyTo({ center: result.center, zoom: 15 });
        mapboxSearchQuery = result.place_name;
        mapboxSearchResults = [];
    }

    // === Form Helpers ===
    function addKebunKawasanInput() {
        addKebunKawasanInputs = [...addKebunKawasanInputs, { id: Date.now(), value: '' }];
    }

    function removeKebunKawasanInput(id: number) {
        addKebunKawasanInputs = addKebunKawasanInputs.filter(item => item.id !== id);
    }

    function validateAddKebunForm(): string | null {
        if (!addKebunForm.company_name.trim()) return 'Nama kebun wajib diisi.';
        const luas = parseFloat(addKebunForm.luasKebun);
        if (isNaN(luas) || luas <= 0) return 'Luas kebun tidak valid.';
        if (luas > sisaKuota) return `Luas melebihi sisa kuota (${sisaKuota.toFixed(1)} Ha).`;
        
        const validKawasan = addKebunKawasanInputs.map(k => k.value.trim()).filter(Boolean);
        if (validKawasan.length === 0) return 'Minimal harus ada 1 kawasan.';
        
        if (polygonPoints.length < 3) return 'Polygon minimal harus memiliki 3 titik.';
        
        return null;
    }

    async function handleAddKebunSubmit() {
        addKebunError = '';
        
        const validationError = validateAddKebunForm();
        if (validationError) {
            addKebunError = validationError;
            return;
        }

        isSubmitting = true;

        try {
            const formData = new FormData();
            formData.append('company_name', addKebunForm.company_name.trim());
            formData.append('luasKebun', addKebunForm.luasKebun);
            
            addKebunKawasanInputs.forEach(k => {
                if (k.value.trim()) formData.append('kawasan', k.value.trim());
            });

            const polygonCoords = polygonPoints.map(p => [p.lat, p.lng]); // [lat, lng] for Firestore GeoPoint
            formData.append('polygon', JSON.stringify(polygonCoords));

            console.log('[AddKebun] Submitting form...');
            
            const response = await fetch('?/addKebun', {
                method: 'POST',
                body: formData
            });

            console.log('[AddKebun] Response status:', response.status);
            console.log('[AddKebun] Response headers:', Object.fromEntries(response.headers.entries()));

            // Cek apakah response OK
            if (!response.ok) {
                const text = await response.text();
                console.error('[AddKebun] Response not OK:', text);
                addKebunError = `Server error (${response.status}). Silakan coba lagi.`;
                return;
            }

            const contentType = response.headers.get('content-type');
            console.log('[AddKebun] Content-Type:', contentType);

            // Cek apakah response adalah JSON
            if (contentType && contentType.includes('application/json')) {
                const result = await response.json();
                console.log('[AddKebun] JSON result:', result);

                if (result.type === 'success' || result.success) {
                    await Swal.fire({
                        title: 'Berhasil!',
                        text: result.message || result.data?.message || 'Kebun berhasil ditambahkan.',
                        icon: 'success',
                        timer: 2000,
                        showConfirmButton: false
                    });
                    window.location.reload();
                } else {
                    const errorMsg = result.message || result.data?.message || 'Gagal menambahkan kebun.';
                    addKebunError = errorMsg;
                }
            } else {
                // Bisa jadi redirect atau HTML
                const text = await response.text();
                console.log('[AddKebun] Non-JSON response:', text.substring(0, 500));
                
                // Jika redirect, berarti sukses
                if (response.redirected || response.status === 200) {
                    await Swal.fire({
                        title: 'Berhasil!',
                        text: 'Kebun berhasil ditambahkan.',
                        icon: 'success',
                        timer: 2000,
                        showConfirmButton: false
                    });
                    window.location.reload();
                } else {
                    addKebunError = 'Gagal menambahkan kebun. Response tidak valid.';
                }
            }
        } catch (err: any) {
            console.error('[AddKebun] Error:', err);
            addKebunError = err.message || 'Terjadi kesalahan saat menyimpan data.';
        } finally {
            isSubmitting = false;
        }
    }
</script>

<svelte:head>
    <title>Kelola Kebun - GanoAI</title>
</svelte:head>

<DefaultLayout {data}>
    <PageBreadcrumb title="Kelola Kebun" subTitle="Aplikasi GanoAI" />

    <div class="page-container">
        {#if switchSuccess}
            <Alert color="success" dismissible class="mb-3">{switchSuccess}</Alert>
        {/if}
        {#if switchError}
            <Alert color="danger" dismissible class="mb-3">{switchError}</Alert>
        {/if}

        {#if groupData}
            <Card class="mb-4 border-0 shadow-sm">
                <CardBody>
                    <Row>
                        <Col md={6}>
                            <div class="d-flex justify-content-between mb-2">
                                <span class="fw-bold">Kuota Hektar</span>
                                <span class="fw-bold">{groupData.totalHektar.toFixed(1)} / {groupData.maxHektar.toFixed(1)} Ha</span>
                            </div>
                            <Progress 
                                value={getQuotaPercentage()} 
                                color={getQuotaColor()} 
                                class="mb-2" 
                                style="height: 8px;"
                            />
                            <div class="d-flex justify-content-between">
                                <small class="text-muted">Sisa: {sisaKuota.toFixed(1)} Ha</small>
                                <small class="text-muted">{groupData.memberCount} anggota grup</small>
                            </div>
                        </Col>
                        <Col md={6} class="d-flex align-items-center justify-content-md-end mt-3 mt-md-0">
                            {#if sisaKuota > 0}
                                <Button color="success" on:click={openAddKebunModal}>
                                    <Icon icon="mdi:plus" class="me-1" />
                                    Tambah Kebun
                                </Button>
                            {:else}
                                <Badge color="danger" class="p-2">
                                    <Icon icon="mdi:alert" class="me-1" />
                                    Kuota Penuh
                                </Badge>
                            {/if}
                        </Col>
                    </Row>
                </CardBody>
            </Card>
        {/if}

        {#if kebunList.length > 0}
            <Row>
                {#each kebunList as kebun}
                    <Col md={6} lg={4} class="mb-3">
                        <Card class="h-100 border-0 shadow-sm {kebun.isActive ? 'border-success border-2' : ''}"
                            style={kebun.isActive ? 'border: 2px solid #198754 !important;' : ''}
                        >
                            <CardBody class="d-flex flex-column">
                                <div class="d-flex justify-content-between align-items-start mb-3">
                                    <div>
                                        <div class="d-flex align-items-center mb-1">
                                            {#if kebun.isActive}
                                                <Badge color="success" class="me-2">Aktif</Badge>
                                            {/if}
                                            <Icon 
                                                icon="mdi:forest" 
                                                class={kebun.isActive ? 'text-success' : 'text-muted'} 
                                                width="24" 
                                                height="24"
                                            />
                                        </div>
                                        <h5 class="mb-1">{kebun.companyName}</h5>
                                        <small class="text-muted">Luas: {kebun.luasKebun} Ha</small>
                                    </div>
                                </div>

                                <div class="mt-auto d-flex gap-2">
                                    {#if kebun.isActive}
                                        <Button color="outline-success" size="sm" class="flex-grow-1" disabled>
                                            <Icon icon="mdi:check" class="me-1" /> Kebun Aktif
                                        </Button>
                                    {:else}
                                        <Button 
                                            color="success" size="sm" class="flex-grow-1"
                                            on:click={() => handleSwitchKebun(kebun.id)}
                                            disabled={isSwitching}
                                        >
                                            {#if isSwitching}
                                                <span class="spinner-border spinner-border-sm me-1" role="status"></span> Memindahkan...
                                            {:else}
                                                <Icon icon="mdi:swap-horizontal" class="me-1" /> Pilih Kebun
                                            {/if}
                                        </Button>
                                    {/if}
                                    <Button 
                                        color="primary" size="sm" outline
                                        on:click={() => openKawasanModal(kebun)}
                                        title="Kelola Kawasan"
                                    >
                                        <Icon icon="mdi:map-marker-multiple-outline" />
                                    </Button>
                                </div>
                            </CardBody>
                        </Card>
                    </Col>
                {/each}
            </Row>
        {:else}
            <Card class="border-0 shadow-sm">
                <CardBody class="text-center py-5">
                    <Icon icon="mdi:forest-off" width="64" height="64" class="text-muted mb-3" />
                    <h5 class="text-muted">Belum ada kebun terdaftar</h5>
                    <p class="text-muted">Anda belum memiliki kebun yang terdaftar dalam grup ini.</p>
                </CardBody>
            </Card>
        {/if}
    </div>
</DefaultLayout>

{#if selectedKebun}
<!-- Modal Kelola Kawasan -->
<Modal isOpen={showKawasanModal} toggle={closeKawasanModal} size="lg">
    <ModalHeader toggle={closeKawasanModal}>Kelola Kawasan — {selectedKebun.companyName}</ModalHeader>
    <ModalBody>
        <Row>
            <Col md={5}>
                <Card class="h-100 border-0 bg-light">
                    <CardBody>
                        <h6 class="fw-bold mb-3">Tambah Kawasan Baru</h6>
                        <form method="POST" action="?/addKawasan">
                            <input type="hidden" name="companyId" value={selectedKebun.id} />
                            <FormGroup>
                                <Label for="modal-kawasan-0" class="form-label-sm">Nama Kawasan</Label>
                                {#each kawasanInputs as input, i (input.id)}
                                    <div class="d-flex align-items-center mb-2">
                                        <Input
                                            id="modal-kawasan-{i}" name="kawasan" type="text"
                                            placeholder={i === 0 ? "Contoh: Blok A1" : "Kawasan baru..."}
                                            bind:value={input.value} required bsSize="sm"
                                        />
                                        {#if kawasanInputs.length > 1}
                                            <Button color="danger" outline size="sm" class="ms-2 btn-icon"
                                                on:click={() => removeKawasanInput(input.id)}><Icon icon="mdi:close" /></Button>
                                        {/if}
                                    </div>
                                {/each}
                            </FormGroup>
                            <Button color="secondary" outline type="button" class="w-100 mb-3" size="sm"
                                on:click={addKawasanInput}><Icon icon="mdi:plus" /> Tambah Baris</Button>
                            <Button color="primary" type="submit" class="w-100" size="sm"><Icon icon="mdi:plus-circle-outline" class="me-1" /> Tambahkan</Button>
                        </form>
                    </CardBody>
                </Card>
            </Col>
            <Col md={7}>
                <Card class="h-100 border-0">
                    <CardBody>
                        <h6 class="fw-bold mb-3">Daftar Kawasan</h6>
                        {#if selectedKebun.daftarKawasan && selectedKebun.daftarKawasan.length > 0}
                            <div class="table-responsive">
                                <Table class="table-sm table-hover align-middle">
                                    <thead class="table-light"><tr><th>Nama Kawasan</th><th class="text-end" style="width: 60px;">Aksi</th></tr></thead>
                                    <tbody>
                                        {#each selectedKebun.daftarKawasan as kawasan (kawasan)}
                                            <tr>
                                                <td class="fw-medium">{kawasan}</td>
                                                <td class="text-end">
                                                    <form method="POST" action="?/deleteKawasan" id="delete-kawasan-form-{kawasan}">
                                                        <input type="hidden" name="companyId" value={selectedKebun.id} />
                                                        <input type="hidden" name="kawasan" value={kawasan} />
                                                        <Button type="button" color="danger" outline size="sm" class="btn-icon"
                                                            title="Hapus {kawasan}" on:click={() => confirmDeleteKawasan(kawasan)}>
                                                            <Icon icon="mdi:trash-can-outline" /></Button>
                                                    </form>
                                                </td>
                                            </tr>
                                        {/each}
                                    </tbody>
                                </Table>
                            </div>
                        {:else}
                            <Alert color="info" class="text-center mb-0">Belum ada kawasan yang ditambahkan.</Alert>
                        {/if}
                    </CardBody>
                </Card>
            </Col>
        </Row>
    </ModalBody>
    <ModalFooter>
        <Button color="secondary" size="sm" on:click={closeKawasanModal}>Tutup</Button>
    </ModalFooter>
</Modal>
{/if}

<!-- Modal Tambah Kebun -->
<Modal isOpen={showAddKebunModal} toggle={closeAddKebunModal} size="xl" backdrop="static">
    <ModalHeader toggle={closeAddKebunModal}>
        <Icon icon="mdi:plus-circle" class="me-2 text-success" />
        Tambah Kebun Baru
    </ModalHeader>
    <ModalBody>
        {#if addKebunError}
            <Alert color="danger" class="mb-3">{addKebunError}</Alert>
        {/if}

        <Row class="g-3">
            <Col lg={4}>
                <Card class="border-0 bg-light h-100">
                    <CardBody>
                        <h6 class="fw-bold mb-3 text-success"><Icon icon="mdi:form-textbox" class="me-1" /> Informasi Kebun</h6>

                        <FormGroup>
                            <Label for="kebun-name">Nama Kebun <span class="text-danger">*</span></Label>
                            <Input 
                                id="kebun-name" type="text" 
                                placeholder="Contoh: Kebun Sawit ABC"
                                bind:value={addKebunForm.company_name}
                            />
                        </FormGroup>

                        <FormGroup>
                            <Label for="kebun-luas">Luas Kebun (Ha) <span class="text-danger">*</span></Label>
                            <Input 
                                id="kebun-luas" type="number" step="0.1" min="0.1"
                                max={sisaKuota}
                                placeholder={`Maksimal ${sisaKuota.toFixed(1)} Ha`}
                                bind:value={addKebunForm.luasKebun}
                            />
                            <small class="text-muted">Sisa kuota: <strong>{sisaKuota.toFixed(1)} Ha</strong></small>
                        </FormGroup>

                        <FormGroup>
                            <Label>Daftar Kawasan <span class="text-danger">*</span> <small class="text-muted">(Minimal 1)</small></Label>
                            {#each addKebunKawasanInputs as input, i (input.id)}
                                <div class="d-flex align-items-center mb-2">
                                    <Input
                                        name="kawasan" type="text"
                                        placeholder={i === 0 ? "Contoh: Blok A1" : "Kawasan baru..."}
                                        bind:value={input.value}
                                        bsSize="sm"
                                    />
                                    {#if addKebunKawasanInputs.length > 1}
                                        <Button color="danger" outline size="sm" class="ms-2 btn-icon"
                                            on:click={() => removeKebunKawasanInput(input.id)}><Icon icon="mdi:close" /></Button>
                                    {/if}
                                </div>
                            {/each}
                            <Button color="secondary" outline type="button" class="w-100" size="sm"
                                on:click={addKebunKawasanInput}><Icon icon="mdi:plus" /> Tambah Kawasan</Button>
                        </FormGroup>
                    </CardBody>
                </Card>
            </Col>

            <Col lg={8}>
                <Card class="border-0 h-100">
                    <CardBody class="p-0">
                        <h6 class="fw-bold mb-2 px-3 pt-3 text-success">
                            <Icon icon="mdi:map-marker-path" class="me-1" /> Gambar Batas Kebun (Polygon)
                        </h6>
                        <p class="text-muted small px-3 mb-2">
                            <Icon icon="mdi:information" class="me-1" />
                            Tap peta untuk menambah titik. Minimal 3 titik. Geser marker untuk mengubah posisi. Tap marker untuk menghapus.
                        </p>

                        <!-- Search Bar -->
                        <div class="px-3 mb-2 position-relative">
                            <div class="input-group input-group-sm">
                                <span class="input-group-text"><Icon icon="mdi:magnify" /></span>
                                <Input
                                    type="text" placeholder="Cari lokasi..."
                                    bind:value={mapboxSearchQuery}
                                    on:input={searchMapboxLocations}
                                />
                                {#if isSearching}
                                    <span class="input-group-text"><Spinner size="sm" /></span>
                                {/if}
                            </div>
                            {#if mapboxSearchResults.length > 0}
                                <div class="position-absolute w-100 bg-white border rounded shadow-sm mt-1" style="z-index: 1000; max-height: 200px; overflow-y: auto;">
                                    {#each mapboxSearchResults as result}
                                        <button type="button" class="dropdown-item small py-2 px-3 text-start border-bottom"
                                            on:click={() => selectSearchResult(result)}>
                                            <Icon icon="mdi:map-marker" class="me-2 text-success" />{result.place_name}
                                        </button>
                                    {/each}
                                </div>
                            {/if}
                        </div>

                        <!-- Map -->
                        <div bind:this={addKebunMapContainer} style="width: 100%; height: 400px; border-radius: 0 0 8px 8px;"></div>

                        <div class="px-3 py-2 d-flex justify-content-between align-items-center">
                            <small class="text-muted">
                                <Icon icon="mdi:map-marker-multiple" class="me-1" />
                                Titik polygon: <strong>{polygonPoints.length}</strong> 
                                {polygonPoints.length >= 3 ? '(✓ Valid)' : '(Minimal 3)'}
                            </small>
                            {#if polygonPoints.length > 0}
                                <Button color="danger" outline size="sm" on:click={() => { polygonPoints = []; addKebunMarkers.forEach(m => m.remove()); addKebunMarkers = []; updatePolygonLine(); }}>
                                    <Icon icon="mdi:trash-can" class="me-1" /> Reset
                                </Button>
                            {/if}
                        </div>
                    </CardBody>
                </Card>
            </Col>
        </Row>
    </ModalBody>
    <ModalFooter>
        <Button color="secondary" on:click={closeAddKebunModal} disabled={isSubmitting}>Batal</Button>
        <Button color="success" on:click={handleAddKebunSubmit} disabled={isSubmitting}>
            {#if isSubmitting}
                <Spinner size="sm" class="me-1" /> Menyimpan...
            {:else}
                <Icon icon="mdi:content-save" class="me-1" /> Simpan Kebun
            {/if}
        </Button>
    </ModalFooter>
</Modal>

<style>
    :global(.polygon-marker) {
        z-index: 10;
    }
</style>