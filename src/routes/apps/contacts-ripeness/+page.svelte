<script lang="ts">
    import DefaultLayout from "$lib/layouts/DefaultLayout.svelte";
    import PageBreadcrumb from "$lib/components/PageBreadcrumb.svelte";
    import { Col, Row, Input, Button, ButtonGroup, Table, Modal, ModalHeader, ModalBody, Alert, Card, CardBody } from "@sveltestrap/sveltestrap";
    import ContactCard from "./components/ContactCard.svelte";
    import type { User, AppError } from "$lib/types";
    import type { PageData } from './$types'; // PageData akan diinferensikan oleh SvelteKit
    import Icon from '@iconify/svelte';
    import { page } from '$app/stores';

    export let data: PageData;

    $: layoutPageData = {
        userSession: $page.data.userSession,
        menuItemsForLayout: $page.data.menuItemsForLayout
    };

    let users: User[] = [];
    let activeCompanyId: string | null = null;
    let serverMessage: string | null | undefined;

    let searchTerm = "";
    let viewMode: 'card' | 'table' = 'card';

    let isUserProfileModalOpen = false;
    let selectedUserForModal: User | null = null;

    const defaultAvatarPath = '/images/users/avatar-default.png';

    function initializeState(currentPageData: PageData) {
        users = currentPageData.users || [];
        activeCompanyId = currentPageData.companyId || null;
        // PERBAIKAN: Akses pageData.message secara opsional
        // Jika 'message' ada di tipe PageData yang benar, ini akan berfungsi.
        // Jika tidak, ia akan menjadi undefined dan tidak menyebabkan error saat kompilasi.
        serverMessage = (currentPageData as any).message || null;
    }

    // Inisialisasi dari data prop awal
    initializeState(data);

    // Reaksi terhadap perubahan data dari server
    $: initializeState(data);

    $: criticalError = $page.error as AppError | null;

    $: filteredUsers = users.filter(user =>
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    function openUserProfileModal(user: User) {
        selectedUserForModal = user;
        isUserProfileModalOpen = true;
    }

    function toggleUserProfileModal() {
        isUserProfileModalOpen = !isUserProfileModalOpen;
        if (!isUserProfileModalOpen) {
            selectedUserForModal = null;
        }
    }

    function formatDate(dateString: string | null | undefined): string {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleDateString('id-ID', {
                year: 'numeric', month: 'long', day: 'numeric',
            });
        } catch (e) {
            console.error("Error parsing date string:", dateString, e);
            return 'Format Tanggal Salah';
        }
    }

    function handleImageError(event: Event) {
        const target = event.target as HTMLImageElement;
        target.src = defaultAvatarPath;
    }
</script>

