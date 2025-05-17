<script lang="ts">
    import DefaultLayout from "$lib/layouts/DefaultLayout.svelte";
    import PageBreadcrumb from "$lib/components/PageBreadcrumb.svelte";
    import { Row, Col, Input, Button, ButtonGroup, Table, Modal, ModalHeader, ModalBody, Alert, Card, CardBody, FormGroup, Label, Badge } from "@sveltestrap/sveltestrap";
    import ContactCard from "./components/ContactCard.svelte";
    import type { User as PKSUser, FirebaseTimestamp, AppError } from "$lib/types";
    import type { PageData } from './$types';
    import Icon from '@iconify/svelte';
    import { goto, invalidateAll } from '$app/navigation';
    import { page } from '$app/stores';
    import { onMount } from 'svelte'; // Impor onMount

    interface PKSFilterItemClient {
        id: string;
        name: string;
    }

    export let data: PageData;

    let users: PKSUser[] = [];
    let pksListForFilter: PKSFilterItemClient[] = [];
    // selectedPksIdForFilter sekarang hanya akan diupdate oleh interaksi pengguna atau dari URL awal
    let selectedPksIdForFilter: string | undefined = undefined; 
    let serverMessage: string | null | undefined;
    let currentPksNameForDisplay: string | undefined = "Semua PKS";

    let searchTerm = "";
    let viewMode: 'card' | 'table' = 'card';

    let isUserProfileModalOpen = false;
    let selectedUserForModal: PKSUser | null = null;

    const defaultAvatarPath = '/images/users/avatar-default.png';
    // Hapus pksDropdownKey, kita akan coba pendekatan lain

    // Inisialisasi state filter dari data prop HANYA SEKALI saat komponen dimuat atau data berubah signifikan
    // Ini untuk mencegah bind:value menimpa pilihan pengguna sebelum navigasi
    onMount(() => {
        if (data) {
            selectedPksIdForFilter = data.selectedPksId ?? undefined;
            // console.log('[onMount] Initial selectedPksIdForFilter set from data:', selectedPksIdForFilter);
        }
    });

    // Update state lain ketika data dari server berubah
    $: if (data) {
        users = data.users || [];
        pksListForFilter = data.pksListForFilter || [];
        serverMessage = data.message;
        currentPksNameForDisplay = data.currentPksName || "Semua PKS";
        
        // Jika URL berubah (misalnya setelah navigasi), update selectedPksIdForFilter agar dropdown konsisten
        // Ini akan dijalankan setelah navigasi akibat handlePksFilterChange
        const pksIdFromUrl = $page.url.searchParams.get('filterPksId');
        const currentPksIdValue = pksIdFromUrl === null ? undefined : pksIdFromUrl; // Konversi null dari searchParams ke undefined
        if (selectedPksIdForFilter !== currentPksIdValue) {
            selectedPksIdForFilter = currentPksIdValue;
            // console.log('[REACTIVE data] selectedPksIdForFilter updated from URL/data:', selectedPksIdForFilter);
        }
    }
    $: serverSideErrorPage = $page.error as AppError | null;

    $: filteredUsers = users.filter(user => 
        (user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
         user.email?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    function handlePksFilterChange(event: Event) {
        const target = event.target as HTMLSelectElement;
        const newPksId = target.value === "undefined" ? undefined : target.value; // "undefined" string jadi JS undefined
        
        // Update state client secara langsung untuk responsivitas UI sementara
        // selectedPksIdForFilter = newPksId; // Tidak perlu, karena navigasi akan memuat ulang data & state

        console.log('[CLIENT] PKS Dropdown changed by user, newPksId:', newPksId);

        const params = new URLSearchParams();
        if (newPksId) { // Hanya tambahkan jika ada nilai PKS ID
            params.set('filterPksId', newPksId);
        }
        const queryString = params.toString();
        goto(`/apps/contacts-palmol${queryString ? '?' + queryString : ''}`, { 
            invalidateAll: true,
            keepFocus: true 
        });
    }

    // ... (fungsi openUserProfileModal, toggleUserProfileModal, formatDate, handleImageError tetap sama)
    function openUserProfileModal(user: PKSUser) { selectedUserForModal = user; isUserProfileModalOpen = true; }
    function toggleUserProfileModal() { isUserProfileModalOpen = !isUserProfileModalOpen; if (!isUserProfileModalOpen) selectedUserForModal = null; }
    function formatDate(dateString: string | null | undefined): string { if (!dateString) return 'N/A'; try { return new Date(dateString).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' }); } catch (e) { return 'Format Salah'; } }
    function handleImageError(event: Event) { const target = event.target as HTMLImageElement; target.src = defaultAvatarPath; }
</script>

<DefaultLayout {data}> 
    <PageBreadcrumb title={`Pengguna Palmol ${currentPksNameForDisplay && currentPksNameForDisplay !== "Semua PKS" ? ('- PKS ' + currentPksNameForDisplay) : '- Semua PKS'}`} subTitle="Aplikasi Palmol" />

    {#if serverSideErrorPage}
        <Alert color="danger" class="mt-2">{serverSideErrorPage?.message || 'Gagal memuat data.'}</Alert>
    {/if}

    <Card class="mt-3">
        <CardBody>
            <Row class="mb-3 gy-3 align-items-center">
                <Col md="4">
                     <FormGroup class="mb-0">
                        <Label for="pks-filter-select-contacts" class="form-label-sm">Filter berdasarkan PKS:</Label>
                        <Input 
                            type="select" 
                            id="pks-filter-select-contacts" 
                            bsSize="sm" 
                            value={selectedPksIdForFilter ?? "undefined"} on:change={handlePksFilterChange}
                        >
                            <option value="undefined">Semua PKS</option> {#each pksListForFilter as pksItem (pksItem.id)}
                                <option value={pksItem.id}>{pksItem.name}</option>
                            {/each}
                        </Input>
                    </FormGroup>
                </Col>
                <Col md="5">
                    <Input type="text" placeholder="Cari pengguna..." bind:value={searchTerm} class="form-control-sm"/>
                </Col>
                <Col md="3" class="text-md-end">
                    <ButtonGroup size="sm">
                        <Button color="primary" outline={viewMode !== 'card'} on:click={() => viewMode = 'card'} title="Kartu"><Icon icon="mdi:view-grid-outline" /></Button>
                        <Button color="primary" outline={viewMode !== 'table'} on:click={() => viewMode = 'table'} title="Tabel"><Icon icon="mdi:view-list-outline" /></Button>
                    </ButtonGroup>
                </Col>
            </Row>

            {#if viewMode === 'card'}
                <Row class="row-cols-1 row-cols-sm-2 row-cols-lg-3 row-cols-xl-4 g-3">
                    {#each filteredUsers as user (user.id)}
                        <Col class="d-flex align-items-stretch"> 
                            <ContactCard user={user} onViewProfile={openUserProfileModal} class="w-100">
                                {#if selectedPksIdForFilter === undefined && user.pksName} 
                                    <p class="text-muted fs-xs mt-1 mb-0 text-center">
                                        <Icon icon="mdi:factory" class="me-1" style="vertical-align: -1px;"/>PKS: {user.pksName}
                                    </p>
                                {/if}
                            </ContactCard>
                        </Col>
                    {:else}
                        <Col><p class="text-muted text-center mt-4">{serverMessage || (users.length === 0 ? "Tidak ada pengguna." : (searchTerm ? `Pengguna "${searchTerm}" tidak ditemukan.` : "Memuat..."))}</p></Col>
                    {/each}
                </Row>
            {/if}

            {#if viewMode === 'table'}
                {#if filteredUsers.length > 0}
                <div class="table-responsive">
                    <Table hover class="table-sm align-middle">
                        <thead class="table-light">
                            <tr>
                                <th style="width: 70px;">Avatar</th>
                                <th>Nama</th>
                                <th>Email</th>
                                {#if selectedPksIdForFilter === undefined}<th>PKS</th>{/if}
                                <th>No. Telepon</th>
                                <th class="text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each filteredUsers as user (user.id)}
                                <tr>
                                    <td><img src={user.avatar || defaultAvatarPath} alt={user.name || 'Avatar'} class="rounded-circle avatar-sm" on:error={handleImageError}/></td>
                                    <td>{user.name || '-'}</td>
                                    <td>{user.email || '-'}</td>
                                    {#if selectedPksIdForFilter === undefined}
                                        <td class="text-muted fs-sm" title={user.pksName || user.pksId}>{user.pksName || (user.pksId ? user.pksId.substring(0,8) : '')}{user.pksName && user.pksName.length > 20 ? '...' : (user.pksId && user.pksId && user.pksId.length > 8 && !user.pksName ? '...' : '')}</td>
                                    {/if}
                                    <td>{user.phoneNumber || '-'}</td>
                                    <td class="text-center">
                                        <Button size="sm" color="light" on:click={() => openUserProfileModal(user)} title="Lihat Profil"><Icon icon="mdi:eye-outline"/></Button>
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </Table>
                </div>
                {:else}
                     <p class="text-muted text-center mt-4">{serverMessage || (users.length === 0 ? "Tidak ada pengguna." : (searchTerm ? `Pengguna "${searchTerm}" tidak ditemukan.` : "Memuat..."))}</p>
                {/if}
            {/if}
        </CardBody>
    </Card>

    {#if selectedUserForModal}
        <Modal isOpen={isUserProfileModalOpen} toggle={toggleUserProfileModal} size="lg" centered scrollable>
            <ModalHeader toggle={toggleUserProfileModal} class="bg-light">
                 <div class="d-flex align-items-center">
                    <Icon icon="mdi:account-card-outline" class="fs-4 me-2 text-primary"/>  
                    Profil Pengguna Palmol: <span class="fw-medium ms-1">{selectedUserForModal.name}</span>
                </div>
            </ModalHeader>
            <ModalBody class="p-4">
                <Row>
                    <Col md="4" class="text-center mb-3 mb-md-0">
                        <img src={selectedUserForModal.avatar || defaultAvatarPath} alt={selectedUserForModal.name || 'Avatar'} class="img-thumbnail rounded-circle shadow-sm mb-3" style="width: 120px; height: 120px; object-fit: cover;" on:error={handleImageError}/>
                        <h5 class="mb-1">{selectedUserForModal.name || 'N/A'}</h5>
                        <p class="text-muted fs-sm mb-1">{selectedUserForModal.email || 'Email tidak tersedia'}</p>
                        {#if selectedUserForModal.role}
                            <Badge color="primary" pill class="fs-xs px-2 mb-2">{selectedUserForModal.role}</Badge>
                        {/if}
                        {#if selectedUserForModal.pksName}
                            <div class="fs-xs text-muted"><Icon icon="mdi:factory-variant" class="me-1"/>{selectedUserForModal.pksName}</div>
                        {/if}
                    </Col>
                    <Col md="8">
                        <div class="border-start ps-md-3">
                            <h6 class="text-primary mb-2 mt-md-0 mt-3"><Icon icon="mdi:card-account-phone-outline" class="me-1"/>Kontak</h6>
                            <p class="fs-sm mb-1"><strong class="text-muted">Telepon:</strong> {selectedUserForModal.phoneNumber || '-'}</p>
                            <p class="fs-sm mb-3"><strong class="text-muted">Alamat:</strong> {selectedUserForModal.address || '-'}</p>
                            
                            <h6 class="text-primary mb-2"><Icon icon="mdi:account-details-outline" class="me-1"/>Info Akun</h6>
                            <p class="fs-sm mb-1"><strong class="text-muted">ID Pengguna (Auth):</strong> <span class="font-monospace">{selectedUserForModal.userId}</span></p>
                            <p class="fs-sm mb-1"><strong class="text-muted">ID Dokumen:</strong> <span class="font-monospace">{selectedUserForModal.id}</span></p>
                            {#if selectedUserForModal.membership}
                            <p class="fs-sm mb-1"><strong class="text-muted">Membership:</strong> {selectedUserForModal.membership}</p>
                            {/if}
                            <p class="fs-sm mb-1"><strong class="text-muted">Valid Hingga:</strong> {selectedUserForModal.date?.validDate ? formatDate(selectedUserForModal.date.validDate) : '-'}</p>
                            <p class="fs-sm mb-3"><strong class="text-muted">Update Terakhir:</strong> {selectedUserForModal.lastUpdated ? formatDate(selectedUserForModal.lastUpdated) : '-'}</p>

                            <h6 class="text-primary mb-2"><Icon icon="mdi:information-outline" class="me-1"/>Info Tambahan</h6>
                            {#if selectedUserForModal.birthDate}
                            <p class="fs-sm mb-1"><strong class="text-muted">Tgl Lahir:</strong> {selectedUserForModal.birthDate}</p>
                            {/if}
                            {#if selectedUserForModal.gender}
                            <p class="fs-sm mb-1"><strong class="text-muted">Gender:</strong> {selectedUserForModal.gender}</p>
                            {/if}
                             {#if selectedUserForModal.androidId}
                            <p class="fs-sm mb-1"><strong class="text-muted">Android ID:</strong> <span class="font-monospace">{selectedUserForModal.androidId}</span></p>
                            {/if}
                        </div>
                    </Col>
                </Row>
            </ModalBody>
            <div class="modal-footer">
                <Button color="secondary" outline on:click={toggleUserProfileModal}>Tutup</Button>
            </div>
        </Modal>
    {/if}
</DefaultLayout>

<style>
    .fs-xs { font-size: 0.75rem; }
    .fs-sm { font-size: 0.875rem; }
</style>