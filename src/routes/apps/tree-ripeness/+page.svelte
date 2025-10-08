<script lang="ts">
	import DefaultLayout from '$lib/layouts/DefaultLayout.svelte';
	import PageBreadcrumb from '$lib/components/PageBreadcrumb.svelte';
	import {
		Col, Row, Input, Button, ButtonGroup, Table,
		Modal, ModalHeader, ModalBody, Alert, Card, CardBody, Spinner, Badge, FormGroup, Label
	} from "@sveltestrap/sveltestrap";
	import TreeCard from "./components/TreeCard.svelte";
	import LeftTimeline from "$lib/components/customTimeline/LeftTimeline.svelte";
	import MapboxMapRipeness from '$lib/components/MapboxMapRipeness.svelte';
	import type { Tree, TimelineDataType, TimelineEventType, AppError } from '$lib/types';
	import type { PageData } from './$types';
	import Icon from '@iconify/svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { tick } from "svelte";

	export let data: PageData;
	
	let treeToFocus: Tree | null = null;

	$: layoutPageData = {
		userSession: $page.data.userSession,
		menuItemsForLayout: $page.data.menuItemsForLayout
	};

	let allTrees: Tree[] = [];
	let activeCompanyId: string | null = null;
	let serverMessage: string | null | undefined;
	let searchTerm = "";
	let viewMode: 'card' | 'table' = 'card';
	
	// State baru untuk UI filter
	let uiFilterKawasan: string | undefined | null;
	let uiFilterRipeness: string | undefined | null;
	let daftarKawasan: string[] = [];
	
	let isPhotoModalOpen = false;
	let selectedTreeForPhoto: Tree | null = null;
	let isTimelineModalOpen = false;
	let selectedTreeForTimeline: Tree | null = null;
	let timelineDataForModal: TimelineDataType[] = [];
	let isLoadingTimeline = false;
	let timelineError: string | null = null;

	const defaultTreeImage = '/images/trees/default-tree.jpg';

	function initializeState(currentPageData: PageData) {
		allTrees = currentPageData.trees || [];
		activeCompanyId = currentPageData.companyId || null;
		serverMessage = (currentPageData as any).message || null;
		
		// Inisialisasi state filter dari data server
		daftarKawasan = currentPageData.daftarKawasan || [];
		uiFilterKawasan = currentPageData.filters?.kawasan;
		uiFilterRipeness = currentPageData.filters?.ripenessStatus;
	}

	initializeState(data);
	$: initializeState(data);

	$: criticalError = $page.error as AppError | null;

	$: filteredTrees = allTrees.filter(tree =>
		tree.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
		tree.id?.toLowerCase().includes(searchTerm.toLowerCase())
	);

	function applyFilters() {
		const params = new URLSearchParams();
		if (uiFilterKawasan) params.set('kawasan', uiFilterKawasan);
		if (uiFilterRipeness) params.set('ripenessStatus', uiFilterRipeness);
		goto(`?${params.toString()}`, { keepFocus: true, invalidateAll: true });
	}

	function clearFilters() {
		goto('/apps/tree-ripeness', { keepFocus: true, invalidateAll: true });
	}

	function zoomToTree(tree: Tree) {
        treeToFocus = tree;
		window.scrollTo({ top: 0, behavior: 'smooth' });
    }

	function openPhotoModalHandler(tree: Tree) {
		selectedTreeForPhoto = tree;
		isPhotoModalOpen = true;
	}

	function togglePhotoModal() {
		isPhotoModalOpen = !isPhotoModalOpen;
		if (!isPhotoModalOpen) selectedTreeForPhoto = null;
	}

	async function openTimelineModalHandler(tree: Tree) {
		if (!activeCompanyId || !tree.id) {
			timelineError = "Informasi perusahaan atau pohon tidak lengkap.";
			return;
		}
		selectedTreeForTimeline = tree;
		isTimelineModalOpen = true;
		isLoadingTimeline = true;
		timelineDataForModal = [];
		timelineError = null;

		try {
			const response = await fetch(`/api/ripeness-tree-records/${activeCompanyId}/${tree.id}.json`);
			if (!response.ok) {
				const errData = await response.json().catch(() => ({ message: `Gagal memuat riwayat: ${response.statusText}` }));
				throw new Error(errData.message || `HTTP error ${response.status}`);
			}
			const result: { timelineEvents: TimelineEventType[] } = await response.json();
			const formattedRecords: Record<string, TimelineEventType[]> = {};
			result.timelineEvents.forEach(event => {
				if (event.originalDateISO) {
					const dateKey = new Date(event.originalDateISO).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
					if (!formattedRecords[dateKey]) {
						formattedRecords[dateKey] = [];
					}
					formattedRecords[dateKey].push(event);
				} else {
					console.warn("Ripeness timeline event missing originalDateISO:", event);
				}
			});
			timelineDataForModal = Object.entries(formattedRecords)
				.map(([dateStr, events]) => ({ date: dateStr, events }))
				.sort((a,b) => new Date(b.events[0]?.originalDateISO ?? 0).getTime() - new Date(a.events[0]?.originalDateISO ?? 0).getTime());
		} catch (err: any) {
			console.error("Error fetching Ripeness tree timeline:", err);
			timelineError = err.message || "Gagal memuat riwayat pohon Ripeness.";
		} finally {
			isLoadingTimeline = false;
			await tick();
		}
	}

	function getRipenessTreeTableStatus(tree: Tree | undefined): { text: string, color: string, icon: string } {
		if (!tree || !tree.fruitCounts) return { text: 'N/A', color: 'secondary', icon: 'mdi:help-circle-outline' };
		const fc = tree.fruitCounts;
		if (fc.terlaluMatang > 0) return { text: 'Ada Terlalu Matang', color: 'danger', icon: 'mdi:fruit-cherries-off' };
		if (fc.matang > 0) return { text: 'Siap Panen', color: 'success', icon: 'mdi:fruit-cherries' };
		if (fc.belumMatang > 0) return { text: 'Belum Matang', color: 'warning', icon: 'mdi:fruit-cherries-outline' };
		return { text: 'Tidak Ada Buah', color: 'secondary', icon: 'mdi:fruit-cherries-off-outline' };
	}

	function toggleTimelineModal() {
		isTimelineModalOpen = !isTimelineModalOpen;
		if (!isTimelineModalOpen) {
			selectedTreeForTimeline = null;
			timelineDataForModal = [];
			timelineError = null;
		}
	}

	function handleTreeImageError(event: Event) {
		const target = event.target as HTMLImageElement;
		target.src = defaultTreeImage;
	}
