<script lang="ts">
	import DefaultLayout from '$lib/layouts/DefaultLayout.svelte';
	import PageBreadcrumb from '$lib/components/PageBreadcrumb.svelte';
	import MapboxMapSpread from '$lib/components/MapboxMapSpread.svelte';
	import {
		Row,
		Col,
		Card,
		CardBody,
		Alert,
		Spinner,
		Table,
		Button,
		Modal,
		ModalHeader,
		ModalBody,
		ModalFooter,
		FormGroup,
		Label,
		Input
	} from '@sveltestrap/sveltestrap';
	import Icon from '@iconify/svelte';
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';
	import { ToastContainer, toasts } from 'svelte-toasts';
	import type { PageData, ActionData } from './$types';
	import type { Tree } from '$lib/types';

	export let data: PageData;
	export let form: ActionData;

	let isSettingsModalOpen = false;
	let isLoadingForm = false;

	let selectedTree: { tree: Tree; source: { id: string } } | null = null;
	let focusedSickTree: Tree | null = null;

	$: layoutPageData = {
		userSession: $page.data.userSession,
		menuItemsForLayout: $page.data.menuItemsForLayout
	};

	$: criticalError = $page.error;

	function toggleSettingsModal() {
		isSettingsModalOpen = !isSettingsModalOpen;
	}

	function handleRiskRowClick(item: any) {
		focusedSickTree = null;
		if (selectedTree?.tree.id === item.tree.id) {
			selectedTree = null;
		} else {
			selectedTree = item;
		}
	}

	function handleHotspotClick(hotspotTree: Tree) {
		selectedTree = null;
		if (focusedSickTree?.id === hotspotTree.id) {
			focusedSickTree = null;
		} else {
			focusedSickTree = hotspotTree;
		}
	}
</script>

<ToastContainer />

