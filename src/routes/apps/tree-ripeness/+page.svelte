<script lang="ts">
    import DefaultLayout from "$lib/layouts/DefaultLayout.svelte";
    import PageBreadcrumb from "$lib/components/PageBreadcrumb.svelte";
    import { 
        Col, Row, Input, Button, ButtonGroup, Table, 
        Modal, ModalHeader, ModalBody, Alert, Card, CardBody, CardTitle, Spinner, Badge 
    } from "@sveltestrap/sveltestrap";
    import TreeCard from "./components/TreeCard.svelte"; // Menggunakan TreeCard dari folder lokal tree-ripeness
    import LeftTimeline from "$lib/components/customTimeline/LeftTimeline.svelte";
    
    // Impor tipe FirebaseTimestamp dari $lib/types
    import type { Tree, TreeRecord, User, FirebaseTimestamp, TimelineDataType, TimelineEventType, FruitCounts } from "$lib/types";
    import type { PageData } from './$types';
    import Icon from '@iconify/svelte';
    // Ganti ganoAIDb menjadi ripenessDb untuk operasi client-side di halaman ini
    import { ripenessDb } from '$lib/firebase/ripenessClient'; 
    import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
    import { tick } from "svelte";

    export let data: PageData;

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
        allTrees = Array.isArray(data.trees) ? data.trees : [];
        companyId = data.companyId || null;
        errorLoadingPage = data.error;
    }

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
            // Gunakan ripenessDb untuk mengambil data user dari project Ripeness
            const userDocRef = doc(ripenessDb, 'users', userId); 
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const userName = (userDocSnap.data() as User).name || userId;
                userNameCache.set(userId, userName);
                return userName;
            }
            userNameCache.set(userId, userId);
            return userId;
        } catch (e) {
            console.error("Error fetching user name (Ripeness):", e);
            userNameCache.set(userId, userId);
            return userId;
        }
    }

    async function openTimelineModalHandler(tree: Tree) {
        if (!companyId || !tree.id) return;
        selectedTreeForTimeline = tree;
        isTimelineModalOpen = true;
        isLoadingTimeline = true;
        timelineDataForModal = [];

        try {
            const recordsRef = collection(ripenessDb, `company/${companyId}/tree/${tree.id}/record`); // Gunakan ripenessDb
            const recordsQuery = query(recordsRef, orderBy("date.createdDate", "desc"));
            const recordsSnapshot = await getDocs(recordsQuery);
            const formattedRecords: Record<string, TimelineEventType[]> = {};

            for (const recordDoc of recordsSnapshot.docs) {
                const record = { id: recordDoc.id, ...recordDoc.data() } as TreeRecord;
                // PERBAIKAN: Gunakan tipe FirebaseTimestamp yang sudah diimpor
                const recordCreatedDateFirestore = record.date?.createdDate as unknown as FirebaseTimestamp | undefined;
                
                if (!recordCreatedDateFirestore || typeof recordCreatedDateFirestore.toDate !== 'function') {
                    console.warn(`[TreeRipeness Timeline] Invalid or missing createdDate for record ${record.id}`);
                    continue;
                }
                const recordCreatedDate = recordCreatedDateFirestore.toDate();

                const dateKey = recordCreatedDate.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
                if (!formattedRecords[dateKey]) {
                    formattedRecords[dateKey] = [];
                }

                let reportedBy = record.userId ? 'Memuat...' : 'Sistem';
                if (record.userId) {
                    reportedBy = await fetchUserName(record.userId);
                }
                
                let eventTitle = "Update Kematangan Buah";
                let eventBadge: string | undefined = undefined;

                if(record.fruitCounts){
                    eventTitle = `Matang: ${record.fruitCounts.matang}, Mentah: ${record.fruitCounts.belumMatang}, Busuk: ${record.fruitCounts.terlaluMatang}`;
                } else if (record.status) { // Jika ada field status di record Ripeness (misalnya "Panen")
                    eventTitle = record.status; // Anda bisa memetakan ini juga
                    eventBadge = record.status;
                }

                formattedRecords[dateKey].push({
                    title: eventTitle,
                    description: record.description || "Tidak ada deskripsi.",
                    badge: eventBadge,
                    imageUrl: record.img,
                    reportedBy: reportedBy
                });
            }
            timelineDataForModal = Object.entries(formattedRecords).map(([dateStr, events]) => ({ date: dateStr, events }));
        } catch (err) {
            console.error("Error fetching tree records for Ripeness:", err);
        } finally {
            isLoadingTimeline = false;
            await tick();
        }
    }
    
    // Fungsi getStatusDisplay ini lebih cocok untuk GanoAI. Untuk Ripeness, kita tampilkan fruitCounts di tabel.
    // Jika Anda ingin badge status umum di tabel Ripeness (misalnya berdasarkan apakah ada buah matang),
    // Anda bisa membuat fungsi baru atau mengadaptasi ini.
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
        }
    }

    function handleTreeImageError(event: Event) {
        const target = event.target as HTMLImageElement;
        target.src = defaultTreeImage;
    }
