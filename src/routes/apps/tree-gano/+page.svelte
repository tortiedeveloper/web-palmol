<script lang="ts">
	import DefaultLayout from '$lib/layouts/DefaultLayout.svelte';
	import PageBreadcrumb from '$lib/components/PageBreadcrumb.svelte';
	import { Col, Row, Input, Button, ButtonGroup, Table, Modal, ModalHeader, ModalBody, Alert, Card, CardBody, Spinner, Badge, FormGroup, Label } from '@sveltestrap/sveltestrap';
	import TreeCard from './components/TreeCard.svelte';
	import LeftTimeline from '$lib/components/customTimeline/LeftTimeline.svelte';
	import GanoTreeMap from './components/GanoTreeMap.svelte';
	import FlatPicker from '$lib/components/FlatPicker.svelte';
	import type { Tree, TimelineDataType, TimelineEventType, AppError } from '$lib/types';
	import type { PageData } from './$types';
	import Icon from '@iconify/svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { tick } from 'svelte';

	export let data: PageData;
	
	let treeToFocus: Tree | null = null;

	$: layoutPageData = {
		userSession: $page.data.userSession,
		menuItemsForLayout: $page.data.menuItemsForLayout
	};

	let uiFilterStatus: string | undefined | null;
	let uiFilterStartDate: string | undefined | null;
	let uiFilterEndDate: string | undefined | null;
	let allTrees: Tree[] = [];
	let serverMessage: string | null | undefined;
	let searchTerm = "";
	let viewMode: 'card' | 'table' = 'card';

	let isPhotoModalOpen = false, selectedTreeForPhoto: Tree | null = null;
	let isTimelineModalOpen = false, selectedTreeForTimeline: Tree | null = null;
	let timelineDataForModal: TimelineDataType[] = [];
	let isLoadingTimeline = false, timelineError: string | null = null;
	const defaultTreeImage = '/images/trees/default-tree.jpg';

	function initializeState(currentPageData: PageData) {
		allTrees = currentPageData.trees || [];
		serverMessage = currentPageData.message || null;
		uiFilterStatus = currentPageData.filters?.status;
		uiFilterStartDate = currentPageData.filters?.startDate;
		uiFilterEndDate = currentPageData.filters?.endDate;
	}

	initializeState(data);
	$: initializeState(data);

	$: criticalError = $page.error as AppError | null;

	$: filteredTrees = allTrees.filter(
		(tree) =>
			tree.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
			tree.id?.toLowerCase().includes(searchTerm.toLowerCase())
	);

	function applyFilters() {
		const params = new URLSearchParams();
		if (uiFilterStatus) params.set('status', uiFilterStatus);
		if (uiFilterStartDate) params.set('startDate', uiFilterStartDate);
		if (uiFilterEndDate) params.set('endDate', uiFilterEndDate);
		goto(`?${params.toString()}`, { keepFocus: true, invalidateAll: true });
	}

	function clearFilters() {
		goto('/apps/tree-gano', { keepFocus: true, invalidateAll: true });
	}
    
    function zoomToTree(tree: Tree) {
        treeToFocus = tree;
		// Scroll ke atas halaman agar peta terlihat
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
	
	function openPhotoModal(event: MouseEvent, tree: Tree) {
		event.stopPropagation();
		selectedTreeForPhoto = tree;
		isPhotoModalOpen = true;
	}

	function togglePhotoModal() {
		isPhotoModalOpen = !isPhotoModalOpen;
		if (!isPhotoModalOpen) selectedTreeForPhoto = null;
	}

	async function openTimelineModal(event: MouseEvent, tree: Tree) {
		event.stopPropagation();
		const activeCompanyId = data.companyId;
		if (!activeCompanyId || !tree.id) {
			timelineError = 'ID Perusahaan/Pohon tidak lengkap.';
			return;
		}
		selectedTreeForTimeline = tree;
		isTimelineModalOpen = true;
		isLoadingTimeline = true;
		timelineDataForModal = [];
		timelineError = null;
		try {
			const response = await fetch(`/api/gano-tree-records/${activeCompanyId}/${tree.id}.json`);
			if (!response.ok) {
				throw new Error(`HTTP error ${response.status}`);
			}
			const result: { timelineEvents: TimelineEventType[] } = await response.json();
			const formattedRecords: Record<string, TimelineEventType[]> = {};
			result.timelineEvents.forEach((event) => {
				if (event.originalDateISO) {
					const dateKey = new Date(event.originalDateISO).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
					if (!formattedRecords[dateKey]) { formattedRecords[dateKey] = []; }
					formattedRecords[dateKey].push(event);
				}
			});
			timelineDataForModal = Object.entries(formattedRecords)
				.map(([dateStr, events]) => ({ date: dateStr, events }))
				.sort((a, b) => new Date(b.events[0]?.originalDateISO ?? 0).getTime() - new Date(a.events[0]?.originalDateISO ?? 0).getTime());
		} catch (err: any) {
			timelineError = err.message || 'Gagal memuat riwayat.';
		} finally {
			isLoadingTimeline = false;
			await tick();
		}
	}

	function getStatusDisplay(status: string | undefined): { text: string; badgeText: string; color: string; icon: string; } {
		const s = status?.toLowerCase();
		if (s === 'sick') return { text: 'Sakit (Ganoderma)', badgeText: 'Sakit', color: 'danger', icon: 'mdi:virus-off-outline' };
		if (s === 'recovered') return { text: 'Pulih', badgeText: 'Pulih', color: 'success', icon: 'mdi:leaf-check-outline' };
		if (s === 'maintenance') return { text: 'Perawatan', badgeText: 'Perawatan', color: 'info', icon: 'mdi:tools' };
		return { text: status || 'N/A', badgeText: 'N/A', color: 'secondary', icon: 'mdi:help-circle-outline' };
	}

	function toggleTimelineModal() { isTimelineModalOpen = !isTimelineModalOpen; if (!isTimelineModalOpen) { selectedTreeForTimeline = null; timelineDataForModal = []; timelineError = null; } }
	
    function handleTreeImageError(event: Event) { const target = event.target as HTMLImageElement; target.src = defaultTreeImage; }
</script>

<DefaultLayout data={layoutPageData}>
	<PageBreadcrumb title="Data Pohon GanoAI" subTitle="Aplikasi GanoAI" />

    <div class="page-container">
        {#if criticalError}
            <Alert color="danger" class="mt-2">{criticalError.message || 'Terjadi kesalahan server.'}</Alert>
        {/if}

        <Card class="mb-4">
            <CardBody>
                <Row class="g-3 align-items-end">
                    <Col md="3"><FormGroup class="mb-0"><Label for="status-filter" class="form-label-sm">Filter Status:</Label><Input type="select" id="status-filter" bsSize="sm" bind:value={uiFilterStatus}><option value={undefined}>Semua Status</option><option value="sick">Sakit</option><option value="recovered">Pulih</option><option value="maintenance">Perawatan</option></Input></FormGroup></Col>
                    <Col md="3"><FormGroup class="mb-0"><Label for="start-date-filter" class="form-label-sm">Dari Tanggal:</Label><FlatPicker id="start-date-filter" placeholder="Pilih..." options={{ dateFormat: 'Y-m-d', altInput: true, altFormat: 'd M Y' }} value={uiFilterStartDate ?? undefined} on:change={(e) => uiFilterStartDate = e.detail} class="form-control-sm"/></FormGroup></Col>
                    <Col md="3"><FormGroup class="mb-0"><Label for="end-date-filter" class="form-label-sm">Sampai Tanggal:</Label><FlatPicker id="end-date-filter" placeholder="Pilih..." options={{ dateFormat: 'Y-m-d', altInput: true, altFormat: 'd M Y', minDate: uiFilterStartDate }} value={uiFilterEndDate ?? undefined} on:change={(e) => uiFilterEndDate = e.detail} class="form-control-sm"/></FormGroup></Col>
                    <Col md="3"><FormGroup class="mb-0"><Label class="form-label-sm" style="visibility: hidden;">Aksi</Label><div class="d-flex gap-2"><Button color="primary" size="sm" class="w-100" on:click={applyFilters}><Icon icon="mdi:magnify"/> Terapkan</Button>{#if data.filters?.status || data.filters?.startDate || data.filters?.endDate}<Button color="outline-secondary" size="sm" class="w-100" on:click={clearFilters}><Icon icon="mdi:filter-remove-outline"/> Hapus</Button>{/if}</div></FormGroup></Col>
                </Row>
            </CardBody>
        </Card>

        <Row>
			<Col xs="12" class="mb-4">
				<Card class="h-100">
					<CardBody class="p-0" style="height: 50vh;">
						{#if data.mapboxAccessToken && data.treeDataGeoJSON}
							<GanoTreeMap
								accessToken={data.mapboxAccessToken}
								treeDataGeoJSON={data.treeDataGeoJSON}
								initialViewState={{
									latitude: data.mapCenter.latitude,
									longitude: data.mapCenter.longitude,
									zoom: 15
								}}
								focusedTree={treeToFocus}
							/>
						{:else if data.mapboxAccessToken && !data.treeDataGeoJSON}
							<Alert color="info" class="h-100 d-flex align-items-center justify-content-center m-0 rounded-0"
								>Tidak ada data pohon dengan lokasi yang cocok dengan filter untuk ditampilkan di
								peta.</Alert
							>
						{:else}
							<Alert color="warning" class="h-100 d-flex align-items-center justify-content-center m-0 rounded-0"
								>Token Mapbox tidak dikonfigurasi.</Alert
							>
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
									<Button
										color="primary"
										outline={viewMode !== 'card'}
										on:click={() => (viewMode = 'card')}
										title="Tampilan Kartu"><Icon icon="mdi:view-grid-outline" /></Button
									>
									<Button
										color="primary"
										outline={viewMode !== 'table'}
										on:click={() => (viewMode = 'table')}
										title="Tampilan Tabel"><Icon icon="mdi:view-list-outline" /></Button
									>
								</ButtonGroup>
							</div>
						</div>

						{#if !criticalError && filteredTrees.length > 0}
							{#if viewMode === 'card'}
								<Row class="row-cols-1 row-cols-md-2 row-cols-xl-3 g-3">
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
												<TreeCard
													{tree}
													onViewPhoto={openPhotoModal}
													onViewTimeline={openTimelineModal}
													class="w-100 h-100"
												/>
											</div>
										</Col>
									{/each}
								</Row>
							{/if}
							{#if viewMode === 'table'}
								<div class="table-responsive" style="max-height: 60vh; overflow-y: auto;">
									<Table hover class="table-sm align-middle">
										<thead class="table-light" style="position: sticky; top: 0;">
											<tr><th>Nama Pohon</th><th>Status</th><th class="text-center">Aksi</th></tr>
										</thead>
										<tbody>
											{#each filteredTrees as tree (tree.id)}
												{@const statusInfo = getStatusDisplay(tree.last_status)}
												<tr style="cursor: pointer;" on:click={() => zoomToTree(tree)}>
													<td
														><div>{tree.name || '-'}</div><small
															class="text-muted font-monospace">{tree.id?.substring(0, 8)}</small
														></td
													>
													<td
														><Badge color={statusInfo.color} pill class="px-2 py-1"
															><Icon icon={statusInfo.icon} class="me-1" />{statusInfo.badgeText}</Badge
														></td
													>
													<td class="text-center">
														<ButtonGroup size="sm">
															{#if tree.img}<Button
																	color="light"
																	on:click={(e) => {
																		e.stopPropagation();
																		openPhotoModal(e, tree);
																	}}
																	title="Lihat Foto"><Icon icon="mdi:image-outline" /></Button
																>{/if}
															<Button
																color="light"
																on:click={(e) => {
																	e.stopPropagation();
																	openTimelineModal(e, tree);
																}}
																title="Lihat Riwayat"><Icon icon="mdi:timeline-text-outline" /></Button
															>
														</ButtonGroup>
													</td>
												</tr>
											{/each}
										</tbody>
									</Table>
								</div>
							{/if}
						{:else}
							<p class="text-muted text-center my-5">
								{serverMessage || 'Tidak ada pohon untuk ditampilkan.'}
							</p>
						{/if}
					</CardBody>
				</Card>
			</Col>
		</Row>
    </div>

    {#if selectedTreeForPhoto}
        <Modal isOpen={isPhotoModalOpen} toggle={togglePhotoModal} size="lg" centered scrollable>
            <ModalHeader toggle={togglePhotoModal}>Foto Pohon: {selectedTreeForPhoto.name}</ModalHeader>
            <ModalBody class="text-center">
                {#if selectedTreeForPhoto.img}<img src={selectedTreeForPhoto.img} alt="Foto {selectedTreeForPhoto.name}" class="img-fluid" style="max-height: 75vh; border-radius: 0.25rem;" on:error={handleTreeImageError}/>{:else}<p>Tidak ada foto untuk pohon ini.</p>{/if}
            </ModalBody>
            <div class="modal-footer"><Button color="secondary" outline on:click={togglePhotoModal}>Tutup</Button></div>
        </Modal>
    {/if}
    {#if selectedTreeForTimeline}
        <Modal isOpen={isTimelineModalOpen} toggle={toggleTimelineModal} size="xl" centered scrollable>
            <ModalHeader toggle={toggleTimelineModal}>Riwayat Pohon GanoAI: {selectedTreeForTimeline.name} <small class="text-muted ms-1">({selectedTreeForTimeline.id?.substring(0,8)})</small></ModalHeader>
            <ModalBody>
                {#if isLoadingTimeline}<div class="text-center py-5"><Spinner color="primary" /><p class="mt-2">Memuat riwayat pohon...</p></div>
                {:else if timelineError}<Alert color="danger">{timelineError}</Alert>
                {:else if timelineDataForModal.length > 0}<LeftTimeline timelineItems={timelineDataForModal} treeName="" />
                {:else}<p class="text-muted text-center py-4">Tidak ada data riwayat untuk pohon ini.</p>{/if}
            </ModalBody>
            <div class="modal-footer"><Button color="secondary" outline on:click={toggleTimelineModal}>Tutup</Button></div>
        </Modal>
    {/if}
</DefaultLayout>

<style>
	/* Hapus semua style CSS lama yang berhubungan dengan layout kolom */
	/* Style untuk tree-list-container dan media query yang lama sudah tidak relevan lagi */
</style>