<script lang="ts">
    import DefaultLayout from "$lib/layouts/DefaultLayout.svelte";
    import PageBreadcrumb from "$lib/components/PageBreadcrumb.svelte";
    import { goto } from "$app/navigation";
    import { page } from "$app/stores";
    import type { PageData as TeamReportsPageData } from "./$types";
    import type { PKSReport, AppError, UserSessionData, MenuItemType } from '$lib/types';
    import { Row, Col, Card, CardHeader, CardBody, Table, Button, FormGroup, Label, Input, Alert, Spinner, Modal, ModalHeader, ModalBody, Badge, ButtonGroup } from "@sveltestrap/sveltestrap";
    import Icon from '@iconify/svelte';
    import FlatPicker from '$lib/components/FlatPicker.svelte';
    import { onMount } from 'svelte';

    export let data: TeamReportsPageData;

    let layoutPageData: { userSession: UserSessionData | undefined; menuItemsForLayout: MenuItemType[] };
    $: layoutPageData = {
        userSession: $page.data.userSession as UserSessionData | undefined,
        menuItemsForLayout: ($page.data.menuItemsForLayout as MenuItemType[]) || []
    };

    let pksId: string | undefined;
    let teamId: string | undefined;
    let namaPKS: string | undefined;
    let teamName: string | undefined;
    let reportList: PKSReport[] = [];
    let totalBeratTim: number | undefined;
    let serverMessage: string | null | undefined;

    // Deklarasi sebagai string | undefined
    let uiSelectedStartDate: string | undefined = undefined;
    let uiSelectedEndDate: string | undefined = undefined;
    let activeIsCurrentlyFiltered: boolean = false;

    let criticalError = $page.error as AppError | null;

    let isImageModalOpen = false;
    let selectedImageUrl: string | null = null;
    let selectedImageTitle = "Bukti Laporan";
    let viewMode: 'table' | 'card' = 'table';
    let initialDataProcessed = false; // Nama variabel yang benar

    function syncDataToState(currentData: TeamReportsPageData | null | undefined) {
        if (criticalError || !currentData) {
            if (criticalError) {
                 pksId = undefined; teamId = undefined; namaPKS = "Error"; teamName = "Error";
                 reportList = []; totalBeratTim = 0; serverMessage = null;
                 uiSelectedStartDate = undefined; uiSelectedEndDate = undefined; activeIsCurrentlyFiltered = false;
            }
            return;
        }
        pksId = currentData.pksId;
        teamId = currentData.teamId;
        namaPKS = currentData.namaPKS;
        teamName = currentData.teamName;
        reportList = currentData.reportList || [];
        totalBeratTim = currentData.totalBeratTim;
        serverMessage = currentData.message;

        // PERBAIKAN Error 1 & 2: Gunakan nullish coalescing
        uiSelectedStartDate = currentData.startDate ?? undefined;
        uiSelectedEndDate = currentData.endDate ?? undefined;
        activeIsCurrentlyFiltered = currentData.isCurrentlyFiltered ?? false;
    }

    $: syncDataToState(criticalError ? null : data);

    onMount(() => {
      syncDataToState(criticalError ? null : data);
      initialDataProcessed = true;
    });

    $: filterUiHasChanged = uiSelectedStartDate !== (data?.startDate ?? undefined) ||
                           uiSelectedEndDate !== (data?.endDate ?? undefined);
    $: canApplyFilter = filterUiHasChanged || ((!!uiSelectedStartDate || !!uiSelectedEndDate) && !activeIsCurrentlyFiltered);

    function applyFilter() {
        if (pksId && teamId) {
            if (uiSelectedStartDate && uiSelectedEndDate && (new Date(uiSelectedStartDate) > new Date(uiSelectedEndDate))) {
                alert("Tanggal awal tidak boleh melebihi tanggal akhir.");
                return;
            }
            const params = new URLSearchParams();
            if (uiSelectedStartDate) params.set('startDate', uiSelectedStartDate);
            if (uiSelectedEndDate) params.set('endDate', uiSelectedEndDate);
            if (!uiSelectedStartDate) params.delete('startDate');
            if (!uiSelectedEndDate) params.delete('endDate');

            const queryString = params.toString();
            goto(`/apps/palmol/${pksId}/teams/${teamId}/reports${queryString ? '?' + queryString : ''}`, {
                invalidateAll: true,
                keepFocus: true
            });
        }
    }

    function clearFilter() {
        if (pksId && teamId) {
            uiSelectedStartDate = undefined;
            uiSelectedEndDate = undefined;
            goto(`/apps/palmol/${pksId}/teams/${teamId}/reports`, {
                invalidateAll: true,
                keepFocus: true
            });
        }
    }

    function openImageModal(imageUrl: string | null | undefined, reportDate: string) {
        if (imageUrl) {
            selectedImageUrl = imageUrl;
            selectedImageTitle = `Bukti Laporan - ${reportDate}`;
            isImageModalOpen = true;
        }
    }

    function toggleImageModal() {
        isImageModalOpen = !isImageModalOpen;
        if (!isImageModalOpen) {
            selectedImageUrl = null;
        }
    }

    function handleImageError(event: Event) {
        const target = event.target as HTMLImageElement;
        target.style.display = 'none';
        const placeholder = target.parentElement?.querySelector('.report-card-img-placeholder');
        if (placeholder) (placeholder as HTMLElement).style.display = 'flex';
    }
