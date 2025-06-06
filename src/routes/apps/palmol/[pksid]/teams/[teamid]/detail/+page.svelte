<script lang="ts">
    import DefaultLayout from "$lib/layouts/DefaultLayout.svelte";
    import PageBreadcrumb from "$lib/components/PageBreadcrumb.svelte";
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import type { PageData } from './$types'; // Mengambil tipe PageData dari SvelteKit
    import type { PKSTeam, AppError, PopulatedMemberInfo, UserSessionData, MenuItemType } from '$lib/types'; // Impor UserSessionData, MenuItemType
    import { Row, Col, Card, CardHeader, CardBody, Button, Alert, Spinner, ListGroup, ListGroupItem, Badge } from "@sveltestrap/sveltestrap";
    import Icon from '@iconify/svelte';

    export let data: PageData;

    // Data untuk DefaultLayout
    let layoutPageData: { userSession: UserSessionData | undefined; menuItemsForLayout: MenuItemType[] };
    $: layoutPageData = {
        userSession: $page.data.userSession as UserSessionData | undefined,
        menuItemsForLayout: ($page.data.menuItemsForLayout as MenuItemType[]) || []
    };

    // State halaman dari data server
    let pksId: string | undefined;
    let teamId: string | undefined;
    let namaPKS: string | undefined;
    let teamDetailObject: PKSTeam | undefined;
    // messageFromServer tidak ada di return server, jadi tidak perlu
    // let messageFromServer: string | undefined | null = undefined;

    // Error kritis dari SvelteKit
    $: criticalError = $page.error as AppError | null;

    // Update state saat data berubah
    $: {
        if (data && !criticalError) {
            pksId = data.pksId;
            teamId = data.teamId;
            namaPKS = data.namaPKS;
            teamDetailObject = data.teamDetail;
            // messageFromServer = data.message; // Hapus jika 'message' tidak dikirim untuk halaman ini
        } else if (criticalError) {
            // Reset jika ada error kritis
            pksId = undefined;
            teamId = undefined;
            namaPKS = "Error";
            teamDetailObject = undefined;
            // messageFromServer = null;
        }
    }

    const defaultUserAvatar = '/images/users/avatar-default.png';

    function viewTeamReports() {
        if (pksId && teamId) {
            const targetUrl = `/apps/palmol/${pksId}/teams/${teamId}/reports`;
            goto(targetUrl);
        }
    }

    function handleImageError(event: Event) {
        const target = event.target as HTMLImageElement;
        target.src = defaultUserAvatar;
    }

</script>

