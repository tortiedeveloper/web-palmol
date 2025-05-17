<script lang="ts">
    import DefaultLayout from "$lib/layouts/DefaultLayout.svelte";
    import PageBreadcrumb from "$lib/components/PageBreadcrumb.svelte";
    import { 
        Col, Row, Input, Button, ButtonGroup, Table, 
        Modal, ModalHeader, ModalBody, Alert, Card, CardBody, CardTitle, Spinner, Badge 
    } from "@sveltestrap/sveltestrap";
    import TreeCard from "./components/TreeCard.svelte"; // Pastikan path ini benar, jika TreeCard ada di dalam folder components di tree-gano
    import LeftTimeline from "$lib/components/customTimeline/LeftTimeline.svelte";
    
    import type { Tree, TreeRecord, User, FirebaseTimestamp, TimelineDataType, TimelineEventType } from "$lib/types";
    import type { PageData } from './$types';
    import Icon from '@iconify/svelte';
    import { ganoAIDb } from '$lib/firebase/ganoAIClient';
    import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
    import { tick } from "svelte";

    export let data: PageData; // 'data' ini datang dari SvelteKit (gabungan +layout.server.ts & +page.server.ts rute ini)

    // ... (sisa kode <script> Anda yang sudah ada untuk state, filteredTrees, fungsi modal, dll. tetap sama)
    // Pastikan semua fungsi seperti openPhotoModal, togglePhotoModal, fetchUserName, openTimelineModal, 
    // getStatusDisplay, toggleTimelineModal, handleTreeImageError sudah ada di sini.
    // Saya akan menyalinnya lagi untuk kelengkapan:

    let allTrees: Tree[] = [];
    let companyId: string | null = null;
    let errorLoadingPage: string | undefined = undefined;

    let searchTerm = "";
    let viewMode: 'card' | 'table' = 'card';

    let isPhotoModalOpen = false;
    let selectedTreeForPhoto: Tree | null = null;

    let isTimelineModalOpen = false;
    let selectedTreeForTimeline: Tree | null = null;
    let timelineDataForModal: TimelineDataType[] = [];
    let isLoadingTimeline = false;

    const defaultTreeImage = '/images/trees/default-tree.jpg';

    $: {
        allTrees = data.trees || [];
        companyId = data.companyId || null;
        errorLoadingPage = data.error;
    }

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
        if (!isPhotoModalOpen) {
            selectedTreeForPhoto = null;
        }
    }
    
    const userNameCache = new Map<string, string>();
    async function fetchUserName(userId: string): Promise<string> {
        if (userNameCache.has(userId)) {
            return userNameCache.get(userId)!;
        }
        try {
            const userDocRef = doc(ganoAIDb, 'users', userId);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const userName = (userDocSnap.data() as User).name || userId;
                userNameCache.set(userId, userName);
                return userName;
            }
            userNameCache.set(userId, userId);
            return userId;
        } catch (e) {
            console.error("Error fetching user name:", e);
            userNameCache.set(userId, userId);
            return userId;
        }
    }

    async function openTimelineModal(tree: Tree) {
        if (!companyId) return;
        selectedTreeForTimeline = tree;
        isTimelineModalOpen = true;
        isLoadingTimeline = true;
        timelineDataForModal = [];

        try {
            const recordsRef = collection(ganoAIDb, `company/${companyId}/tree/${tree.id}/record`);
            const recordsQuery = query(recordsRef, orderBy("date.createdDate", "desc"));
            const recordsSnapshot = await getDocs(recordsQuery);
            const formattedRecords: Record<string, TimelineEventType[]> = {};

            for (const recordDoc of recordsSnapshot.docs) {
                const record = { id: recordDoc.id, ...recordDoc.data() } as TreeRecord;
                // Mengakses createdDate yang SUDAH DI-STRINGIFY dari +page.server.ts saat tree dimuat
                // Jika Anda memuat record langsung di sini, pastikan konversi Timestamp dilakukan
                const recordCreatedDate = (record.date?.createdDate as unknown as FirebaseTimestamp)?.toDate(); 
                
                if (!recordCreatedDate) continue;

                const dateKey = recordCreatedDate.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
                if (!formattedRecords[dateKey]) {
                    formattedRecords[dateKey] = [];
                }

                let reportedBy = record.userId ? 'Memuat...' : 'Sistem';
                if (record.userId) {
                    reportedBy = await fetchUserName(record.userId);
                }
                
                formattedRecords[dateKey].push({
                    title: record.status ? getStatusDisplay(record.status).text : "Update Riwayat",
                    description: record.description || "Tidak ada deskripsi.",
                    badge: record.status ? getStatusDisplay(record.status).badgeText : undefined,
                    imageUrl: record.img,
                    reportedBy: reportedBy
                });
            }
            timelineDataForModal = Object.entries(formattedRecords).map(([dateStr, events]) => ({ date: dateStr, events }));
        } catch (err) {
            console.error("Error fetching tree records:", err);
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
        }
    }

    function handleTreeImageError(event: Event) {
        const target = event.target as HTMLImageElement;
        target.src = defaultTreeImage;
    }
</script>

<DefaultLayout {data}>
    <PageBreadcrumb title="Data Pohon Perusahaan" subTitle="Aplikasi" />

    {#if errorLoadingPage}
        <Alert color="danger" class="mt-2">{errorLoadingPage}</Alert>
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
                    />
                </Col>
                <Col sm="4" md="3" class="text-sm-end">
                    <ButtonGroup size="sm">
                        <Button 
                            color="primary" 
                            outline={viewMode !== 'card'} 
                            on:click={() => viewMode = 'card'}
                            title="Tampilan Kartu">
                            <Icon icon="mdi:view-grid-outline" />
                        </Button>
                        <Button 
                            color="primary" 
                            outline={viewMode !== 'table'} 
                            on:click={() => viewMode = 'table'}
                            title="Tampilan Tabel">
                            <Icon icon="mdi:view-list-outline" />
                        </Button>
                    </ButtonGroup>
                </Col>
            </Row>

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
                                {#if allTrees.length === 0 && !errorLoadingPage}
                                    Tidak ada data pohon untuk perusahaan ini.
                                {:else if filteredTrees.length === 0 && searchTerm !== ""}
                                    Pohon dengan nama atau ID "{searchTerm}" tidak ditemukan.
                                {:else if !errorLoadingPage}
                                    Memuat data pohon...
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
                        {#if allTrees.length === 0 && !errorLoadingPage}
                             Tidak ada data pohon untuk perusahaan ini.
                        {:else if filteredTrees.length === 0 && searchTerm !== ""}
                            Pohon dengan nama atau ID "{searchTerm}" tidak ditemukan.
                        {:else if !errorLoadingPage}
                             Memuat data pohon...
                        {/if}
                    </p>
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
                Riwayat Pohon: {selectedTreeForTimeline.name} 
                <small class="text-muted ms-1">({selectedTreeForTimeline.id?.substring(0,8)})</small>
            </ModalHeader>
            <ModalBody>
                {#if isLoadingTimeline}
                    <div class="text-center py-5">
                        <Spinner color="primary" />
                        <p class="mt-2">Memuat riwayat pohon...</p>
                    </div>
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