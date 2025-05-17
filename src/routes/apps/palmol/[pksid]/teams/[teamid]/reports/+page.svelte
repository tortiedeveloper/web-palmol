<script lang="ts">
    import DefaultLayout from "$lib/layouts/DefaultLayout.svelte";
    import PageBreadcrumb from "$lib/components/PageBreadcrumb.svelte";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import type { PageData } from "./$types";
    import type { PKSReport, AppError } from '$lib/types';
    import { Row, Col, Card, CardHeader, CardBody, Table, Button, FormGroup, Label, Input, Alert, Spinner, Modal, ModalHeader, ModalBody, Badge, ButtonGroup } from "@sveltestrap/sveltestrap"; // Tambahkan ButtonGroup
    import Icon from '@iconify/svelte';
    import FlatPicker from '$lib/components/FlatPicker.svelte';

    export let data: PageData;

    let pksId: string | undefined;
    let teamId: string | undefined;
    let namaPKS: string | undefined;
    let teamName: string | undefined;
    let reportList: PKSReport[] = [];
    let totalBeratTim: number | undefined;
    let message: string | null | undefined;
    
    let selectedStartDate: string | undefined = undefined; 
    let selectedEndDate: string | undefined = undefined;   
    let isCurrentlyFiltered: boolean | undefined;
    
    let serverError: AppError | null = null;

    let isImageModalOpen = false;
    let selectedImageUrl: string | null = null;
    let selectedImageTitle = "Bukti Laporan";

    // State untuk mode tampilan
    let viewMode: 'table' | 'card' = 'table'; // Default ke tampilan tabel

    $: if (data) {
        pksId = data.pksId;
        teamId = data.teamId;
        namaPKS = data.namaPKS;
        teamName = data.teamName;
        reportList = data.reportList || [];
        totalBeratTim = data.totalBeratTim;
        message = data.message;
        
        selectedStartDate = data.startDate ?? undefined; 
        selectedEndDate = data.endDate ?? undefined;   
        
        isCurrentlyFiltered = data.isCurrentlyFiltered;
    }
    $: serverError = $page.error as AppError | null;

    const months: { value: number; name: string }[] = [
        { value: 1, name: "Januari" }, { value: 2, name: "Februari" }, { value: 3, name: "Maret" },
        { value: 4, name: "April" }, { value: 5, name: "Mei" }, { value: 6, name: "Juni" },
        { value: 7, name: "Juli" }, { value: 8, name: "Agustus" }, { value: 9, name: "September" },
        { value: 10, name: "Oktober" }, { value: 11, name: "November" }, { value: 12, name: "Desember" }
    ];

    const appCurrentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let i = appCurrentYear + 1; i >= appCurrentYear - 5; i--) {
        years.push(i);
    }

    function applyFilter() {
        if (selectedStartDate && selectedEndDate && pksId && teamId) {
            if (new Date(selectedStartDate) > new Date(selectedEndDate)) {
                alert("Tanggal awal tidak boleh melebihi tanggal akhir.");
                return;
            }
            const targetUrl = `/apps/palmol/${pksId}/teams/${teamId}/reports?startDate=${selectedStartDate}&endDate=${selectedEndDate}`;
            goto(targetUrl, { invalidateAll: true, keepFocus: true });
        } else {
            alert("Silakan pilih tanggal awal dan tanggal akhir untuk menerapkan filter.");
        }
    }

    function clearFilter() {
        if (pksId && teamId) {
            selectedStartDate = undefined; 
            selectedEndDate = undefined;   
            const targetUrl = `/apps/palmol/${pksId}/teams/${teamId}/reports`;
            goto(targetUrl, { invalidateAll: true, keepFocus: true });
        }
    }

    function openImageModal(imageUrl: string, reportDate: string) {
        selectedImageUrl = imageUrl;
        selectedImageTitle = `Bukti Laporan - ${reportDate}`;
        isImageModalOpen = true;
    }

    function toggleImageModal() {
        isImageModalOpen = !isImageModalOpen;
        if (!isImageModalOpen) {
            selectedImageUrl = null;
        }
    }

    $: if ($page.error && serverError !== $page.error) { 
        serverError = $page.error as AppError | null;
    }

    function handleImageError(event: Event) {
        const target = event.target as HTMLImageElement;
        // Ganti dengan path ke gambar placeholder default jika ada, atau sembunyikan gambar
        target.style.display = 'none'; // Atau ganti src ke placeholder
        const placeholder = target.parentElement?.querySelector('.report-card-img-placeholder');
        if (placeholder) (placeholder as HTMLElement).style.display = 'flex';
    }