</script>

<DefaultLayout {data}>
    <PageBreadcrumb title="Data Pohon (SawitHarvest)" subTitle="Aplikasi Ripeness" />

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
                        <Button color="primary" outline={viewMode !== 'card'} on:click={() => viewMode = 'card'} title="Tampilan Kartu"><Icon icon="mdi:view-grid-outline" /></Button>
                        <Button color="primary" outline={viewMode !== 'table'} on:click={() => viewMode = 'table'} title="Tampilan Tabel"><Icon icon="mdi:view-list-outline" /></Button>
                    </ButtonGroup>
                </Col>
            </Row>

            {#if viewMode === 'card'}
                <Row class="row-cols-1 row-cols-sm-2 row-cols-lg-3 row-cols-xl-4 g-3">
                    {#each filteredTrees as tree (tree.id)}
                        <Col class="d-flex align-items-stretch">
                            <TreeCard {tree} onViewPhoto={openPhotoModalHandler} onViewTimeline={openTimelineModalHandler} class="w-100"/>
                        </Col>
                    {:else}
                        <Col><p class="text-muted text-center mt-4">{#if allTrees.length === 0 && !errorLoadingPage}Tidak ada data pohon.{:else if filteredTrees.length === 0 && searchTerm !== ""}Pohon "{searchTerm}" tidak ditemukan.{:else if !errorLoadingPage}Memuat...{/if}</p></Col>
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
                                    <td class="text-center fw-medium text-success">{tree.fruitCounts?.matang || 0}</td>
                                    <td class="text-center">{tree.fruitCounts?.belumMatang || 0}</td>
                                    <td class="text-center text-danger">{tree.fruitCounts?.terlaluMatang || 0}</td>
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
                     <p class="text-muted text-center mt-4">{#if allTrees.length === 0 && !errorLoadingPage}Tidak ada data pohon.{:else if filteredTrees.length === 0 && searchTerm !== ""}Pohon "{searchTerm}" tidak ditemukan.{:else if !errorLoadingPage}Memuat...{/if}</p>
                {/if}
            {/if}
        </CardBody>
    </Card>

    {#if selectedTreeForPhoto}
        <Modal isOpen={isPhotoModalOpen} toggle={togglePhotoModal} size="lg" centered scrollable>
            <ModalHeader toggle={togglePhotoModal}>Foto Pohon: {selectedTreeForPhoto.name || 'Detail Pohon'}</ModalHeader>
            <ModalBody class="text-center">
                {#if selectedTreeForPhoto.img}
                    <img src={selectedTreeForPhoto.img} alt="Foto {selectedTreeForPhoto.name || 'Pohon'}" class="img-fluid" style="max-height: 75vh; border-radius: 0.25rem;" on:error={handleTreeImageError}/>
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
                Riwayat Pohon (Ripeness): {selectedTreeForTimeline.name || 'Detail Pohon'} 
                <small class="text-muted ms-1">({selectedTreeForTimeline.id?.substring(0,8)})</small>
            </ModalHeader>
            <ModalBody>
                {#if isLoadingTimeline}
                    <div class="text-center py-5"><Spinner color="primary" /><p class="mt-2">Memuat riwayat pohon...</p></div>
                {:else if timelineDataForModal.length > 0}
                    <LeftTimeline timelineItems={timelineDataForModal} treeName="" />
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