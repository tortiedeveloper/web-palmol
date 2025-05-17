<script lang="ts">
    import DefaultLayout from "$lib/layouts/DefaultLayout.svelte";
    import PageBreadcrumb from "$lib/components/PageBreadcrumb.svelte";
    import { Row, Col, Input, Button, ButtonGroup, Table, Modal, ModalHeader, ModalBody, Alert, Card, CardHeader, CardBody, FormGroup, Label, Badge, Spinner } from "@sveltestrap/sveltestrap";
    import type { PKSReport, AppError } from '$lib/types';
    import type { PageData } from "./$types";
    import Icon from '@iconify/svelte';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import FlatPicker from '$lib/components/FlatPicker.svelte';

    interface FilterChoiceClient { id: string; name: string; }

    export let data: PageData;

    let reportList: PKSReport[] = [];
    let totalBeratKeseluruhan: number = 0;
    let serverMessage: string | null | undefined;
    let companyName: string | undefined;
    
    let availablePksList: FilterChoiceClient[] = [];
    let availableTeamList: FilterChoiceClient[] = [];
    
    let uiSelectedPksId: string | undefined = undefined; 
    let uiSelectedTeamId: string | undefined = undefined;
    let uiSelectedStartDate: string | undefined = undefined; 
    let uiSelectedEndDate: string | undefined = undefined;   
    
    let activeIsCurrentlyFiltered: boolean = false;
    let clientSideError: AppError | null = null;

    let isImageModalOpen = false;
    let selectedImageUrl: string | null = null;
    let selectedImageTitle = "Bukti Laporan";
    let viewMode: 'table' | 'card' = 'table';

    let initialLoadComplete = false;

    function syncUiWithActiveData(currentData: PageData) {
        reportList = currentData.reportList || [];
        totalBeratKeseluruhan = currentData.totalBeratKeseluruhan || 0;
        serverMessage = currentData.message;
        companyName = currentData.companyName || "Perusahaan Anda";
        availablePksList = currentData.pksListForFilter || [];
        availableTeamList = currentData.teamListForFilter || []; 
        
        uiSelectedPksId = currentData.selectedPksId ?? undefined;
        uiSelectedTeamId = currentData.selectedTeamId ?? undefined;
        uiSelectedStartDate = currentData.startDate ?? undefined;
        uiSelectedEndDate = currentData.endDate ?? undefined;
        activeIsCurrentlyFiltered = currentData.isCurrentlyFiltered ?? false;
    }

    onMount(() => {
        if (data) {
            syncUiWithActiveData(data);
            initialLoadComplete = true;
        }
    });
    
    $: if (data && initialLoadComplete) {
        syncUiWithActiveData(data);
    }
    
    $: clientSideError = $page.error as AppError | null;

    $: filterUiHasValues = !!uiSelectedPksId || !!uiSelectedTeamId || !!uiSelectedStartDate || !!uiSelectedEndDate;
    $: canApplyFilterButtonActive = filterUiHasValues;


    function applyAllUiFilters() {
        const params = new URLSearchParams();
        
        if (uiSelectedStartDate && uiSelectedEndDate && (new Date(uiSelectedStartDate) > new Date(uiSelectedEndDate))) {
            alert("Tanggal awal tidak boleh melebihi tanggal akhir."); return;
        }
        if (uiSelectedStartDate) params.set('startDate', uiSelectedStartDate);
        if (uiSelectedEndDate) params.set('endDate', uiSelectedEndDate);
        if (uiSelectedPksId) {
            params.set('pksId', uiSelectedPksId);
            if (uiSelectedTeamId) params.set('teamId', uiSelectedTeamId);
        }
        
        const queryString = params.toString();
        const targetUrl = `/apps/reports-palmol${queryString ? '?' + queryString : ''}`;
        const currentFullUrl = $page.url.href;
        const targetFullUrl = new URL(targetUrl, $page.url.origin).href;

        if (currentFullUrl !== targetFullUrl) {
            goto(targetUrl, { invalidateAll: true, keepFocus: true });
        } else if (filterUiHasValues && !activeIsCurrentlyFiltered) {
             goto(targetUrl, { invalidateAll: true, keepFocus: true });
        } else if (!filterUiHasValues && activeIsCurrentlyFiltered) {
            clearAllUiFilters();
        }
    }

    function clearAllUiFilters() {
        goto(`/apps/reports-palmol`, { invalidateAll: true, keepFocus: true });
    }
    
    function handlePksUiChange(event: Event) {
        const target = event.target as HTMLSelectElement;
        const newPksId = target.value === "undefined" ? undefined : target.value;
        uiSelectedPksId = newPksId;
        uiSelectedTeamId = undefined; 
        
        // Langsung terapkan filter PKS untuk memuat daftar tim
        applyAllUiFilters(); 
    }

    function handleTeamUiChange(event: Event) {
        const target = event.target as HTMLSelectElement;
        uiSelectedTeamId = target.value === "undefined" ? undefined : target.value;
    }
    function handleStartDateUiChange(event: CustomEvent<string>) {
        uiSelectedStartDate = event.detail;
    }
    function handleEndDateUiChange(event: CustomEvent<string>) {
        uiSelectedEndDate = event.detail;
    }

    function openImageModal(imageUrl: string, reportDate: string) {
        selectedImageUrl = imageUrl;
        selectedImageTitle = `Bukti Laporan - ${reportDate}`;
        isImageModalOpen = true;
    }

    function toggleImageModal() {
        isImageModalOpen = !isImageModalOpen;
        if (!isImageModalOpen) { selectedImageUrl = null; }
    }

    $: if ($page.error && clientSideError !== $page.error) { 
        clientSideError = $page.error as AppError | null;
    }

    function handleImageError(event: Event) {
        const target = event.target as HTMLImageElement;
        target.style.display = 'none';
        const placeholder = target.parentElement?.querySelector('.report-card-img-placeholder');
        if (placeholder) (placeholder as HTMLElement).style.display = 'flex';
    }