<DefaultLayout data={layoutPageData}>
    <PageBreadcrumb
        title={`Detail Tim: ${teamDetailObject?.teamName || (teamId ? teamId.substring(0,6) + '...' : 'Tim Tidak Dikenal')}`}
        subTitle={`PKS: ${namaPKS || (pksId ? pksId.substring(0,6) + '...' : 'PKS Tidak Dikenal')}`}
    />

    <main class="team-detail-main-content pt-3">
        {#if criticalError}
            <Alert color="danger" class="shadow-sm">
                <h4 class="alert-heading">
                    <Icon icon="mdi:alert-octagon-outline" class="me-2"/>Terjadi Kesalahan Server
                </h4>
                <p>
                    Tidak dapat memuat detail tim.
                    {#if criticalError.message}
                        <br/><small>Detail: {criticalError.message}</small>
                    {/if}
                </p>
            </Alert>
        {:else if teamDetailObject}
            <div class="mb-4">
                <a href={`/apps/palmol/${pksId}/teams`} class="btn btn-sm btn-outline-secondary">
                    <Icon icon="mdi:arrow-left" class="me-1"/> Kembali ke Daftar Tim PKS {namaPKS}
                </a>
            </div>

            <Row>
                <Col md="5" lg="4" xl="3" class="mb-3 mb-md-0">
                    <Card class="shadow-sm mb-3 sticky-top" style="top: 20px;">
                        <CardBody class="text-center">
                            <div class="avatar-xl-custom rounded-circle bg-primary text-white d-flex align-items-center justify-content-center mb-3 mx-auto">
                                <Icon icon="mdi:account-group-outline" style="font-size: 2.5rem;"/>
                            </div>
                            <h4 class="card-title mb-1 text-dark">{teamDetailObject.teamName}</h4>
                            <p class="text-muted fs-sm mb-0">ID Tim: {teamDetailObject.id?.substring(0,12)}...</p>
                            {#if namaPKS && pksId}
                                <p class="text-muted fs-sm">
                                    Bagian dari <a href={`/apps/palmol/${pksId}/teams`} class="text-primary">{namaPKS}</a> </p>
                            {/if}
                        </CardBody>
                    </Card>

                    <Card class="shadow-sm mb-3">
                        <CardHeader class="bg-light py-2">
                            <h5 class="card-title mb-0 fs-1rem">
                                <Icon icon="mdi:information-outline" class="me-2 text-primary"/>Informasi Tim
                            </h5>
                        </CardHeader>
                        <ListGroup flush>
                            <ListGroupItem class="d-flex justify-content-between align-items-center py-2">
                                <span class="text-muted fs-sm">Jumlah Anggota</span>
                                <Badge color="primary" pill class="px-2">
                                    {teamDetailObject.membersCount || 0} Anggota
                                </Badge>
                            </ListGroupItem>
                            <ListGroupItem class="d-flex justify-content-between align-items-center py-2">
                                <span class="text-muted fs-sm">Laporan Terakhir</span>
                                <span class="fw-medium fs-sm">{teamDetailObject.lastReport || 'Belum ada'}</span>
                            </ListGroupItem>
                        </ListGroup>
                    </Card>

                    <Card class="shadow-sm">
                         <CardHeader class="bg-light py-2">
                            <h5 class="card-title mb-0 fs-1rem">
                                <Icon icon="mdi:arrow-decision-outline" class="me-2 text-primary"/>Aksi Tim
                            </h5>
                        </CardHeader>
                        <CardBody>
                            <Button color="primary" class="w-100" on:click={viewTeamReports}>
                                <Icon icon="mdi:chart-line" class="me-1"/> Lihat Laporan Kinerja
                            </Button>
                        </CardBody>
                    </Card>
                </Col>

                <Col md="7" lg="8" xl="9">
                    <Card class="shadow-sm h-100">
                        <CardHeader class="bg-light py-2">
                            <h5 class="card-title mb-0 fs-1rem">
                               <Icon icon="mdi:account-multiple-outline" class="me-2 text-primary"/> Anggota Tim ({teamDetailObject.membersCount || 0})
                            </h5>
                        </CardHeader>
                        <CardBody>
                            {#if teamDetailObject.populatedMembersList && teamDetailObject.populatedMembersList.length > 0}
                                <Row class="row-cols-1 row-cols-sm-2 row-cols-lg-3 g-3">
                                    {#each teamDetailObject.populatedMembersList as member (member.id)}
                                        <Col>
                                            <Card class="member-card h-100 border shadow-sm card-hover-lift-sm">
                                                <CardBody class="p-3 d-flex flex-column">
                                                    <div class="d-flex align-items-center mb-3">
                                                        <img
                                                            src={member.avatar || defaultUserAvatar}
                                                            alt="Avatar {member.name}"
                                                            class="rounded-circle member-avatar-img me-3"
                                                            width="50" height="50"
                                                            on:error={handleImageError}
                                                        />
                                                        <div>
                                                            <h6 class="mb-0 fs-09rem text-dark text-truncate" title={member.name || 'Nama tidak ada'}>
                                                                {member.name || 'Nama tidak ada'}
                                                            </h6>
                                                            <p class="text-muted fs-xs mb-0 text-truncate" title={member.id}>ID: {member.id.substring(0,10)}...</p>
                                                        </div>
                                                    </div>

                                                    <div class="member-details mt-auto text-start w-100">
                                                        {#if member.email}
                                                        <p class="fs-xs text-muted mb-1 text-truncate" title={member.email}>
                                                            <Icon icon="mdi:email-outline" class="me-1 icon-detail"/>{member.email}
                                                        </p>
                                                        {/if}
                                                        {#if member.phoneNumber}
                                                        <p class="fs-xs text-muted mb-1 text-truncate" title={member.phoneNumber}>
                                                            <Icon icon="mdi:phone-outline" class="me-1 icon-detail"/>{member.phoneNumber}
                                                        </p>
                                                        {/if}
                                                        {#if member.address}
                                                        <p class="fs-xs text-muted mb-0 text-truncate-lines" title={member.address}>
                                                            <Icon icon="mdi:map-marker-outline" class="me-1 icon-detail"/>{member.address}
                                                        </p>
                                                        {/if}
                                                    </div>
                                                </CardBody>
                                            </Card>
                                        </Col>
                                    {/each}
                                </Row>
                            {:else}
                                <div class="text-center py-4">
                                    <Icon icon="mdi:account-multiple-remove-outline" style="font-size: 3rem;" class="text-muted mb-2"/>
                                    <p class="text-muted">Tidak ada data anggota yang terdaftar untuk tim ini.</p>
                                </div>
                            {/if}
                        </CardBody>
                    </Card>
                </Col>
            </Row>
        {:else}
            <div class="text-center py-5">
                <Spinner color="primary" style="width: 3rem; height: 3rem;"/>
                <p class="mt-3 text-muted">Memuat detail tim atau tim tidak ditemukan...</p>
            </div>
        {/if}
    </main>
</DefaultLayout>

<style>
    .avatar-xl-custom { width: 80px; height: 80px; font-size: 1.5rem; }
    .fs-sm { font-size: 0.875rem; }
    .fs-xs { font-size: 0.78rem; }
    .fs-1rem { font-size: 1rem !important; }
    .fs-09rem { font-size: 0.9rem; }
    .member-details { border-top: 1px solid var(--bs-border-color-translucent); padding-top: 0.75rem; margin-top: 0.75rem !important; }
    .member-details p { display: flex; align-items: flex-start; line-height: 1.4; }
    .text-truncate-lines { display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; word-break: break-word; line-height: 1.4; max-height: calc(1.4em * 2); }
    .member-avatar-img { object-fit: cover; } /* Untuk memastikan gambar avatar tidak terdistorsi */
</style>