</script>

<DefaultLayout data={layoutPageData}>
    <PageBreadcrumb
        title={`Laporan Tim: ${teamName || (teamId || "Tim")}`}
        subTitle={`PKS: ${namaPKS || (pksId || "PKS")}`}
    />

    <main class="reports-page-main-content pt-3">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h1 class="h3 mb-0 text-dark">Laporan Kinerja Tim: {teamName || "Nama Tim"}</h1>
            {#if pksId && teamId && !criticalError}
                <Button outline color="secondary" size="sm" href={`/apps/palmol/${pksId}/teams/${teamId}/detail`}>
                    <Icon icon="mdi:arrow-left" class="me-1"/> Kembali ke Detail Tim
                </Button>
            {/if}
        </div>

        {#if !criticalError}
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
                                <Label for="startDate-picker-teamreport" class="form-label-sm">Tanggal Awal:</Label>
                                <FlatPicker
                                    id="startDate-picker-teamreport"
                                    placeholder="Pilih tanggal awal..."
                                    options={{ dateFormat: 'Y-m-d', altInput: true, altFormat: 'd M Y' }}
                                    bind:value={uiSelectedStartDate}
                                    class="form-control-sm"
                                />
                            </FormGroup>
                        </Col>
                        <Col md>
                            <FormGroup class="mb-md-0">
                                <Label for="endDate-picker-teamreport" class="form-label-sm">Tanggal Akhir:</Label>
                                <FlatPicker
                                    id="endDate-picker-teamreport"
                                    placeholder="Pilih tanggal akhir..."
                                    options={{ dateFormat: 'Y-m-d', altInput: true, altFormat: 'd M Y', minDate: uiSelectedStartDate }}
                                    bind:value={uiSelectedEndDate}
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
                                disabled={!uiSelectedStartDate && !uiSelectedEndDate && !activeIsCurrentlyFiltered && !filterUiHasChanged}
                            >
                                <Icon icon="mdi:check-circle-outline" class="me-1"/>Terapkan
                            </Button>
                            {#if activeIsCurrentlyFiltered}
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
        {/if}


        {#if criticalError}
            <Alert color="danger" class="shadow-sm">
                <h4 class="alert-heading"><Icon icon="mdi:alert-octagon-outline" class="me-2"/>Terjadi Kesalahan Server</h4>
                <p>Tidak dapat memuat data laporan. {#if criticalError.message}<br/><small>Detail: {criticalError.message}</small>{/if}</p>
            </Alert>
        {:else}
            <Card class="shadow-sm">
                <CardHeader class="bg-light d-flex flex-wrap justify-content-between align-items-center">
                    <h5 class="card-title mb-0 fs-1rem me-auto">
                        <Icon icon="mdi:file-document-outline" class="me-2 text-primary"/>Daftar Laporan
                    </h5>
                    <div class="d-flex align-items-center gap-2 mt-2 mt-md-0">
                        {#if activeIsCurrentlyFiltered && uiSelectedStartDate && uiSelectedEndDate}
                            <Badge color="info" pill class="px-2 py-1 fs-xs d-none d-sm-inline-block">
                                Filter:
                                {new Date(uiSelectedStartDate + 'T00:00:00Z').toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric'})} -
                                {new Date(uiSelectedEndDate + 'T00:00:00Z').toLocaleDateString('id-ID', {day:'2-digit', month:'short', year:'numeric'})}
                            </Badge>
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
                                <Col sm="6" class="text-sm-end">Total Berat Tim: <strong class="text-success">{(totalBeratTim ?? 0).toLocaleString("id-ID")} kg</strong></Col>
                            </Row>
                        {:else if serverMessage}
                            <Alert color="info" class="text-center mb-0 py-2">
                                <Icon icon="mdi:information-outline" class="me-2" style="font-size: 1.1rem; vertical-align: -2px;"/>
                                {serverMessage}
                            </Alert>
                        {:else if !activeIsCurrentlyFiltered && (!reportList || reportList.length === 0) && !initialDataProcessed && !criticalError}
                            <div class="text-center py-4"><Spinner color="primary" type="grow" size="sm" class="me-2"/> Memuat laporan...</div>
                        {:else if (!reportList || reportList.length === 0)}
                             <Alert color="secondary" class="text-center mb-0 py-2">Belum ada laporan atau tidak ada yang cocok dengan filter.</Alert>
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
                                                <td class="text-end fw-medium">{(report.jumlahBerat ?? 0).toLocaleString("id-ID")}</td>
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
                                                            on:click={() => openImageModal(report.img, report.date)}
                                                        >
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
                                                <a
                                                    href={report.img}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    on:click|preventDefault={() => openImageModal(report.img, report.date)}
                                                    style="text-decoration: none; display: block; height: 180px; overflow: hidden; background-color: #f8f9fa;"
                                                    class="report-card-image-link"
                                                >
                                                    <img
                                                        src={report.img}
                                                        alt="Bukti Laporan {i+1}"
                                                        class="card-img-top report-card-img"
                                                        on:error={handleImageError}
                                                    />
                                                    <div class="report-card-img-placeholder d-none align-items-center justify-content-center" style="height: 100%;"><Icon icon="mdi:image-off-outline" style="font-size: 3rem; color: #ccc;"/></div>
                                                </a>
                                            {:else}
                                                <div class="report-card-img-placeholder d-flex align-items-center justify-content-center bg-light" style="height: 180px;"><Icon icon="mdi:image-off-outline" style="font-size: 3rem; color: #ccc;"/></div>
                                            {/if}
                                            <CardBody class="d-flex flex-column p-3">
                                                <div class="mb-2">
                                                    <Badge color="light" class="text-dark border me-1 fs-xs p-1 px-2">Laporan #{i + 1}</Badge>
                                                    <span class="fs-sm text-muted float-end">{report.date.split(' pukul')[0]}</span>
                                                </div>

                                                <div class="mb-2 text-center">
                                                    <span class="fw-bold fs-4 text-success">{(report.jumlahBerat ?? 0).toLocaleString("id-ID")}</span>
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
                                                    on:click={() => openImageModal(report.img, report.date)}
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
                    {:else if !serverMessage && !criticalError && initialDataProcessed}
                        <div class="text-center py-4"><Spinner color="primary"/><p class="mt-2 text-muted">Memuat data laporan...</p></div>
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
    .fs-xs { font-size: 0.75rem; }
    .fs-sm { font-size: 0.875rem; }
</style>