<DefaultLayout data={layoutPageData}>
	<PageBreadcrumb title="Analisis Potensi Penyebaran Ganoderma" subTitle="Aplikasi GanoAI" />

	{#if criticalError}
		<Alert color="danger" class="mt-3">
			<h4 class="alert-heading">Terjadi Kesalahan</h4>
			<p>{criticalError.message}</p>
		</Alert>
	{:else if data.message}
		<Alert color="info" class="mt-3 text-center">{data.message}</Alert>
	{:else if data}
		<div class="d-flex justify-content-end mb-3 d-print-none">
			<Button color="primary" on:click={() => window.print()}>
				<Icon icon="mdi:printer-outline" class="me-1" /> Cetak Laporan
			</Button>
		</div>

		<Row>
			<Col xl="5" class="d-flex flex-column">
				<Card class="mb-4 shadow-sm flex-shrink-0 d-print-block">
					<CardBody>
						<div class="d-flex justify-content-between align-items-start mb-3">
							<div>
								<h5 class="card-title mb-0">
									<Icon icon="mdi:finance" class="text-success me-1" /> Analisis Skenario &
									ROI
								</h5>
								<small class="text-muted">Proyeksi Dampak Finansial dari Mitigasi</small>
							</div>
							<Button
								size="sm"
								color="light"
								class="btn-icon d-print-none"
								on:click={toggleSettingsModal}
								title="Ubah Parameter"
							>
								<Icon icon="mdi:cog" />
							</Button>
						</div>

						{#if data.financialImpact}
							<div class="border rounded p-3 mb-3 bg-danger-subtle">
								<h6 class="text-danger-emphasis text-uppercase fs-sm">
									Skenario A: Tanpa Intervensi
								</h6>
								<p class="fs-xs text-muted mb-2">
									Total potensi kerugian pendapatan jika tidak ada tindakan yang diambil.
								</p>
								<div class="text-center">
									<div class="fw-bold text-danger display-6">
										Rp {Math.round(
											data.financialImpact.totalProyeksiKerugianPendapatan
										).toLocaleString('id-ID')}
									</div>
								</div>

								{#if data.financialImpact.yearlyBreakdown && data.financialImpact.yearlyBreakdown.length > 0}
									<div class="table-responsive mt-3">
										<Table size="sm" bordered class="text-center bg-white">
											<thead class="table-light">
												<tr>
													{#each data.financialImpact.yearlyBreakdown as _, i}
														<th>Tahun ke-{i + 1}</th>
													{/each}
												</tr>
											</thead>
											<tbody>
												<tr>
													{#each data.financialImpact.yearlyBreakdown as yearlyLoss}
														<td class="fw-medium fs-xs"
															>Rp {Math.round(yearlyLoss).toLocaleString('id-ID')}</td
														>
													{/each}
												</tr>
											</tbody>
										</Table>
									</div>
								{/if}
							</div>

							<div class="border rounded p-3 bg-success-subtle">
								<h6 class="text-success-emphasis text-uppercase fs-sm">
									Skenario B: Intervensi Penuh
								</h6>
								<ul class="list-unstyled fs-sm mb-0">
									<li class="d-flex justify-content-between">
										<span class="text-muted">Estimasi Biaya (Investasi):</span>
										<span class="fw-medium text-dark"
											>Rp
											{Math.round(
												data.financialImpact.totalEstimasiBiayaPerawatan
											).toLocaleString('id-ID')}</span
										>
									</li>
									<li class="d-flex justify-content-between">
										<span class="text-muted">Pendapatan Diselamatkan:</span>
										<span class="fw-medium text-dark"
											>Rp
											{Math.round(
												data.financialImpact.potensiPendapatanDiselamatkan
											).toLocaleString('id-ID')}</span
										>
									</li>
									<li class="d-flex justify-content-between border-top mt-1 pt-1">
										<span class="fw-bold">Hasil Bersih (Net):</span>
										<span
											class="fw-bold {data.financialImpact.hasilBersihIntervensi >= 0
												? 'text-success'
												: 'text-danger'}"
											>Rp
											{Math.round(data.financialImpact.hasilBersihIntervensi).toLocaleString(
												'id-ID'
											)}</span
										>
									</li>
								</ul>
							</div>
							<div class="text-center bg-primary-subtle rounded p-3 mt-3">
								<h6 class="text-primary-emphasis text-uppercase fs-sm mb-1">
									Proyeksi Return on Investment (ROI)
								</h6>
								<h2
									class="fw-bold text-primary mb-0 display-5 {data.financialImpact.proyeksiROI < 0
										? 'text-danger'
										: ''}"
								>
									{data.financialImpact.proyeksiROI.toFixed(1)}%
								</h2>
								<small class="text-muted"
									>Return dari setiap rupiah yang diinvestasikan untuk perawatan.</small
								>
							</div>
						{/if}
					</CardBody>
				</Card>

				<Card class="mb-4 shadow-sm flex-shrink-0 d-print-block">
					<CardBody>
						<h5 class="card-title mb-3">
							<Icon icon="mdi:fire" class="text-danger me-1" /> Hotspot Penyebaran Kritis
						</h5>
						{#if data.hotspots && data.hotspots.length > 0 && data.stats.hotspotCount > 0}
							<div class="list-group list-group-flush">
								{#each data.hotspots as hotspot (hotspot.sickTree.id)}
									{#if hotspot.criticalThreatsCount > 0}
										<div
											class="list-group-item list-group-item-action px-0"
											on:click={() => handleHotspotClick(hotspot.sickTree)}
											style="cursor: pointer;"
											role="button"
											tabindex="0"
											on:keydown={(e) => e.key === 'Enter' && handleHotspotClick(hotspot.sickTree)}
										>
											<div class="d-flex align-items-center">
												<div class="flex-shrink-0">
													<Icon icon="mdi:tree" class="fs-4 text-danger" />
												</div>
												<div class="flex-grow-1 ms-3">
													<h6 class="mb-0 fw-bold">{hotspot.sickTree.name}</h6>
													<small class="text-muted"
														>ID: {hotspot.sickTree.id?.substring(0, 8)}...</small
													>
												</div>
												<div class="text-end">
													<span class="badge bg-danger-subtle text-danger-emphasis fs-6"
														>{hotspot.criticalThreatsCount} Pohon</span
													>
													<small class="d-block text-muted">di Zona Kritis</small>
												</div>
											</div>
										</div>
									{/if}
								{/each}
							</div>
						{:else}
							<p class="text-muted text-center my-3">
								Tidak ada hotspot penyebaran kritis yang teridentifikasi.
							</p>
						{/if}
					</CardBody>
				</Card>
				<Card class="mb-4 shadow-sm flex-grow-1 d-print-block">
					<CardBody>
						<h5 class="card-title mb-3">
							<Icon icon="mdi:format-list-bulleted-square" class="text-primary me-1" />Daftar
							Pohon Berisiko
						</h5>
						{#if data.criticalZoneTrees.length > 0}
							<h6 class="text-danger">Zona Kritis ({data.stats.criticalCount} pohon)</h6>
							<div class="table-responsive" style="max-height: 250px; overflow-y: auto;">
								<Table hover size="sm" class="table-middle mb-0">
									<tbody>
										{#each data.criticalZoneTrees as item (item.tree.id)}
											<tr
												on:click={() => handleRiskRowClick(item)}
												class:table-info={selectedTree?.tree.id === item.tree.id}
												style="cursor: pointer;"
											>
												<td>{item.tree.name}</td>
												<td class="text-muted text-nowrap">dari {item.source.name}</td>
												<td class="text-end fw-bold text-danger">{item.source.distance} m</td>
											</tr>
										{/each}
									</tbody>
								</Table>
							</div>
						{/if}
						{#if data.warningZoneTrees.length > 0}
							<h6 class="text-warning mt-3">Zona Waspada ({data.stats.warningCount} pohon)</h6>
							<div class="table-responsive" style="max-height: 250px; overflow-y: auto;">
								<Table hover size="sm" class="table-middle mb-0">
									<tbody>
										{#each data.warningZoneTrees as item (item.tree.id)}
											<tr
												on:click={() => handleRiskRowClick(item)}
												class:table-info={selectedTree?.tree.id === item.tree.id}
												style="cursor: pointer;"
											>
												<td>{item.tree.name}</td>
												<td class="text-muted text-nowrap">dari {item.source.name}</td>
												<td class="text-end fw-medium">{item.source.distance} m</td>
											</tr>
										{/each}
									</tbody>
								</Table>
							</div>
						{/if}
					</CardBody>
				</Card>
			</Col>

			<Col xl="7" class="d-print-none">
				<Card class="h-100 shadow-sm">
					<div
						style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column;"
					>
						<CardBody class="flex-grow-1 d-flex flex-column">
							<h5 class="card-title mb-3">Peta Visualisasi Sebaran</h5>
							{#if data.mapboxAccessToken}
								<div style="flex-grow: 1; position: relative;">
									<MapboxMapSpread
										accessToken={data.mapboxAccessToken}
										sickTrees={data.sickTrees}
										criticalZoneTrees={data.criticalZoneTrees.map((i) => i.tree)}
										warningZoneTrees={data.warningZoneTrees.map((i) => i.tree)}
										{selectedTree}
										{focusedSickTree}
									/>
								</div>
							{:else}
								<Alert color="warning">Token Mapbox tidak dikonfigurasi.</Alert>
							{/if}
						</CardBody>
					</div>
				</Card>
			</Col>
		</Row>
	{:else}
		<div class="text-center py-5"><Spinner /><p class="mt-2 text-muted">Memuat data...</p></div>
	{/if}

	{#if data.financialImpact}
		<Modal isOpen={isSettingsModalOpen} toggle={toggleSettingsModal} centered>
			<ModalHeader toggle={toggleSettingsModal}>Ubah Parameter Kalkulasi Finansial</ModalHeader>
			<form
				method="POST"
				action="?/updateSettings"
				use:enhance={() => {
					isLoadingForm = true;
					return async ({ result, update }) => {
						if (result.type === 'success') {
							toasts.success(result.data?.message || 'Berhasil disimpan!');
							isSettingsModalOpen = false;
						} else if (result.type === 'failure') {
							toasts.error(result.data?.message || 'Gagal menyimpan.');
						}
						await update({ reset: false });
						isLoadingForm = false;
					};
				}}
			>
				<ModalBody>
					{#if form?.message}<Alert color="danger">{form.message}</Alert>{/if}
					<FormGroup>
						<Label for="hargaTbsPerKg">Harga TBS per kg (Rp)</Label>
						<Input
							id="hargaTbsPerKg"
							name="hargaTbsPerKg"
							type="number"
							step="50"
							value={data.financialImpact.parameter.hargaTbsPerKg}
						/>
					</FormGroup>
					<FormGroup>
						<Label for="biayaPerPohon">Biaya Perawatan per Pohon (Rp)</Label>
						<Input
							id="biayaPerPohon"
							name="biayaPerPohon"
							type="number"
							step="1000"
							value={data.financialImpact.parameter.biayaPerPohon}
						/>
					</FormGroup>
					<FormGroup>
						<Label for="produksiTbsTahunanPerPohon">Produksi TBS Tahunan per Pohon (kg)</Label>
						<Input
							id="produksiTbsTahunanPerPohon"
							name="produksiTbsTahunanPerPohon"
							type="number"
							step="1"
							value={data.financialImpact.parameter.produksiTbsTahunanPerPohon}
						/>
					</FormGroup>
					<FormGroup>
						<Label for="tingkatDiskontoTahunan"
							>Tingkat Diskonto Tahunan (contoh: 0.08 untuk 8%)</Label
						>
						<Input
							id="tingkatDiskontoTahunan"
							name="tingkatDiskontoTahunan"
							type="number"
							step="0.01"
							min="0"
							max="1"
							value={data.financialImpact.parameter.tingkatDiskontoTahunan}
						/>
					</FormGroup>
					<FormGroup>
						<Label for="probabilitasInfeksiKritis"
							>Peluang Infeksi Zona Kritis (contoh: 0.5 untuk 50%)</Label
						>
						<Input
							id="probabilitasInfeksiKritis"
							name="probabilitasInfeksiKritis"
							type="number"
							step="0.05"
							min="0"
							max="1"
							value={data.financialImpact.parameter.probabilitasInfeksiKritis}
						/>
					</FormGroup>
					<FormGroup>
						<Label for="kurvaPenurunanHasil">Kurva Penurunan Hasil per Tahun (dipisah koma)</Label>
						<Input
							id="kurvaPenurunanHasil"
							name="kurvaPenurunanHasil"
							type="text"
							value={data.financialImpact.parameter.kurvaPenurunanHasil.join(', ')}
						/>
						<small class="text-muted">Contoh: 0.2, 0.5, 0.8, 1.0 untuk 4 tahun</small>
					</FormGroup>
				</ModalBody>
				<ModalFooter>
					<Button color="secondary" on:click={toggleSettingsModal} disabled={isLoadingForm}
						>Batal</Button
					>
					<Button color="primary" type="submit" disabled={isLoadingForm}>
						{#if isLoadingForm}<Spinner size="sm" class="me-1" /> Menyimpan...{:else}Simpan
							Perubahan{/if}
					</Button>
				</ModalFooter>
			</form>
		</Modal>
	{/if}
</DefaultLayout>

<style>
	.fs-sm {
		font-size: 0.85rem;
	}
	.fs-xs {
		font-size: 0.75rem;
	}
	/* ... (sisa CSS @media print tidak berubah) ... */
	@media print {
		:global(.main-nav),
		:global(.topbar),
		:global(.page-title-box),
		:global(footer),
		.d-print-none {
			display: none !important;
		}
		:global(body) {
			background-color: white !important;
		}
		:global(.page-content) {
			margin: 0 !important;
			padding: 1.5cm !important;
		}
		:global(.row) {
			display: block !important;
		}
		:global(.col-xl-5) {
			width: 100% !important;
			max-width: 100% !important;
			flex-basis: 100% !important;
		}
		:global(.d-print-block.card) {
			page-break-inside: avoid;
			box-shadow: none !important;
			border: none !important;
			margin-bottom: 1rem !important;
		}
		:global(.d-print-block .list-group-item) {
			border: none !important;
		}
		:global(.table-responsive) {
			overflow: visible !important;
		}
		:global(table) {
			border-collapse: collapse !important;
		}
		:global(.table th),
		:global(.table td) {
			padding: 8px 12px !important;
			white-space: normal !important;
			border: none !important;
		}
	}
</style>