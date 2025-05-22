<script lang="ts">
    import DefaultLayout from "$lib/layouts/DefaultLayout.svelte";
    import PageBreadcrumb from "$lib/components/PageBreadcrumb.svelte";
    import {
        Col, Row, Input, Button, ButtonGroup, Table,
        Modal, ModalHeader, ModalBody, Alert, Card, CardBody, Spinner, Badge
    } from "@sveltestrap/sveltestrap";
    import TreeCard from "./components/TreeCard.svelte"; // Pastikan path dan komponen TreeCard sesuai untuk Ripeness
    import LeftTimeline from "$lib/components/customTimeline/LeftTimeline.svelte";

    import type { Tree, TimelineDataType, TimelineEventType, AppError } from "$lib/types";
    import type { PageData } from './$types';
    import Icon from '@iconify/svelte';
    import { page } from '$app/stores';
    import { tick } from "svelte";

    export let data: PageData;

    $: layoutPageData = {
        userSession: $page.data.userSession,
        menuItemsForLayout: $page.data.menuItemsForLayout
    };

    let allTrees: Tree[] = [];
    let activeCompanyId: string | null = null;
    let serverMessage: string | null | undefined;

    let searchTerm = "";
    let viewMode: 'card' | 'table' = 'card';

    let isPhotoModalOpen = false;
    let selectedTreeForPhoto: Tree | null = null;

    let isTimelineModalOpen = false;
    let selectedTreeForTimeline: Tree | null = null;
    let timelineDataForModal: TimelineDataType[] = [];
    let isLoadingTimeline = false;
    let timelineError: string | null = null;

    const defaultTreeImage = '/images/trees/default-tree.jpg'; // Sesuaikan jika perlu

    function initializeState(currentPageData: PageData) {
        allTrees = currentPageData.trees || [];
        activeCompanyId = currentPageData.companyId || null;
        serverMessage = (currentPageData as any).message || null; // Akses opsional
    }

    initializeState(data);
    $: initializeState(data);

    $: criticalError = $page.error as AppError | null;

    $: filteredTrees = allTrees.filter(tree =>
        tree.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tree.id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
            // Panggil API endpoint baru untuk Ripeness
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

<DefaultLayout data={layoutPageData}>
    <PageBreadcrumb title="Data Pohon Ripeness (SawitHarvest)" subTitle="Aplikasi Ripeness" />

    {#if criticalError}
        <Alert color="danger" class="mt-2">{criticalError.message || 'Terjadi kesalahan server.'}</Alert>
    {/if}

    <Card class="mt-3">
        <CardBody>
            <Row class="mb-3 gy-2 align-items-center">
                <Col sm="8" md="9">
                    <Input
                        type="text"
                        placeholder="Cari pohon berdasarkan nama atau ID..."
                        bind:value={searchTerm}
                        class="form-control-sm"
                        disabled={criticalError != null}
                    />
                </Col>
                <Col sm="4" md="3" class="text-sm-end">
                    <ButtonGroup size="sm">
                        <Button color="primary" outline={viewMode !== 'card'} on:click={() => viewMode = 'card'} title="Tampilan Kartu" disabled={criticalError != null}>
                            <Icon icon="mdi:view-grid-outline" />
                        </Button>
                        <Button color="primary" outline={viewMode !== 'table'} on:click={() => viewMode = 'table'} title="Tampilan Tabel" disabled={criticalError != null}>
                            <Icon icon="mdi:view-list-outline" />
                        </Button>
                    </ButtonGroup>
                </Col>
            </Row>

            {#if !criticalError}
                {#if viewMode === 'card'}
                    <Row class="row-cols-1 row-cols-sm-2 row-cols-lg-3 row-cols-xl-4 g-3">
                        {#each filteredTrees as tree (tree.id)}
                            <Col class="d-flex align-items-stretch">
                                <TreeCard {tree} onViewPhoto={openPhotoModalHandler} onViewTimeline={openTimelineModalHandler} class="w-100"/>
                            </Col>
                        {:else}
                            <Col>
                                <p class="text-muted text-center mt-4">
                                    {#if serverMessage && allTrees.length === 0}
                                        {serverMessage}
                                    {:else if allTrees.length === 0}
                                        Tidak ada data pohon untuk perusahaan Ripeness ini.
                                    {:else if filteredTrees.length === 0 && searchTerm !== ""}
                                        Pohon dengan nama atau ID "{searchTerm}" tidak ditemukan.
                                    {/if}
                                </p>
                            </Col>
                        {/each}
                    </Row>
                {/if}

                {#if viewMode === 'table'}
                    {#if filteredTrees.length > 0}
                    <div class="table-responsive">
                        <Table hover class="table-sm align-middle">
                            <thead class="table-light">
                                <tr>
                                    <th style="width: 100px;">ID Pohon</th>
                                    <th>Nama Pohon</th>
                                    <th class="text-center">Matang</th>
                                    <th class="text-center">Belum Matang</th>
                                    <th class="text-center">Terlalu Matang</th>
                                    <th>Status Umum</th>
                                    <th>Update Terakhir</th>
                                    <th>Pelapor</th>
                                    <th class="text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {#each filteredTrees as tree (tree.id)}
                                    {@const statusInfo = getRipenessTreeTableStatus(tree)}
                                    <tr>
                                        <td class="font-monospace">{tree.id?.substring(0,8) || 'N/A'}</td>
                                        <td>{tree.name || '-'}</td>
                                        <td class="text-center fw-medium text-success">{tree.fruitCounts?.matang ?? 0}</td>
                                        <td class="text-center">{tree.fruitCounts?.belumMatang ?? 0}</td>
                                        <td class="text-center text-danger">{tree.fruitCounts?.terlaluMatang ?? 0}</td>
                                        <td>
                                            <Badge color={statusInfo.color} pill class="px-2 py-1">
                                                <Icon icon={statusInfo.icon} class="me-1" style="vertical-align: -1px;"/>
                                                {statusInfo.text}
                                            </Badge>
                                        </td>
                                        <td>{tree.updatedDateFormatted || '-'}</td>
                                        <td>{tree.userName || '-'}</td>
                                        <td class="text-center">
                                            {#if tree.img}
                                            <Button size="sm" color="light" on:click={() => openPhotoModalHandler(tree)} title="Lihat Foto" class="btn-icon me-1">
                                                <Icon icon="mdi:image-outline"/>
                                            </Button>
                                            {/if}
                                            <Button size="sm" color="light" on:click={() => openTimelineModalHandler(tree)} title="Lihat Riwayat" class="btn-icon">
                                                <Icon icon="mdi:timeline-text-outline"/>
                                            </Button>
                                        </td>
                                    </tr>
                                {/each}
                            </tbody>
                        </Table>
                    </div>
                    {:else}
                         <p class="text-muted text-center mt-4">
                            {#if serverMessage && allTrees.length === 0}
                                {serverMessage}
                            {:else if allTrees.length === 0}
                                Tidak ada data pohon untuk perusahaan Ripeness ini.
                            {:else if filteredTrees.length === 0 && searchTerm !== ""}
                                Pohon dengan nama atau ID "{searchTerm}" tidak ditemukan.
                            {/if}
                        </p>
                    {/if}
                {/if}
            {/if}
        </CardBody>
    </Card>

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