</script>

<DefaultLayout {data}>
    <PageBreadcrumb 
        title={`Laporan Tim: ${teamName || (teamId || "Tim")}`} 
        subTitle={`PKS: ${namaPKS || (pksId || "PKS")}`} 
    />

    <main class="reports-page-main-content pt-3">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h1 class="h3 mb-0 text-dark">Laporan Kinerja Tim: {teamName || "Nama Tim"}</h1>
            {#if pksId && teamId}
                <Button outline color="secondary" size="sm" href={`/apps/palmol/${pksId}/teams/${teamId}/detail`}>
                    <Icon icon="mdi:arrow-left" class="me-1"/> Kembali ke Detail Tim
                </Button>
            {/if}
        </div>

        <Card class="mb-4 shadow-sm">
            <CardHeader class="bg-light">
                <h5 class="card-title mb-0 fs-1rem">
                    <Icon icon="mdi:filter-variant" class="me-2 text-primary"/>Filter Laporan
                </h5>
            </CardHeader>
            <CardBody>
                <Row class="g-3 align-items-end">
                    <Col md>
                        <FormGroup class="mb-md-0">
                            <Label for="startDate-picker" class="form-label-sm">Tanggal Awal:</Label>
                            <FlatPicker
                                id="startDate-picker"
                                placeholder="Pilih tanggal awal..."
                                options={{ 
                                    dateFormat: 'Y-m-d',
                                    altInput: true,
                                    altFormat: 'd M Y'
                                }}
                                value={selectedStartDate}
                                on:change={(e) => selectedStartDate = e.detail}
                                class="form-control-sm" 
                            />
                        </FormGroup>
                    </Col>
                    <Col md>
                        <FormGroup class="mb-md-0">
                            <Label for="endDate-picker" class="form-label-sm">Tanggal Akhir:</Label>
                            <FlatPicker
                                id="endDate-picker"
                                placeholder="Pilih tanggal akhir..."
                                options={{ 
                                    dateFormat: 'Y-m-d',
                                    altInput: true,
                                    altFormat: 'd M Y',
                                    minDate: selectedStartDate 
                                }}
                                value={selectedEndDate}
                                on:change={(e) => selectedEndDate = e.detail}
                                class="form-control-sm"
                            />
                        </FormGroup>
                    </Col>
                    <Col md="auto" class="d-flex gap-2 mt-2 mt-md-0 align-self-end">
                        <Button 
                            color="primary" 
                            size="sm" 
                            on:click={applyFilter} 
                            class="flex-grow-1 flex-md-grow-0"
                            disabled={!selectedStartDate || !selectedEndDate || selectedStartDate === '' || selectedEndDate === ''}
                        >
                            <Icon icon="mdi:check-circle-outline" class="me-1"/>Terapkan
                        </Button>
                        {#if isCurrentlyFiltered}
                            <Button 
                                color="outline-secondary" 
                                size="sm" 
                                on:click={clearFilter} 
                                class="flex-grow-1 flex-md-grow-0"
                            >
                                <Icon icon="mdi:filter-variant-remove" class="me-1"/>Hapus
                            </Button>
                        {/if}
                    </Col>
                </Row>
            </CardBody>
        </Card>

        {#if serverError}
            <Alert color="danger" class="shadow-sm">
                <h4 class="alert-heading"><Icon icon="mdi:alert-octagon-outline" class="me-2"/>Terjadi Kesalahan</h4>
                <p>
                    Tidak dapat memuat data laporan.
                    {#if typeof serverError === 'object' && serverError !== null && serverError.message}
                        <br/><small>Detail: {serverError.message}{serverError.status ? ` (${serverError.status})` : ''}</small>
                    {/if}
                </p>
            </Alert>
        {:else}
            <Card class="shadow-sm">
                <CardHeader class="bg-light d-flex flex-wrap justify-content-between align-items-center">
                    <h5 class="card-title mb-0 fs-1rem me-auto">
                        <Icon icon="mdi:file-document-outline" class="me-2 text-primary"/>Daftar Laporan
                    </h5>
                    <div class="d-flex align-items-center gap-2 mt-2 mt-md-0">
                        {#if isCurrentlyFiltered && selectedStartDate && selectedEndDate}
                            <Badge color="info" pill class="px-2 py-1 fs-xs d-none d-sm-inline-block">
                                Filter: 
                                {new Date(selectedStartDate + 'T00:00:00Z').toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric'})} - 
                                {new Date(selectedEndDate + 'T00:00:00Z').toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric'})}
                            </Badge>
                        {/if}
                        <ButtonGroup size="sm">
                            <Button
                                color="primary"
                                outline={viewMode !== 'table'}
                                on:click={() => viewMode = 'table'}
                                title="Tampilan Tabel"
                            >
                                <Icon icon="mdi:table"/>
                            </Button>
                            <Button
                                color="primary"
                                outline={viewMode !== 'card'}
                                on:click={() => viewMode = 'card'}
                                title="Tampilan Kartu"
                            >
                                <Icon icon="mdi:view-grid-outline"/>
                            </Button>
                        </ButtonGroup>
                    </div>
                </CardHeader>
                <CardBody>
                    <div class="reports-summary mb-3 pb-3 border-bottom">
                        {#if reportList && reportList.length > 0}
                            <Row>
                                <Col sm="6" class="mb-2 mb-sm-0">
                                    Total Laporan: <strong class="text-primary">{reportList.length}</strong>
                                </Col>
                                <Col sm="6" class="text-sm-end">
                                    Total Berat Panen: <strong class="text-success">{totalBeratTim?.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || 0} kg</strong>
                                </Col>
                            </Row>
                        {:else if message}
                             <Alert color="info" class="text-center mb-0 py-2">
                                <Icon icon="mdi:information-outline" class="me-2" style="font-size: 1.1rem; vertical-align: -2px;"/>
                                {message}
                            </Alert>
                        {:else if !isCurrentlyFiltered && (!reportList || reportList.length === 0)}
                            <Alert color="secondary" class="text-center mb-0 py-2">
                                Belum ada laporan kinerja yang tercatat untuk tim ini.
                            </Alert>
                        {/if}
                    </div>

                    {#if reportList && reportList.length > 0}
                        {#if viewMode === 'table'}
                            <div class="table-responsive">
                                <Table hover class="table-sm align-middle text-nowrap">
                                    <thead class="table-light">
                                        <tr>
                                            <th style="width: 50px;">No.</th>
                                            <th>Tanggal Laporan</th>
                                            <th class="text-end">Berat (kg)</th>
                                            <th>Pelapor</th>
                                            <th class="text-center">Bukti</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {#each reportList as report, i (report.id)}
                                            <tr>
                                                <td>{i + 1}</td>
                                                <td>{report.date}</td>
                                                <td class="text-end fw-medium">{report.jumlahBerat.toLocaleString("id-ID")}</td>
                                                <td class="text-muted">
                                                    <Icon icon="mdi:account-circle-outline" class="me-1 text-primary" style="font-size: 1.1em; vertical-align: -2px;"/>
                                                    {report.userName || report.userId}
                                                </td>
                                                <td class="text-center">
                                                    {#if report.img}
                                                        <Button 
                                                            size="sm" 
                                                            color="outline-secondary" 
                                                            class="btn-icon" 
                                                            title="Lihat Bukti Gambar"
                                                            on:click={() => {
                                                                if (report.img) openImageModal(report.img, report.date);
                                                            }}
                                                        >
                                                            <Icon icon="mdi:image-search-outline"/>
                                                        </Button>
                                                    {:else}
                                                        <span class="text-muted fs-xs">-</span>
                                                    {/if}
                                                </td>
                                            </tr>
                                        {/each}
                                    </tbody>
                                </Table>
                            </div>
                        {:else if viewMode === 'card'}
                            <Row class="row-cols-1 row-cols-md-2 row-cols-xl-3 g-3">
                                {#each reportList as report, i (report.id)}
                                    <Col>
                                        <Card class="h-100 shadow-sm report-card card-hover-lift-sm">
                                            {#if report.img}
                                                <a 
                                                    href={report.img} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    on:click|preventDefault={() => { if(report.img) openImageModal(report.img, report.date)}} 
                                                    style="text-decoration: none; display: block; height: 180px; overflow: hidden; background-color: #f8f9fa;"
                                                    class="report-card-image-link"
                                                >
                                                    <img 
                                                        src={report.img} 
                                                        alt="Bukti Laporan {i+1}" 
                                                        class="card-img-top report-card-img"
                                                        on:error={handleImageError}
                                                    />
                                                    <div class="report-card-img-placeholder d-none align-items-center justify-content-center" style="height: 100%;">
                                                        <Icon icon="mdi:image-off-outline" style="font-size: 3rem; color: #ccc;"/>
                                                    </div>
                                                </a>
                                            {:else}
                                                <div class="report-card-img-placeholder d-flex align-items-center justify-content-center bg-light" style="height: 180px;">
                                                    <Icon icon="mdi:image-off-outline" style="font-size: 3rem; color: #ccc;"/>
                                                </div>
                                            {/if}
                                            <CardBody class="d-flex flex-column p-3">
                                                <div class="mb-2">
                                                    <Badge color="light" class="text-dark border me-1 fs-xs p-1 px-2">Laporan #{i + 1}</Badge>
                                                    <span class="fs-sm text-muted float-end">{report.date.split(' pukul')[0]}</span>
                                                </div>
                                                
                                                <div class="mb-2 text-center">
                                                    <span class="fw-bold fs-4 text-success">{report.jumlahBerat.toLocaleString("id-ID")}</span>
                                                    <span class="text-muted ms-1 fs-sm">kg</span>
                                                </div>
                                                <p class="fs-xs text-muted mb-2 text-center text-truncate" title={report.userName || report.userId}>
                                                    <Icon icon="mdi:account-outline" class="me-1"/>
                                                    {report.userName || report.userId}
                                                </p>
                                                
                                                {#if report.img}
                                                <Button 
                                                        size="sm" 
                                                        color="primary" 
                                                        outline
                                                        class="mt-auto w-100 btn-icon" 
                                                        on:click={() => { if (report.img) openImageModal(report.img, report.date)}}
                                                    >
                                                        <Icon icon="mdi:image-search-outline" class="me-1"/>Lihat Bukti
                                                </Button>
                                                {/if}
                                            </CardBody>
                                        </Card>
                                    </Col>
                                {/each}
                            </Row>
                        {/if}
                    {:else if !message && !serverError}
                        <div class="text-center py-4">
                            <Spinner color="primary"/>
                            <p class="mt-2 text-muted">Memuat data laporan...</p>
                        </div>
                    {/if}
                </CardBody>
            </Card>
        {/if}
    </main>

    {#if selectedImageUrl}
        <Modal bind:isOpen={isImageModalOpen} toggle={toggleImageModal} size="lg" centered scrollable>
            <ModalHeader toggle={toggleImageModal}>{selectedImageTitle}</ModalHeader>
            <ModalBody class="text-center p-4">
                <img src={selectedImageUrl} alt={selectedImageTitle} class="img-fluid rounded" style="max-height: 75vh;" />
            </ModalBody>
            <div class="modal-footer">
                <Button color="secondary" outline on:click={toggleImageModal}>Tutup</Button>
            </div>
        </Modal>
    {/if}
</DefaultLayout>

<style>
    .fs-xs {
        font-size: 0.75rem;
    }
    .fs-sm {
        font-size: 0.875rem;
    }
    .fs-1rem {
        font-size: 1rem !important;
    }
    :global(input.form-control-sm.flatpickr-input) {
        height: calc(1.5em + 0.5rem + 2px); 
        padding: 0.25rem 0.5rem;
        font-size: 0.875rem;
    }

    /* Gaya untuk Kartu Laporan */
    .report-card-img {
        width: 100%;
        height: 180px; /* Tinggi tetap untuk gambar */
        object-fit: cover;
        border-bottom: 1px solid var(--bs-border-color-translucent);
    }
    .report-card-image-link:hover .report-card-img {
        opacity: 0.85;
        transition: opacity 0.2s ease-in-out;
    }
    .report-card-img-placeholder {
        border-bottom: 1px solid var(--bs-border-color-translucent);
    }
</style>