<DefaultLayout data={layoutPageData}>
    <PageBreadcrumb title="Pengguna Ripeness (SawitHarvest)" subTitle="Aplikasi Ripeness" />

    {#if criticalError}
        <Alert color="danger" class="mt-2">{criticalError.message || 'Terjadi kesalahan server.'}</Alert>
    {/if}

    <Card class="mt-3">
        <CardBody>
            <Row class="mb-3 gy-2 align-items-center">
                <Col md="8">
                    <Input
                        type="text"
                        placeholder="Cari pengguna berdasarkan nama atau email..."
                        bind:value={searchTerm}
                        class="form-control-sm"
                        disabled={criticalError != null}
                    />
                </Col>
                <Col md="4" class="text-md-end">
                    <ButtonGroup size="sm">
                        <Button
                            color="primary"
                            outline={viewMode !== 'card'}
                            on:click={() => viewMode = 'card'}
                            title="Tampilan Kartu"
                            disabled={criticalError != null}
                        >
                            <Icon icon="mdi:view-grid-outline" />
                        </Button>
                        <Button
                            color="primary"
                            outline={viewMode !== 'table'}
                            on:click={() => viewMode = 'table'}
                            title="Tampilan Tabel"
                            disabled={criticalError != null}
                        >
                            <Icon icon="mdi:view-list-outline" />
                        </Button>
                    </ButtonGroup>
                </Col>
            </Row>

            {#if !criticalError}
                {#if viewMode === 'card'}
                    <Row class="row-cols-1 row-cols-sm-2 row-cols-lg-3 row-cols-xl-4 g-3">
                        {#each filteredUsers as user (user.id)}
                            <Col class="d-flex align-items-stretch">
                                <ContactCard {user} onViewProfile={openUserProfileModal} class="w-100"/>
                            </Col>
                        {:else}
                            <Col>
                                <p class="text-muted text-center mt-4">
                                    {#if serverMessage && users.length === 0}
                                        {serverMessage}
                                    {:else if users.length === 0}
                                        Tidak ada pengguna untuk perusahaan Ripeness ini.
                                    {:else if filteredUsers.length === 0 && searchTerm !== ""}
                                        Pengguna dengan nama atau email "{searchTerm}" tidak ditemukan.
                                    {/if}
                                </p>
                            </Col>
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
                                    <th>No. Telepon</th>
                                    <th>Alamat</th>
                                    <th class="text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {#each filteredUsers as user (user.id)}
                                    <tr>
                                        <td>
                                            <img
                                                src={user.avatar || defaultAvatarPath}
                                                alt={user.name}
                                                class="rounded-circle avatar-sm"
                                                on:error={handleImageError}
                                            />
                                        </td>
                                        <td>{user.name || '-'}</td>
                                        <td>{user.email || '-'}</td>
                                        <td>{user.phoneNumber || '-'}</td>
                                        <td>{user.address || '-'}</td>
                                        <td class="text-center">
                                            <Button size="sm" color="light" on:click={() => openUserProfileModal(user)} title="Lihat Profil">
                                                <Icon icon="mdi:eye-outline"/>
                                            </Button>
                                        </td>
                                    </tr>
                                {/each}
                            </tbody>
                        </Table>
                    </div>
                    {:else}
                        <p class="text-muted text-center mt-4">
                            {#if serverMessage && users.length === 0}
                                {serverMessage}
                            {:else if users.length === 0}
                                Tidak ada pengguna untuk perusahaan Ripeness ini.
                            {:else if filteredUsers.length === 0 && searchTerm !== ""}
                                Pengguna dengan nama atau email "{searchTerm}" tidak ditemukan.
                            {/if}
                        </p>
                    {/if}
                {/if}
            {/if}
        </CardBody>
    </Card>

    {#if selectedUserForModal}
        <Modal isOpen={isUserProfileModalOpen} toggle={toggleUserProfileModal} size="lg" centered scrollable>
            <ModalHeader toggle={toggleUserProfileModal} class="bg-light">
                <div class="d-flex align-items-center">
                    <Icon icon="mdi:account-circle-outline" class="fs-4 me-2 text-primary"/>
                    Profil Pengguna (Ripeness): <span class="fw-medium ms-1">{selectedUserForModal.name}</span>
                </div>
            </ModalHeader>
            <ModalBody class="p-4">
                <Row>
                    <Col md="4" class="text-center mb-3 mb-md-0">
                        <img
                            src={selectedUserForModal.avatar || defaultAvatarPath}
                            alt={selectedUserForModal.name}
                            class="img-thumbnail rounded-circle shadow-sm"
                            style="width: 150px; height: 150px; object-fit: cover;"
                            on:error={handleImageError}
                        />
                        <h5 class="mt-3 mb-1">{selectedUserForModal.name || 'N/A'}</h5>
                        <p class="text-muted fs-sm">{selectedUserForModal.email || 'Email tidak tersedia'}</p>
                    </Col>
                    <Col md="8">
                        <h6 class="text-primary mb-3">Informasi Kontak</h6>
                        <div class="mb-2">
                            <Icon icon="mdi:phone-outline" class="me-2 text-muted" style="vertical-align: -2px;"/>
                            <span class="text-muted me-1">Telepon:</span>
                            <strong>{selectedUserForModal.phoneNumber || 'N/A'}</strong>
                        </div>
                        <div class="mb-3">
                            <Icon icon="mdi:map-marker-outline" class="me-2 text-muted" style="vertical-align: -2px;"/>
                            <span class="text-muted me-1">Alamat:</span>
                            <strong>{selectedUserForModal.address || 'N/A'}</strong>
                        </div>

                        <h6 class="text-primary mb-3 mt-4">Informasi Akun</h6>
                        <div class="mb-2">
                            <Icon icon="mdi:calendar-check-outline" class="me-2 text-muted" style="vertical-align: -2px;"/>
                            <span class="text-muted me-1">Valid Hingga:</span>
                            <strong>{formatDate(selectedUserForModal.date?.validDate)}</strong>
                        </div>
                        <div class="mb-2">
                            <Icon icon="mdi:update" class="me-2 text-muted" style="vertical-align: -2px;"/>
                            <span class="text-muted me-1">Update Terakhir:</span>
                            <strong>{formatDate(selectedUserForModal.lastUpdated)}</strong>
                        </div>
                         <div class="mb-2">
                            <Icon icon="mdi:calendar-account-outline" class="me-2 text-muted" style="vertical-align: -2px;"/>
                            <span class="text-muted me-1">Dibuat:</span>
                            <strong>{formatDate(selectedUserForModal.date?.createdDate)}</strong>
                        </div>
                        <div class="mb-2">
                            <Icon icon="mdi:account-key-outline" class="me-2 text-muted" style="vertical-align: -2px;"/>
                            <span class="text-muted me-1">ID Pengguna:</span>
                            <span class="font-monospace fs-sm">{selectedUserForModal.userId}</span>
                        </div>
                        <div class="mb-2">
                            <Icon icon="mdi:account-cog-outline" class="me-2 text-muted" style="vertical-align: -2px;"/>
                            <span class="text-muted me-1">Tipe Akun:</span>
                            <strong>{selectedUserForModal.type || 'N/A'}</strong>
                        </div>
                         <div class="mb-2">
                            <Icon icon="mdi:star-circle-outline" class="me-2 text-muted" style="vertical-align: -2px;"/>
                            <span class="text-muted me-1">Membership:</span>
                            <strong>{selectedUserForModal.membership || 'N/A'}</strong>
                        </div>
                        {#if selectedUserForModal.gender}
                        <div class="mb-2">
                            <Icon icon={selectedUserForModal.gender.toLowerCase() === 'laki-laki' ? 'mdi:gender-male' : 'mdi:gender-female'} class="me-2 text-muted" style="vertical-align: -2px;"/>
                            <span class="text-muted me-1">Gender:</span>
                            <strong>{selectedUserForModal.gender}</strong>
                        </div>
                        {/if}
                        {#if selectedUserForModal.birthDate}
                        <div class="mb-2">
                             <Icon icon="mdi:calendar-outline" class="me-2 text-muted" style="vertical-align: -2px;"/>
                            <span class="text-muted me-1">Tgl Lahir:</span>
                            <strong>{selectedUserForModal.birthDate}</strong>
                        </div>
                        {/if}
                    </Col>
                </Row>
            </ModalBody>
            <div class="modal-footer">
                <Button color="secondary" outline on:click={toggleUserProfileModal}>Tutup</Button>
            </div>
        </Modal>
    {/if}
</DefaultLayout>