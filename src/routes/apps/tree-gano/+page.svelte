<script lang="ts">
    import DefaultLayout from "$lib/layouts/DefaultLayout.svelte";
    import PageBreadcrumb from "$lib/components/PageBreadcrumb.svelte";
    import {
        Col, Row, Input, Button, ButtonGroup, Table,
        Modal, ModalHeader, ModalBody, Alert, Card, CardBody, Spinner, Badge
    } from "@sveltestrap/sveltestrap";
    import TreeCard from "./components/TreeCard.svelte";
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

    const defaultTreeImage = '/images/trees/default-tree.jpg';

    function initializeState(currentPageData: PageData) {
        allTrees = currentPageData.trees || [];
        activeCompanyId = currentPageData.companyId || null;
        // PERBAIKAN untuk Error 1: Akses message secara opsional
        serverMessage = (currentPageData as any).message || null;
    }

    initializeState(data);
    $: initializeState(data);

    $: criticalError = $page.error as AppError | null;

    $: filteredTrees = allTrees.filter(tree =>
        tree.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tree.id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    function openPhotoModal(tree: Tree) {
        selectedTreeForPhoto = tree;
        isPhotoModalOpen = true;
    }

    function togglePhotoModal() {
        isPhotoModalOpen = !isPhotoModalOpen;
        if (!isPhotoModalOpen) selectedTreeForPhoto = null;
    }

    async function openTimelineModal(tree: Tree) {
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
            const response = await fetch(`/api/gano-tree-records/${activeCompanyId}/${tree.id}.json`);
            if (!response.ok) {
                const errData = await response.json().catch(() => ({ message: `Gagal memuat riwayat: ${response.statusText}` }));
                throw new Error(errData.message || `HTTP error ${response.status}`);
            }
            const result: { timelineEvents: TimelineEventType[] } = await response.json();

            const formattedRecords: Record<string, TimelineEventType[]> = {};
            result.timelineEvents.forEach(event => {
                // PERBAIKAN untuk Error 2,3,4,5: Pastikan event.originalDateISO ada sebelum digunakan
                if (event.originalDateISO) {
                    const dateKey = new Date(event.originalDateISO).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
                    if (!formattedRecords[dateKey]) {
                        formattedRecords[dateKey] = [];
                    }
                    formattedRecords[dateKey].push(event);
                } else {
                    console.warn("Timeline event missing originalDateISO:", event);
                }
            });
            timelineDataForModal = Object.entries(formattedRecords)
                .map(([dateStr, events]) => ({ date: dateStr, events }))
                // PERBAIKAN untuk Error 2,3,4,5: Tambahkan nullish coalescing atau pastikan event.originalDateISO ada
                .sort((a,b) => new Date(b.events[0]?.originalDateISO ?? 0).getTime() - new Date(a.events[0]?.originalDateISO ?? 0).getTime());

        } catch (err: any) {
            console.error("Error fetching tree timeline:", err);
            timelineError = err.message || "Gagal memuat riwayat pohon.";
        } finally {
            isLoadingTimeline = false;
            await tick();
        }
    }

    function getStatusDisplay(status: string | undefined): { text: string, badgeText: string, color: string, icon: string } {
        const s = status?.toLowerCase();
        if (s === 'sick') return { text: 'Terindikasi Sakit (Ganoderma)', badgeText: 'Sakit', color: 'danger', icon: 'mdi:virus-off-outline' };
        if (s === 'recovered') return { text: 'Sudah Pulih', badgeText: 'Pulih', color: 'success', icon: 'mdi:leaf-check-outline' };
        if (s === 'maintenance') return { text: 'Dalam Perawatan', badgeText: 'Perawatan', color: 'info', icon: 'mdi:tools' };
        return { text: status || 'N/A', badgeText: status || 'N/A', color: 'secondary', icon: 'mdi:help-circle-outline' };
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
    <PageBreadcrumb title="Data Pohon GanoAI" subTitle="Aplikasi GanoAI" />

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
                                <TreeCard
                                    {tree}
                                    onViewPhoto={openPhotoModal}
                                    onViewTimeline={openTimelineModal}
                                    class="w-100"
                                />
                            </Col>
                        {:else}
                            <Col>
                                <p class="text-muted text-center mt-4">
                                    {#if serverMessage && allTrees.length === 0}
                                        {serverMessage}
                                    {:else if allTrees.length === 0}
                                        Tidak ada data pohon untuk perusahaan ini.
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
                                    <th>Status Terakhir</th>
                                    <th>Update Terakhir</th>
                                    <th>Pelapor Terakhir</th>
                                    <th class="text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {#each filteredTrees as tree (tree.id)}
                                    {@const statusInfo = getStatusDisplay(tree.last_status)}
                                    <tr>
                                        <td class="font-monospace">{tree.id?.substring(0,8) || 'N/A'}</td>
                                        <td>{tree.name || '-'}</td>
                                        <td>
                                            <Badge color={statusInfo.color} pill class="px-2 py-1">
                                                <Icon icon={statusInfo.icon} class="me-1" style="vertical-align: -1px;"/>
                                                {statusInfo.badgeText}
                                            </Badge>
                                        </td>
                                        <td>{tree.updatedDateFormatted || '-'}</td>
                                        <td>{tree.userName || '-'}</td>
                                        <td class="text-center">
                                            {#if tree.img}
                                            <Button size="sm" color="light" on:click={() => openPhotoModal(tree)} title="Lihat Foto" class="btn-icon me-1">
                                                <Icon icon="mdi:image-outline"/>
                                            </Button>
                                            {/if}
                                            <Button size="sm" color="light" on:click={() => openTimelineModal(tree)} title="Lihat Riwayat" class="btn-icon">
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
                                Tidak ada data pohon untuk perusahaan ini.
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
            <ModalHeader toggle={togglePhotoModal}>Foto Pohon: {selectedTreeForPhoto.name}</ModalHeader>
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
                Riwayat Pohon GanoAI: {selectedTreeForTimeline.name}
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