</script>

<DefaultLayout {data}>
    <PageBreadcrumb title="Data Pohon Ripeness (SawitHarvest)" subTitle="Aplikasi Ripeness" />

    {#if criticalError}
        <Alert color="danger" class="mt-2">{criticalError.message || 'Terjadi kesalahan server.'}</Alert>
    {/if}

    <Card class="my-4">
        <CardBody>
            <Row class="g-3 align-items-end">
                <Col md="4">
                    <FormGroup class="mb-0">
                        <Label for="kawasan-filter" class="form-label-sm">Filter Kawasan:</Label>
                        <Input type="select" id="kawasan-filter" bsSize="sm" bind:value={uiFilterKawasan}>
                            <option value={undefined}>Semua Kawasan</option>
                            {#each daftarKawasan as kawasan (kawasan)}
                                <option value={kawasan}>{kawasan}</option>
                            {/each}
                        </Input>
                    </FormGroup>
                </Col>
                <Col md="4">
                    <FormGroup class="mb-0">
                        <Label for="ripeness-filter" class="form-label-sm">Filter Kematangan:</Label>
                        <Input type="select" id="ripeness-filter" bsSize="sm" bind:value={uiFilterRipeness}>
                            <option value={undefined}>Semua Status</option>
                            <option value="matang">Siap Panen (Ada Buah Matang)</option>
                            <option value="belumMatang">Belum Matang</option>
                            <option value="terlaluMatang">Ada Buah Terlalu Matang</option>
                        </Input>
                    </FormGroup>
                </Col>
                <Col md="4">
                    <FormGroup class="mb-0">
                        <Label class="form-label-sm" style="visibility: hidden;">Aksi</Label>
                        <div class="d-flex gap-2">
                            <Button color="primary" size="sm" class="w-100" on:click={applyFilters}>
                                <Icon icon="mdi:magnify"/> Terapkan
                            </Button>
                            {#if data.filters?.kawasan || data.filters?.ripenessStatus}
                                <Button color="outline-secondary" size="sm" class="w-100" on:click={clearFilters}>
                                    <Icon icon="mdi:filter-remove-outline"/> Hapus
                                </Button>
                            {/if}
                        </div>
                    </FormGroup>
                </Col>
            </Row>
        </CardBody>
    </Card>

    <Row>
        <Col xs="12" class="mb-4">
            <Card class="h-100">
                <CardBody class="p-0" style="height: 50vh;">
                    {#if data.mapboxAccessToken && data.treeDataGeoJSON}
                        <MapboxMapRipeness
                            accessToken={data.mapboxAccessToken}
                            treeDataGeoJSON={data.treeDataGeoJSON}
                            initialViewState={{
                                latitude: data.mapCenter.latitude,
                                longitude: data.mapCenter.longitude,
                                zoom: 15
                            }}
                        />
                    {:else if data.mapboxAccessToken && !data.treeDataGeoJSON}
                        <Alert color="info" class="h-100 d-flex align-items-center justify-content-center m-0 rounded-0">
                            Tidak ada data pohon dengan lokasi yang cocok untuk ditampilkan di peta.
                        </Alert>
                    {:else}
                        <Alert color="warning" class="h-100 d-flex align-items-center justify-content-center m-0 rounded-0">
                            Token Mapbox tidak dikonfigurasi.
                        </Alert>
                    {/if}
                </CardBody>
            </Card>
        </Col>

        <Col xs="12">
            <Card>
                <CardBody>
                    <div class="d-flex align-items-center mb-3">
                        <div class="flex-grow-1">
                            <Input
                                type="text"
                                placeholder="Cari dari hasil filter..."
                                bind:value={searchTerm}
                                class="form-control-sm"
                                disabled={criticalError != null}
                            />
                        </div>
                        <div class="flex-shrink-0 ms-2 d-flex align-items-center gap-2">
                            <Badge color="primary" pill>Total: {filteredTrees.length}</Badge>
                            <ButtonGroup size="sm">
                                <Button color="primary" outline={viewMode !== 'card'} on:click={() => viewMode = 'card'} title="Tampilan Kartu" disabled={criticalError != null}>
                                    <Icon icon="mdi:view-grid-outline" />
                                </Button>
                                <Button color="primary" outline={viewMode !== 'table'} on:click={() => viewMode = 'table'} title="Tampilan Tabel" disabled={criticalError != null}>
                                    <Icon icon="mdi:view-list-outline" />
                                </Button>
                            </ButtonGroup>
                        </div>
                    </div>

                    {#if !criticalError && filteredTrees.length > 0}
                        {#if viewMode === 'card'}
                            <Row class="row-cols-1 row-cols-sm-2 row-cols-lg-3 row-cols-xl-4 g-3">
                                {#each filteredTrees as tree (tree.id)}
                                    <Col class="d-flex align-items-stretch">
                                        <div
                                            class="w-100"
                                            style="cursor: pointer;"
                                            role="button"
                                            tabindex="0"
                                            on:click={() => zoomToTree(tree)}
                                            on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && zoomToTree(tree)}
                                        >
                                            <TreeCard {tree} onViewPhoto={openPhotoModalHandler} onViewTimeline={openTimelineModalHandler} class="w-100 h-100"/>
                                        </div>
                                    </Col>
                                {:else}
                                    <Col>
                                        <p class="text-muted text-center mt-4">Pohon tidak ditemukan.</p>
                                    </Col>
                                {/each}
                            </Row>
                        {/if}
                        {#if viewMode === 'table'}
                            <div class="table-responsive">
                                <Table hover class="table-sm align-middle">
                                    <thead class="table-light">
                                        <tr>
                                            <th>Nama Pohon</th>
											<th>Kawasan</th>
                                            <th class="text-center">Matang</th>
                                            <th class="text-center">Belum Matang</th>
                                            <th class="text-center">Terlalu Matang</th>
                                            <th>Status Umum</th>
                                            <th class="text-center">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {#each filteredTrees as tree (tree.id)}
                                            {@const statusInfo = getRipenessTreeTableStatus(tree)}
                                            <tr style="cursor: pointer;" on:click={() => zoomToTree(tree)}>
                                                <td>
													<div>{tree.name || '-'}</div>
													<small class="text-muted font-monospace">{tree.id?.substring(0, 8)}</small>
												</td>
												<td class="text-muted">{tree.kawasan || '-'}</td>
                                                <td class="text-center fw-medium text-success">{tree.fruitCounts?.matang ?? 0}</td>
                                                <td class="text-center">{tree.fruitCounts?.belumMatang ?? 0}</td>
                                                <td class="text-center text-danger">{tree.fruitCounts?.terlaluMatang ?? 0}</td>
                                                <td>
                                                    <Badge color={statusInfo.color} pill class="px-2 py-1">
                                                        <Icon icon={statusInfo.icon} class="me-1" style="vertical-align: -1px;"/>
                                                        {statusInfo.text}
                                                    </Badge>
                                                </td>
                                                <td class="text-center">
                                                    <ButtonGroup size="sm">
                                                        {#if tree.img}
                                                            <Button
                                                                color="light"
                                                                on:click={(e) => {
                                                                    e.stopPropagation(); // Panggil stopPropagation secara manual
                                                                    openPhotoModalHandler(tree);
                                                                }}
                                                                title="Lihat Foto"
                                                                class="btn-icon"
                                                            >
                                                                <Icon icon="mdi:image-outline" />
                                                            </Button>
                                                        {/if}
                                                        <Button
                                                            color="light"
                                                            on:click={(e) => {
                                                                e.stopPropagation(); // Panggil stopPropagation secara manual
                                                                openTimelineModalHandler(tree);
                                                            }}
                                                            title="Lihat Riwayat"
                                                            class="btn-icon"
                                                        >
                                                            <Icon icon="mdi:timeline-text-outline" />
                                                        </Button>
                                                    </ButtonGroup>
                                                </td>
                                            </tr>
                                        {/each}
                                    </tbody>
                                </Table>
                            </div>
                        {:else}
                            <p class="text-muted text-center mt-4">{serverMessage || 'Tidak ada pohon untuk ditampilkan.'}</p>
                        {/if}
                    {/if}
                </CardBody>
            </Card>
        </Col>
    </Row>

	{#if selectedTreeForPhoto}
        <Modal isOpen={isPhotoModalOpen} toggle={togglePhotoModal} size="lg" centered scrollable>
            <ModalHeader toggle={togglePhotoModal}>Foto Pohon (Ripeness): {selectedTreeForPhoto.name}</ModalHeader>
            <ModalBody class="text-center">
                {#if selectedTreeForPhoto.img}
                    <img
                        src={selectedTreeForPhoto.img}
                        alt="Foto {selectedTreeForPhoto.name}"
                        class="img-fluid"
                        style="max-height: 75vh; border-radius: 0.25rem;"
                        on:error={handleTreeImageError}
                    />
                {:else}
                    <p>Tidak ada foto untuk pohon ini.</p>
                {/if}
            </ModalBody>
            <div class="modal-footer">
                <Button color="secondary" outline on:click={togglePhotoModal}>Tutup</Button>
            </div>
        </Modal>
    {/if}
    {#if selectedTreeForTimeline}
        <Modal isOpen={isTimelineModalOpen} toggle={toggleTimelineModal} size="xl" centered scrollable>
            <ModalHeader toggle={toggleTimelineModal}>
                Riwayat Pohon Ripeness: {selectedTreeForTimeline.name}
                <small class="text-muted ms-1">({selectedTreeForTimeline.id?.substring(0,8)})</small>
            </ModalHeader>
            <ModalBody>
                {#if isLoadingTimeline}
                    <div class="text-center py-5">
                        <Spinner color="primary" />
                        <p class="mt-2">Memuat riwayat pohon...</p>
                    </div>
                {:else if timelineError}
                    <Alert color="danger">{timelineError}</Alert>
                {:else if timelineDataForModal.length > 0}
                    <LeftTimeline
                        timelineItems={timelineDataForModal}
                        treeName="" />
                {:else}
                    <p class="text-muted text-center py-4">Tidak ada data riwayat untuk pohon ini.</p>
                {/if}
            </ModalBody>
            <div class="modal-footer">
                <Button color="secondary" outline on:click={toggleTimelineModal}>Tutup</Button>
            </div>
        </Modal>
    {/if}
</DefaultLayout>

<style>
</style>