</script>

<DefaultLayout {data}>
    <PageBreadcrumb 
        title={`Laporan Palmol - ${data.currentPksNameForDisplay || 'Semua PKS'}${data.selectedTeamId && data.currentTeamNameForDisplay && data.currentTeamNameForDisplay !== 'Semua Tim di PKS ini' && data.currentTeamNameForDisplay !== 'Semua Tim' ? ' / ' + data.currentTeamNameForDisplay : (data.selectedPksId && !data.selectedTeamId && data.currentPksNameForDisplay !== 'Semua PKS' ? ' / Semua Tim' : '')}`} 
        subTitle="Aplikasi Palmol" 
    />

    <main class="reports-page-main-content pt-3">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h1 class="h3 mb-0 text-dark">
                Laporan Kinerja Palmol
                {#if data.currentPksNameForDisplay && data.currentPksNameForDisplay !== 'Semua PKS'}
                    <span class="fs-5 text-muted"> / {data.currentPksNameForDisplay}</span>
                    {#if data.selectedTeamId && data.currentTeamNameForDisplay && data.currentTeamNameForDisplay !== 'Semua Tim di PKS ini' && data.currentTeamNameForDisplay !== 'Semua Tim'}
                        <span class="fs-6 text-muted"> / {data.currentTeamNameForDisplay}</span>
                    {/if}
                {/if}
            </h1>
            <Button outline color="secondary" size="sm" href="/dashboards/analytics-ripeness">
                <Icon icon="mdi:arrow-left" class="me-1"/> Dashboard
            </Button>
        </div>

        <Card class="mb-4 shadow-sm">
            <CardHeader class="bg-light">
                <h5 class="card-title mb-0 fs-1rem"><Icon icon="mdi:filter-variant" class="me-2 text-primary"/>Filter Laporan</h5>
            </CardHeader>
            <CardBody>
                <Row class="g-3 align-items-end">
                    <Col xl="3" lg="6" md="6">
                        <FormGroup class="mb-md-0">
                            <Label for="pks-filter-main" class="form-label-sm">Pilih PKS:</Label>
                            <Input 
                                type="select" 
                                id="pks-filter-main" 
                                bsSize="sm" 
                                value={uiSelectedPksId ?? "undefined"} 
                                on:change={handlePksUiChange}
                            >
                                <option value="undefined">Semua PKS</option>
                                {#each availablePksList as pksItem (pksItem.id)}
                                    <option value={pksItem.id}>{pksItem.name}</option>
                                {/each}
                            </Input>
                        </FormGroup>
                    </Col>
                    <Col xl="3" lg="6" md="6">
                        <FormGroup class="mb-md-0">
                            <Label for="team-filter-main" class="form-label-sm">Pilih Tim:</Label>
                            <Input 
                                type="select" 
                                id="team-filter-main" 
                                bsSize="sm" 
                                value={uiSelectedTeamId ?? "undefined"}
                                on:change={handleTeamUiChange}
                                disabled={!uiSelectedPksId || availableTeamList.length === 0}
                            >
                                <option value="undefined">Semua Tim</option> 
                                {#if uiSelectedPksId && availableTeamList.length > 0}
                                    {#each availableTeamList as teamItem (teamItem.id)}
                                        <option value={teamItem.id}>{teamItem.name}</option>
                                    {/each}
                                {:else if uiSelectedPksId && availableTeamList.length === 0}
                                    <option value="undefined" disabled>Tidak ada tim</option>
                                {/if}
                            </Input>
                        </FormGroup>
                    </Col>
                    <Col xl="2" lg="4" md="6">
                        <FormGroup class="mb-md-0">
                            <Label for="startDate-picker-all" class="form-label-sm">Tgl Awal:</Label>
                            <FlatPicker id="startDate-picker-all" placeholder="Pilih..." options={{ dateFormat: 'Y-m-d', altInput: true, altFormat: 'd M Y' }} value={uiSelectedStartDate} on:change={handleStartDateUiChange} class="form-control-sm" />
                        </FormGroup>
                    </Col>
                    <Col xl="2" lg="4" md="6">
                        <FormGroup class="mb-md-0">
                            <Label for="endDate-picker-all" class="form-label-sm">Tgl Akhir:</Label>
                            <FlatPicker id="endDate-picker-all" placeholder="Pilih..." options={{ dateFormat: 'Y-m-d', altInput: true, altFormat: 'd M Y', minDate: uiSelectedStartDate }} value={uiSelectedEndDate} on:change={handleEndDateUiChange} class="form-control-sm"/>
                        </FormGroup>
                    </Col>
                    <Col xl="2" lg="4" md="12" class="d-flex gap-2 mt-3 mt-lg-0 align-self-end">
                        <Button color="primary" size="sm" on:click={applyAllUiFilters} class="w-100" disabled={!canApplyFilterButtonActive}><Icon icon="mdi:check-circle-outline" class="me-1"/>Terapkan</Button>
                        {#if activeIsCurrentlyFiltered} 
                            <Button color="outline-secondary" size="sm" on:click={clearAllUiFilters} class="w-100"><Icon icon="mdi:filter-variant-remove" class="me-1"/>Hapus</Button>
                        {/if}
                    </Col>
                </Row>
            </CardBody>
        </Card>

        {#if clientSideError}
            <Alert color="danger" class="shadow-sm">
                <h4 class="alert-heading"><Icon icon="mdi:alert-octagon-outline" class="me-2"/>Terjadi Kesalahan</h4>
                <p>Tidak dapat memuat data laporan. {#if typeof clientSideError === 'object' && clientSideError !== null && clientSideError.message}<br/><small>Detail: {clientSideError.message}{clientSideError.status ? ` (${clientSideError.status})` : ''}</small>{/if}</p>
            </Alert>
        {:else}
            <Card class="shadow-sm">
                <CardHeader class="bg-light d-flex flex-wrap justify-content-between align-items-center">
                    <h5 class="card-title mb-0 fs-1rem me-auto">
                        <Icon icon="mdi:file-document-multiple-outline" class="me-2 text-primary"/>Daftar Laporan
                        {#if data.currentPksNameForDisplay && data.currentPksNameForDisplay !== 'Semua PKS'}
                             ({data.currentPksNameForDisplay}
                            {#if data.selectedTeamId && data.currentTeamNameForDisplay && data.currentTeamNameForDisplay !== 'Semua Tim di PKS ini' && data.currentTeamNameForDisplay !== 'Semua Tim'}
                                / {data.currentTeamNameForDisplay}
                            {/if})
                        {/if}
                    </h5>
                    <div class="d-flex align-items-center gap-2 mt-2 mt-md-0">
                        {#if activeIsCurrentlyFiltered && uiSelectedStartDate && uiSelectedEndDate}
                            <Badge color="info" pill class="px-2 py-1 fs-xs d-none d-sm-inline-block">
                                Tgl: {new Date(uiSelectedStartDate + 'T00:00:00Z').toLocaleDateString('id-ID', {day:'2-digit', month:'short'})} - 
                                {new Date(uiSelectedEndDate + 'T00:00:00Z').toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric'})}
                            </Badge>
                        {:else if activeIsCurrentlyFiltered && uiSelectedStartDate }
                             <Badge color="info" pill class="px-2 py-1 fs-xs d-none d-sm-inline-block">Mulai: {new Date(uiSelectedStartDate + 'T00:00:00Z').toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric'})}</Badge>
                        {:else if activeIsCurrentlyFiltered && uiSelectedEndDate }
                             <Badge color="info" pill class="px-2 py-1 fs-xs d-none d-sm-inline-block">Hingga: {new Date(uiSelectedEndDate + 'T00:00:00Z').toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric'})}</Badge>
                        {/if}
                        <ButtonGroup size="sm">
                            <Button color="primary" outline={viewMode !== 'table'} on:click={() => viewMode = 'table'} title="Tampilan Tabel"><Icon icon="mdi:table"/></Button>
                            <Button color="primary" outline={viewMode !== 'card'} on:click={() => viewMode = 'card'} title="Tampilan Kartu"><Icon icon="mdi:view-grid-outline"/></Button>
                        </ButtonGroup>
                    </div>
                </CardHeader>
                <CardBody>
                    <div class="reports-summary mb-3 pb-3 border-bottom">
                        {#if reportList && reportList.length > 0}
                            <Row>
                                <Col sm="6" class="mb-2 mb-sm-0">Total Laporan: <strong class="text-primary">{reportList.length}</strong></Col>
                                <Col sm="6" class="text-sm-end">Total Berat Keseluruhan: <strong class="text-success">{(totalBeratKeseluruhan ?? 0).toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kg</strong></Col>
                            </Row>
                        {:else if serverMessage}
                             <Alert color="info" class="text-center mb-0 py-2"><Icon icon="mdi:information-outline" class="me-2" style="font-size: 1.1rem; vertical-align: -2px;"/>{serverMessage}</Alert>
                        {:else if !activeIsCurrentlyFiltered && (!reportList || reportList.length === 0)}
                            <Alert color="secondary" class="text-center mb-0 py-2">Belum ada laporan yang ditemukan.</Alert>
                        {/if}
                    </div>

                    {#if reportList && reportList.length > 0}
                        {#if viewMode === 'table'}
                            <div class="table-responsive">
                                <Table hover class="table-sm align-middle text-nowrap">
                                    <thead class="table-light">
                                        <tr>
                                            <th style="width: 50px;">No.</th><th>PKS</th><th>Tim</th><th>Tanggal Laporan</th>
                                            <th class="text-end">Berat (kg)</th><th>Pelapor</th><th class="text-center">Bukti</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {#each reportList as report, i (report.id)}
                                            <tr>
                                                <td>{i + 1}</td>
                                                <td class="text-muted" title={report.pksName || report.pksId}>{report.pksName || (report.pksId ? report.pksId.substring(0,8) : 'N/A')}{report.pksName && report.pksName.length > 20 ? '...' : (report.pksId && report.pksId.length > 8 && !report.pksName ? '...' : '')}</td>
                                                <td class="text-muted" title={report.teamName || report.teamId}>{report.teamName || (report.teamId ? `${report.teamId.substring(0,6)}..` : (report.pksId && !report.teamId ? 'Laporan PKS' : 'N/A'))}</td>
                                                <td>{report.date}</td>
                                                <td class="text-end fw-medium">{(report.jumlahBerat ?? 0).toLocaleString("id-ID")}</td>
                                                <td><Icon icon="mdi:account-circle-outline" class="me-1 text-primary" style="font-size: 1.1em; vertical-align: -2px;"/>{report.userName || report.userId}</td>
                                                <td class="text-center">
                                                    {#if report.img}
                                                        <Button size="sm" color="outline-secondary" class="btn-icon" title="Lihat Bukti Gambar" on:click={() => { if (report.img) openImageModal(report.img, report.date); }}>
                                                            <Icon icon="mdi:image-search-outline"/>
                                                        </Button>
                                                    {:else}<span class="text-muted fs-xs">-</span>{/if}
                                                </td>
                                            </tr>
                                        {/each}
                                    </tbody>
                                </Table>
                            </div>
                        {:else if viewMode === 'card'}
                            <Row class="row-cols-1 row-cols-sm-2 row-cols-lg-3 row-cols-xl-4 g-3">
                                {#each reportList as report, i (report.id)}
                                    <Col>
                                        <Card class="h-100 shadow-sm report-card card-hover-lift-sm">
                                            {#if report.img}
                                                <a href={report.img} target="_blank" rel="noopener noreferrer" on:click|preventDefault={() => { if(report.img) openImageModal(report.img, report.date)}} style="text-decoration: none; display: block; height: 180px; overflow: hidden; background-color: #f8f9fa;" class="report-card-image-link">
                                                    <img src={report.img} alt="Bukti Laporan {i+1}" class="card-img-top report-card-img" on:error={handleImageError}/>
                                                    <div class="report-card-img-placeholder d-none align-items-center justify-content-center" style="height: 100%;"><Icon icon="mdi:image-off-outline" style="font-size: 3rem; color: #ccc;"/></div>
                                                </a>
                                            {:else}
                                                <div class="report-card-img-placeholder d-flex align-items-center justify-content-center bg-light" style="height: 180px;"><Icon icon="mdi:image-off-outline" style="font-size: 3rem; color: #ccc;"/></div>
                                            {/if}
                                            <CardBody class="d-flex flex-column p-3">
                                                <div class="mb-1">
                                                    <Badge color="soft-primary" class="me-1 fs-xs p-1 px-2 text-truncate" title={report.pksName || report.pksId}><Icon icon="mdi:factory" class="me-1" style="vertical-align: -1px;"/>PKS: {report.pksName || (report.pksId ? report.pksId.substring(0,8) : 'N/A')}</Badge>
                                                    {#if report.teamId && report.teamName !== 'Laporan Level PKS'}
                                                    <Badge color="soft-info" class="fs-xs p-1 px-2 text-truncate" title={report.teamName || report.teamId}><Icon icon="mdi:account-group" class="me-1" style="vertical-align: -1px;"/>Tim: {report.teamName || (report.teamId ? report.teamId.substring(0,8) : 'N/A')}</Badge>
                                                    {/if}
                                                </div>
                                                <p class="fs-sm text-muted mb-2"><Icon icon="mdi:calendar-range" class="me-1"/>{report.date}</p>
                                                <div class="mb-2 text-center"><span class="fw-bold fs-4 text-success">{(report.jumlahBerat ?? 0).toLocaleString("id-ID")}</span><span class="text-muted ms-1 fs-sm">kg</span></div>
                                                <p class="fs-xs text-muted mb-2 text-center text-truncate" title={report.userName || report.userId}><Icon icon="mdi:account-outline" class="me-1"/>Pelapor: {report.userName || report.userId}</p>
                                                {#if report.img}
                                                <Button size="sm" color="primary" outline class="mt-auto w-100 btn-icon" on:click={() => { if (report.img) openImageModal(report.img, report.date)}}><Icon icon="mdi:image-search-outline" class="me-1"/>Lihat Bukti</Button>
                                                {/if}
                                            </CardBody>
                                        </Card>
                                    </Col>
                                {/each}
                            </Row>
                        {/if}
                    {:else if !serverMessage && !clientSideError} 
                        <div class="text-center py-4"> <Spinner color="primary"/> <p class="mt-2 text-muted">Memuat data laporan...</p> </div>
                    {/if}
                </CardBody>
            </Card>
        {/if}
    </main>

    {#if selectedImageUrl}
        <Modal bind:isOpen={isImageModalOpen} toggle={toggleImageModal} size="lg" centered scrollable>
            <ModalHeader toggle={toggleImageModal}>{selectedImageTitle}</ModalHeader>
            <ModalBody class="text-center p-4"><img src={selectedImageUrl} alt={selectedImageTitle} class="img-fluid rounded" style="max-height: 75vh;" /></ModalBody>
            <div class="modal-footer"><Button color="secondary" outline on:click={toggleImageModal}>Tutup</Button></div>
        </Modal>
    {/if}
</DefaultLayout>

<style>
    .reports-summary strong { font-size: 1.05em; }
    .fs-xs { font-size: 0.75rem; }
    .fs-sm { font-size: 0.875rem; }
    .fs-1rem { font-size: 1rem !important; }
    :global(input.form-control-sm.flatpickr-input) { height: calc(1.5em + 0.5rem + 2px); padding: 0.25rem 0.5rem; font-size: 0.875rem; }
    .report-card-img { width: 100%; height: 180px; object-fit: cover; border-bottom: 1px solid var(--bs-border-color-translucent); }
    .report-card-image-link:hover .report-card-img { opacity: 0.85; transition: opacity 0.2s ease-in-out; }
    .report-card-img-placeholder { border-bottom: 1px solid var(--bs-border-color-translucent); }
</style>